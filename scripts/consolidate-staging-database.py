"""Consolidate staging into its own database on the existing production server.

The audit never prints credentials or customer data. Later migration steps must
retain private networking, stop staging writes, verify a durable backup and a
restored copy, and test database isolation before retiring the source server.
"""
import json
import re
import subprocess
from urllib.parse import urlsplit, unquote


def az(*args):
    result = subprocess.run(["az", *args, "--output", "json", "--only-show-errors"], capture_output=True, text=True)
    if result.returncode:
        code = re.search(r"(?:ERROR: \(|\"code\"\s*:\s*\")([A-Za-z0-9_]+)", result.stderr)
        raise RuntimeError("Azure operation failed: " + (code.group(1) if code else "unclassified"))
    return json.loads(result.stdout) if result.stdout.strip() else None


def resource_values(resource, group, is_job=False):
    containers = resource["properties"]["template"]["containers"]
    values = {}
    for container in containers:
        for item in container.get("env", []):
            if item["name"] in {"DATABASE_URL", "DATABASE_EXPECTED_NAME", "APP_ENV", "APP_URL"}:
                if item["name"] == "DATABASE_URL":
                    values["databaseSecretRef"] = item.get("secretRef")
                    if item.get("value"):
                        db = urlsplit(item["value"])
                        values["databaseHost"] = db.hostname
                        values["database"] = unquote(db.path.lstrip("/"))
                else:
                    values[item["name"]] = item.get("value")
    return values


def audit():
    for group in ["rg-commerce-production-au", "rg-tapkin-staging-au"]:
        servers = az("postgres", "flexible-server", "list", "--resource-group", group)
        for server in servers:
            print(json.dumps({"server": server["name"], "group": group, "version": server.get("version"), "state": server.get("state"), "sku": server.get("sku"), "storage": server.get("storage"), "network": server.get("network"), "administratorLogin": server.get("administratorLogin")}))
            databases = az("postgres", "flexible-server", "db", "list", "--resource-group", group, "--server-name", server["name"])
            print(json.dumps({"serverDatabases": server["name"], "databases": [item["name"] for item in databases]}))
        for kind in ["apps", "jobs"]:
            resources = az("containerapp", *(["job"] if kind == "jobs" else []), "list", "--resource-group", group)
            for resource in resources:
                values = resource_values(resource, group, kind == "jobs")
                print(json.dumps({"resource": resource["name"], "kind": kind, "environment": values.get("APP_ENV"), "databaseHost": values.get("databaseHost"), "database": values.get("database"), "databaseSecretRef": values.get("databaseSecretRef"), "expectedDatabase": values.get("DATABASE_EXPECTED_NAME"), "appUrl": values.get("APP_URL"), "environmentId": resource["properties"].get("environmentId"), "scale": resource["properties"]["template"].get("scale"), "schedule": resource["properties"].get("configuration", {}).get("scheduleTriggerConfig")}))
        networks = az("network", "vnet", "list", "--resource-group", group)
        for network in networks:
            print(json.dumps({"vnet": network["name"], "id": network["id"], "addressSpace": network.get("addressSpace"), "subnets": [{"name": subnet["name"], "id": subnet["id"], "delegations": subnet.get("delegations"), "networkSecurityGroup": subnet.get("networkSecurityGroup"), "ipConfigurations": subnet.get("ipConfigurations")} for subnet in network.get("subnets", [])], "peerings": network.get("virtualNetworkPeerings")}))
        zones = az("network", "private-dns", "zone", "list", "--resource-group", group)
        for zone in zones:
            links = az("network", "private-dns", "link", "vnet", "list", "--resource-group", group, "--zone-name", zone["name"])
            print(json.dumps({"dnsZone": zone["name"], "links": [{"name": link["name"], "virtualNetwork": link.get("virtualNetwork")} for link in links]}))


if __name__ == "__main__":
    audit()
