"""Private-network PostgreSQL copy. Never log connection strings or row values."""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import traceback
from urllib.parse import urlsplit, unquote, parse_qsl, urlencode, urlunsplit
from urllib.request import Request, urlopen

import psycopg2
from psycopg2 import sql

SOURCE_HOST = "pg-tapkin-staging-vnet-au.postgres.database.azure.com"
TARGET_HOST = "pg-tapkin-production-vnet-au.postgres.database.azure.com"
STAGING_DB = "tapkin_staging"
PRODUCTION_DB = "tapkin_production"
STAGING_ROLE = "tapkin_staging_app"


def connection_parameters(url, expected_host, expected_db):
    parsed = urlsplit(url)
    if parsed.hostname != expected_host or unquote(parsed.path[1:]) != expected_db:
        raise ValueError("Unexpected database destination")
    query = dict(parse_qsl(parsed.query))
    if query.get("sslmode") == "disable":
        raise ValueError("Database transport must use TLS")
    return dict(host=parsed.hostname, port=parsed.port or 5432,
                user=unquote(parsed.username or ""), password=unquote(parsed.password or ""),
                dbname=expected_db, sslmode="verify-full",
                sslrootcert="/etc/ssl/certs/ca-certificates.crt", connect_timeout=20,
                application_name="staging-database-consolidation")


def connect(params, database=None):
    result = psycopg2.connect(**{**params, **({"dbname": database} if database else {})})
    result.autocommit = True
    with result.cursor() as cur:
        cur.execute("SET TIME ZONE 'UTC'")
    return result


def query(conn, statement, parameters=None):
    with conn.cursor() as cur:
        cur.execute(statement, parameters)
        return cur.fetchall() if cur.description else []


def pg_tool(name, params, *args):
    env = {**os.environ, **{("PGDATABASE" if k == "dbname" else "PG" + k.upper()): str(v) for k, v in params.items()
                           if k in ("host", "port", "user", "password", "dbname", "sslmode", "sslrootcert", "connect_timeout")}}
    # Credentials stay in process environment; no raw stderr enters logs.
    result = subprocess.run([name, *args], env=env, capture_output=True)
    if result.returncode:
        raise RuntimeError(name + " failed; source is retained")
    return result.stdout


def manifest(params):
    with closing(connect(params)) as conn:
        tables = query(conn, "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_%' ORDER BY 1,2")
        rows = {}
        for schema, table in tables:
            digest, count = hashlib.sha256(), 0
            with conn.cursor() as cur:
                cur.execute(sql.SQL("SELECT row_to_json(t)::text FROM {}.{} t ORDER BY row_to_json(t)::text COLLATE \"C\"").format(sql.Identifier(schema), sql.Identifier(table)))
                for (value,) in cur:
                    digest.update(value.encode() + b"\n")
                    count += 1
            rows[schema + "." + table] = {"count": count, "sha256": digest.hexdigest()}
        sequences = query(conn, "SELECT schemaname, sequencename, last_value FROM pg_sequences WHERE schemaname NOT LIKE 'pg_%' ORDER BY 1,2")
        extensions = query(conn, "SELECT extname, extversion FROM pg_extension ORDER BY 1")
        large_objects = query(conn, "SELECT count(*) FROM pg_largeobject_metadata")[0][0]
    schema = pg_tool("pg_dump", params, "--schema-only", "--no-owner", "--no-acl").decode()
    normalized = "\n".join(line for line in schema.splitlines() if line.strip() and not line.startswith(("--", "\\restrict", "\\unrestrict")))
    return {"tables": rows, "sequences": sequences, "extensions": extensions,
            "largeObjects": large_objects, "schemaSha256": hashlib.sha256(normalized.encode()).hexdigest()}


def blob_url(name):
    base = urlsplit(os.environ["BACKUP_CONTAINER_SAS"])
    if base.scheme != "https" or base.hostname != "stcommerceproductionau.blob.core.windows.net" or base.path != "/staging-db-consolidation":
        raise ValueError("Backup destination must be the private migration container")
    return urlunsplit((base.scheme, base.netloc, base.path + "/" + name, base.query, ""))


def upload(name, data):
    request = Request(blob_url(name), data=data, method="PUT", headers={"x-ms-blob-type": "BlockBlob", "x-ms-version": "2023-11-03", "Content-Type": "application/octet-stream"})
    with urlopen(request, timeout=120) as response:
        if response.status != 201:
            raise RuntimeError("Backup upload failed")
    # Download and compare bytes before relying on the backup.
    with urlopen(blob_url(name), timeout=120) as response:
        stored = response.read()
    if hashlib.sha256(stored).digest() != hashlib.sha256(data).digest():
        raise RuntimeError("Backup verification failed")


def save_status(status):
    upload("status.json", json.dumps(status, sort_keys=True).encode())


