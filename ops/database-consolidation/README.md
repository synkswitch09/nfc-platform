# Staging PostgreSQL consolidation

The protected `database-consolidation.yml` workflow copies `tapkin_staging` from
`pg-tapkin-staging-vnet-au` to the existing `pg-tapkin-production-vnet-au`.
Production remains in `tapkin_production`. Staging uses the restricted
`tapkin_staging_app` login and `database-url-consolidated-staging` secret on both
the application and schema migration job. Deployments use those existing secret
references; no PostgreSQL hostname is embedded in application code.

## Operations

- `audit`: metadata only; never resolves or prints secret values.
- `migrate`: private peering/DNS, preflight, write pause, backup, copy, verification,
  connection cutover, health checks, and retirement.
- `retire`: finishes retirement only with persisted verified cutover and backup.
- `recover`: restores original source references and schedule, then checks readiness.
- `resume`: resumes a recorded attempt. Reuse only an empty destination or a verified
  migration clone whose complete current manifest still matches its saved snapshot.
  Any independently changed destination requires review and is never overwritten.

The private `staging-db-consolidation` container on `stcommerceproductionau`
contains a timestamped custom-format dump, a manifest of table counts/hashes,
sequences and schema, and `control.json` recording the current migration phase.
Backup access is private; the worker receives a container-scoped SAS valid for
three hours. Connection strings and row contents never enter Actions logs.

The worker uses PostgreSQL 18 tools and verifies TLS certificates. It refuses to
overwrite an existing target database or login. Source writes are paused while
copying and the restored schema, tables and sequences must match the frozen
source. It verifies that staging cannot connect to the production database or
read/write its public tables. Production's owner retains access when PUBLIC
CONNECT is revoked; production data is never copied into staging or modified.

A failure before verified cutover retains the source server and restores its
connection references and application revisions. An existing failed attempt
requires inspecting its persisted phase and destination before retrying; do
not discard either copy or bypass the retirement guards.

## Resources retained

The staging application, migration/order jobs, Container Apps environment,
Container Apps subnet, VNet, logs and media storage remain. Bidirectional private
VNet peering and the production PostgreSQL DNS link to staging remain necessary.
Only the old PostgreSQL server, its exclusive DNS zone, its unused PostgreSQL
subnet, and the temporary migration job are retired. The order worker's configured
schedule is preserved, including the existing hourly staging schedule.

After completion remove the temporary staging migration IAM assignment from the
production deployment principal. The role definition is documented in
`ops/staging-database-migration-role.json`; remove it if it has no other assignments.
Keep the private dump for recovery. Restore a staging dump only into an isolated
staging database with the staging login, never into `tapkin_production`.