def main():
    mode = os.environ["MIGRATION_MODE"]
    source = connection_parameters(os.environ["SOURCE_DATABASE_URL"], SOURCE_HOST, STAGING_DB)
    production = connection_parameters(os.environ["PRODUCTION_DATABASE_URL"], TARGET_HOST, PRODUCTION_DB)
    target = connection_parameters(os.environ["TARGET_DATABASE_URL"], TARGET_HOST, STAGING_DB)
    if target["user"] != STAGING_ROLE:
        raise ValueError("Staging requires its own restricted login")
    with closing(connect(source)) as source_conn, closing(connect(production, "postgres")) as admin:
        version = query(source_conn, "SHOW server_version_num")[0][0]
        if int(version) // 10000 != 18 or int(query(admin, "SHOW server_version_num")[0][0]) // 10000 != 18:
            raise RuntimeError("Verify PostgreSQL client/server compatibility")
        source_databases = query(source_conn, "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres','azure_sys','azure_maintenance') ORDER BY 1")
        if source_databases != [(STAGING_DB,)]:
            raise RuntimeError("Source contains additional databases; migration must include them")
        extensions = query(source_conn, "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'")
        if extensions:
            raise RuntimeError("Review extension ownership and allow-list before copying")
        if query(source_conn, "SELECT count(*) FROM pg_largeobject_metadata")[0][0]:
            raise RuntimeError("Large objects require additional verification")
        if mode == "probe":
            info = manifest(source)
            save_status({"phase": "preflight", "source": SOURCE_HOST, "database": STAGING_DB,
                         "tableCount": len(info["tables"]), "rowCount": sum(x["count"] for x in info["tables"].values())})
            print("Preflight passed: PostgreSQL 18, only staging database, private TLS and backup access verified")
            return
        if mode != "copy" or os.environ.get("STAGING_WRITES_PAUSED") != "true":
            raise RuntimeError("Copy requires confirmed staging write pause")
        if query(admin, "SELECT 1 FROM pg_database WHERE datname=%s", (STAGING_DB,)):
            raise RuntimeError("Target database already exists; never overwrite a live database")
        if query(admin, "SELECT 1 FROM pg_roles WHERE rolname=%s", (STAGING_ROLE,)):
            raise RuntimeError("Target role already exists; review before retrying")
        # All database data operations target staging only. Production is observed.
        with closing(connect(production)) as prod_guard:
            owner = query(prod_guard, "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=%s", (PRODUCTION_DB,))[0][0]
            if owner != production['user']:
                raise RuntimeError("Production owner must retain access before PUBLIC isolation")
        production_before = manifest(production)['schemaSha256']
        query(source_conn, sql.SQL("ALTER DATABASE {} SET default_transaction_read_only = on").format(sql.Identifier(STAGING_DB)))
        query(source_conn, "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s AND pid <> pg_backend_pid()", (STAGING_DB,))
        try:
            before = manifest(source)
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "staging.dump"
                pg_tool("pg_dump", source, "--format=custom", "--no-owner", "--no-acl", "--file", str(path))
                data = path.read_bytes()
                if len(data) > 128 * 1024 * 1024:
                    raise RuntimeError("Backup needs chunked transfer; source retained")
                backup_name = os.environ["BACKUP_NAME"]
                upload(backup_name, data)
                query(admin, sql.SQL("CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %s").format(sql.Identifier(STAGING_ROLE)), (target["password"],))
                query(admin, sql.SQL("CREATE DATABASE {} OWNER {} TEMPLATE template0").format(sql.Identifier(STAGING_DB), sql.Identifier(STAGING_ROLE)))
                query(admin, sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(sql.Identifier(STAGING_DB)))
                # PUBLIC CONNECT must not let the staging login open production.
                query(admin, sql.SQL("REVOKE CONNECT, TEMPORARY ON DATABASE {} FROM PUBLIC").format(sql.Identifier(PRODUCTION_DB)))
                pg_tool("pg_restore", target, "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", "--dbname", STAGING_DB, str(path))
                after = manifest(target)
                if before != after or manifest(source) != before:
                    raise RuntimeError("Restored database differs from frozen source")
                if manifest(production)['schemaSha256'] != production_before:
                    raise RuntimeError("Production schema changed during copy; investigate before cutover")
                with closing(connect(production)) as prod_conn:
                    if query(prod_conn, "SELECT has_database_privilege(%s,%s,'CONNECT')", (STAGING_ROLE, PRODUCTION_DB))[0][0]:
                        raise RuntimeError("Staging can connect to production")
                    grants = query(prod_conn, "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND has_table_privilege(%s,quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT,INSERT,UPDATE,DELETE')", (STAGING_ROLE,))[0][0]
                    if grants:
                        raise RuntimeError("Staging has production table privileges")
                save_status({"phase": "copy-verified", "source": SOURCE_HOST, "target": TARGET_HOST,
                             "database": STAGING_DB, "backup": backup_name,
                             "backupSha256": hashlib.sha256(data).hexdigest(), "manifest": before,
                             "productionSchemaUnchanged": True, "stagingCannotAccessProduction": True})
                print("Copy verified: backup readback, schema, all table hashes/counts, sequences and isolation passed")
        finally:
            # Allows rollback to the original database if cutover fails.
            with closing(connect(source, "postgres")) as reset:
                query(reset, sql.SQL("ALTER DATABASE {} RESET default_transaction_read_only").format(sql.Identifier(STAGING_DB)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # SQL/HTTP exception strings may include secrets or customer records.
        print("Migration failed safely (" + type(error).__name__ + "); source server retained", file=sys.stderr)
        print("Safe failure locations: " + json.dumps([{ "function": f.name, "line": f.lineno } for f in traceback.extract_tb(error.__traceback__)]), file=sys.stderr)
        if type(error) is RuntimeError or (type(error) is ValueError and str(error) in {"Unexpected database destination", "Database transport must use TLS", "Backup destination must be the private migration container", "Staging requires its own restricted login"}): print(str(error), file=sys.stderr)
        sys.exit(1)
