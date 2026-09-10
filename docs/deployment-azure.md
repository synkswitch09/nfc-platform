# Tapkin on Azure: low-cost deployment runbook

Status: repository preparation only. No Azure resource or production deployment was created by this change.

This runbook targets Azure Container Apps, Azure Database for PostgreSQL Flexible Server and Azure Blob Storage while keeping the application portable. Tapkin still uses standard Docker, PostgreSQL through `DATABASE_URL`, HTTP email/payment integrations and a provider-neutral storage interface.

## 1. Architecture and environment contract

```text
DNS (Cloudflare optional)
  -> Azure Container Apps ingress
     -> Tapkin stateless container
        -> PostgreSQL Flexible Server
        -> private Blob container
        -> Stripe / OAuth / email webhooks
```

Create three Container Apps and three migration jobs. Every app/job receives only its own environment configuration.

| Setting | DEVELOPMENT | STAGING | PRODUCTION |
|---|---|---|---|
| Branch | `develop` | `staging` | `main` |
| Container App | `tapkin-develop` | `tapkin-staging` | `tapkin-production` |
| Domain | `develop.tapkin.com.au` | `staging.tapkin.com.au` | `tapkin.com.au` (`www` optional) |
| `APP_ENV` | `development` | `staging` | `production` |
| Database | `tapkin_development` | `tapkin_staging` | `tapkin_production` |
| Blob container | `tapkin-development` | `tapkin-staging` | `tapkin-production` |
| Stripe | Test | Test, separate webhook | Live, production-only keys |
| Email | Mock | Sandbox | Live |
| OAuth | Development client/config | Staging client/config | Production client/config |
| SEO | noindex/nofollow | noindex/nofollow | CMS rules/indexable |
| Seed | Demo + optional dev admin | Explicit controlled seed | Disabled |
| Analytics | Disabled or dev property | Staging property | Production property |
| Logs | stdout, environment field | stdout, environment field | stdout, environment field |
| Min replicas | 0 | 0 | 0 before launch; 1 after real NFC sales |

`DATABASE_EXPECTED_NAME` and `STORAGE_ENVIRONMENT` are deployment guardrails. Startup fails when they do not agree with the actual database name/`APP_ENV`. Never copy a production environment secret set into another GitHub Environment.

## 2. Branch and promotion policy

The intended path is `feature/* -> develop -> staging -> main`. Promotion is a reviewed merge/cherry-pick decision, never a workflow that automatically moves a branch. Do not develop independently on `staging`; create it from an approved `develop` candidate when the first staging release is ready.

- A push to `develop` validates and can deploy DEVELOPMENT.
- A push to `staging` validates and can deploy STAGING.
- A push to `main` validates only. PRODUCTION deploy requires a manual `workflow_dispatch` with `deploy=true`, `AZURE_DEPLOY_ENABLED=true`, and GitHub Environment approval.
- Protect `main` and `staging`: require pull requests, the validation check, no force pushes, and at least one reviewer. Add required reviewers to the `production` GitHub Environment.

Deployment jobs remain skipped until the repository variable `AZURE_DEPLOY_ENABLED` is set to `true`. Leave it unset while Azure is not configured.

## 3. Subscription, resource group and budget

1. In Azure Portal select the intended subscription and region (prefer an Australian region that supports every selected SKU).
2. Create one resource group such as `rg-tapkin-au`. Separate resource groups per production can come later when billing/permissions justify it.
3. Open Cost Management + Billing -> Budgets -> Add. Create an initial monthly AU$5 budget and another AU$10 safety budget (or the smallest amounts useful for the subscription). Notify at 50%, 80% and 100%; include forecast alerts where available.
4. Check Cost Analysis and resource-level metrics at least weekly during setup. A budget alerts; it does not stop resources automatically.

Free grants and prices vary by subscription, region, currency and date. Confirm the live offer in Azure Portal before creation. Container Apps Consumption can scale to zero and may include a monthly grant, but PostgreSQL normally remains the principal continuous cost. Flexible Server free trials/allowances can be temporary or subscription-specific. Storage transactions, capacity, log ingestion, egress, public IPv4/networking and backup retention can create charges. Official references: [Container Apps pricing](https://azure.microsoft.com/pricing/details/container-apps/), [PostgreSQL pricing](https://azure.microsoft.com/pricing/details/postgresql/flexible-server/), and [Azure budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

Low-cost starting choices:

- Container Apps Consumption plan; min replicas 0 for development/staging.
- No AKS, VM, Redis, NAT Gateway, Application Gateway or queue.
- One small Flexible Server with three databases initially; stop lower-environment compute when practical if the chosen tier permits it.
- One general-purpose v2 Storage Account with three private hot-tier containers.
- GHCR instead of ACR to avoid adding a registry resource solely for convenience.
- Short log retention; no Application Insights until its value and budget are clear.

## 4. PostgreSQL Flexible Server

### Initial economic topology

Create one Flexible Server and three distinct databases. This is logical/data isolation, not failure, network, maintenance or billing isolation. Use a separate database role/password for every environment, granting access only to its database. Never grant a development role access to `tapkin_production`.

Move production to its own server before regulated/contractual isolation is required, production load competes with tests, maintenance windows diverge, blast radius becomes unacceptable, or revenue makes independent scaling/HA worthwhile.

### Create and secure

1. Portal -> Azure Database for PostgreSQL flexible servers -> Create.
2. Select a supported PostgreSQL version compatible with local PostgreSQL 17 and Prisma; verify Azure region availability before choosing.
3. Start with the smallest burstable compute/storage that passes staging load tests. Do not enable HA/read replicas prematurely.
4. Require TLS. Each `DATABASE_URL` should include `sslmode=require`, `connection_limit=5` and a practical `pool_timeout`, for example:

   `postgresql://USER:PASSWORD@HOST:5432/tapkin_staging?schema=public&sslmode=require&connection_limit=5&pool_timeout=10`

5. Set `DATABASE_EXPECTED_NAME` to the exact database (`tapkin_development`, `tapkin_staging` or `tapkin_production`).
6. Prefer private networking when budget and operational maturity allow. For the initial public-access configuration, enable “deny public network access” if Container Apps private connectivity is configured. Otherwise allow only the narrow Azure/administration sources required, use TLS and unique least-privilege credentials, and do not enable broad `0.0.0.0/0` client access. Note that “allow Azure services” is broad, not an app identity boundary.

Prisma is a process singleton. Container replicas still multiply the connection pool; keep the URL connection limit small and monitor `active_connections`. Revisit PgBouncer only when metrics justify it.

Do not add a blanket application retry around mutations: it can duplicate side effects. Let readiness fail while PostgreSQL is unavailable and let Container Apps stop routing traffic. Add bounded, operation-specific retry only for demonstrably transient, idempotent reads/operations.

### Migrations

The app image never runs migrations at startup. CI builds a separate `migrator` target. Configure one manual-trigger Container Apps Job per environment with that image and only that environment's `DATABASE_URL`. The deploy workflow updates and waits for the job before updating the web app. Workflow concurrency permits only one release for an environment at a time, preventing overlapping migration/deploy sequences.

Migration release order: review SQL -> back up/confirm restore point -> run in DEVELOPMENT -> promote and run in STAGING -> exercise staging -> obtain production approval -> run production job once -> deploy app. Prefer backward-compatible expand/migrate/contract changes. Never combine an irreversible destructive schema change with the app release that first depends on it.

### Seeds and administrators

- DEVELOPMENT: `docker compose --profile tools run --rm seed`. Pass `DEV_ADMIN_EMAIL`/`DEV_ADMIN_PASSWORD` only for that command.
- STAGING: run the same seed image only with `APP_ENV=staging`, `ALLOW_STAGING_SEED=true`, and separate `STAGING_ADMIN_*` secrets. This is deliberate and repeatable test data.
- PRODUCTION: `npm run db:seed` always refuses. Create the real first administrator through a reviewed, one-time operational procedure; do not reuse demo credentials. Record who created it and rotate/remove bootstrap credentials immediately.

The literal sample `admin@example.local` / `DevAdmin123!` is never stored by the application and is explicitly rejected outside DEVELOPMENT.

## 5. Blob Storage

1. Create one StorageV2 account with secure transfer required, minimum TLS 1.2+, public blob access disabled and locally redundant storage initially.
2. Create private containers `tapkin-development`, `tapkin-staging`, `tapkin-production`.
3. Set `STORAGE_PROVIDER=azure-blob`, `STORAGE_ENVIRONMENT` to the matching `APP_ENV`, and `AZURE_STORAGE_CONTAINER_URL` to only that container.
4. The current portable Azure provider uses a container-scoped SAS held as a Container App secret. Grant only create/write/read/delete rights actually needed, HTTPS only, with an expiry and rotation calendar. Never commit it. Managed Identity with a future token-based provider is the preferred next hardening step once the first deployment is stable.
5. Use a different SAS per environment. Because the containers and new object keys are environment-separated, development cannot overwrite production media.

Product uploads are content-signature checked PNG/JPEG/WebP, limited to 5 MB and 40 megapixels, assigned random safe keys, and served through `/api/media/{storageKey}`. Containers remain private. Category/profile fields that accept remote images remain URL references; they are not copied into Blob Storage yet. Add thumbnails/WebP conversion and orphan cleanup only after measuring real media volume; do not add an always-running processor initially.

## 6. Container Apps and migration jobs

1. Create one Container Apps Environment initially unless stronger production network/log isolation is needed.
2. Create `tapkin-develop`, `tapkin-staging`, `tapkin-production` with external HTTPS ingress, target port 3000, single revision mode and CPU/memory at the smallest tested values.
3. Configure HTTP startup/liveness on `/api/health/live` and readiness on `/api/health/ready`. Readiness checks PostgreSQL; responses reveal no host or secret. Azure supports one probe of each type and treats HTTP 200–399 as success ([probe reference](https://learn.microsoft.com/azure/container-apps/health-probes)).
4. Configure max replicas conservatively and min replicas 0 for development/staging. Set production to 0 only before real customers if first-request latency is acceptable. A sleeping revision may add several seconds to the first `/t/{publicTagId}` request. Once physical NFC tags are sold or incident/recovery traffic matters, set production min replicas to 1; reliability wins over the small saving.
5. Create manual Container Apps Jobs `tapkin-develop-migrate`, `tapkin-staging-migrate`, `tapkin-production-migrate` using the `migrator` image, one execution/parallelism 1, no schedule, and environment-specific DB secrets.
6. Configure `PORT=3000`, `NODE_ENV=production`, stdout/stderr log collection and graceful termination. The runtime runs as UID 1001 and does not contain Prisma CLI/dev tooling.

Sessions, rate-limit counters, pending orders and other critical business state are database-backed. The pre-checkout cart is deliberately noncritical browser-local state, not container memory. Uploaded media uses Blob Storage in cloud. Local disk is not a production dependency.

## 7. Runtime variables and secrets

Create secrets in each Container App; map them to environment variables. Run `npm run config:check` using the exact environment values before rollout. Do not print secret values.

Required staging/production settings:

- `APP_ENV`, `APP_URL`, `DATABASE_URL`, `DATABASE_EXPECTED_NAME`
- independent `SESSION_SECRET` and `ACTIVATION_PEPPER` (32+ random characters)
- `TRUST_PROXY=true` only when direct ingress is controlled and Azure overwrites forwarded headers
- `STORAGE_PROVIDER=azure-blob`, `STORAGE_ENVIRONMENT`, container URL and SAS
- `EMAIL_MODE=sandbox` for staging / `live` for production, webhook URL/secret
- Stripe secret, publishable and webhook keys with correct test/live prefix
- optional matched Google and Apple client ID/secret pairs
- optional environment-specific `ANALYTICS_ID` and `LOG_LEVEL`

Never set `DEV_ADMIN_*`, `ALLOW_STAGING_SEED` or `ENABLE_TEST_CHECKOUT` in production. Do not set production secrets as repository-level defaults.

## 8. Authentication, domains and providers

Absolute URLs come only from `APP_URL`; arbitrary forwarded host/proto headers do not select OAuth/reset/checkout destinations. HTTPS environments receive Secure, HttpOnly, SameSite cookies. `TRUST_PROXY` affects privacy-minimised client identity only.

Register exact Google redirect URIs:

- `https://develop.tapkin.com.au/api/auth/oauth/google/callback`
- `https://staging.tapkin.com.au/api/auth/oauth/google/callback`
- `https://tapkin.com.au/api/auth/oauth/google/callback`

Register exact Apple return URLs:

- `https://develop.tapkin.com.au/api/auth/oauth/apple/callback`
- `https://staging.tapkin.com.au/api/auth/oauth/apple/callback`
- `https://tapkin.com.au/api/auth/oauth/apple/callback`

Apple web sign-in requires a Services ID associated with verified domains and return URLs; the client secret is a signed JWT with an expiry. Keep separate lower/production configuration where Apple permits and schedule rotation.

Create independent Stripe webhook endpoints ending `/api/stripe/webhook` for all three domains. Development/staging use test mode. Production alone receives `sk_live_`/`pk_live_`. Signature validation, event idempotency and server-authoritative prices remain mandatory.

Development email is `mock`: it logs only message type and recipient domain, never reset/verification tokens or message body. Staging uses a provider sandbox that cannot deliver to arbitrary customers; production uses the real provider.

## 9. DNS, TLS and optional Cloudflare

Add and verify each Container Apps custom domain, then follow the Azure-generated validation record instructions. Subdomains normally use CNAME; apex/root configuration may require the records Azure displays. Use Azure managed certificates where supported and verify renewal. See [Azure custom domains and managed certificates](https://learn.microsoft.com/azure/container-apps/custom-domains-managed-certificates).

Cloudflare is optional. If used, first configure records DNS-only until Azure validation/certificate issuance completes; enable proxying only after end-to-end HTTPS works. Use Full (strict) TLS, do not use Flexible mode, preserve `/t/*`, `/api/*` and OAuth callbacks, and never cache authenticated/admin/API responses. The application must continue working if records point directly to Azure.

## 10. GitHub Environments, OIDC and GHCR

Create GitHub Environments named exactly `development`, `staging`, `production`. Put these secrets in each:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Put nonsecret environment variables there: `AZURE_RESOURCE_GROUP`, `AZURE_CONTAINER_APP`, `AZURE_MIGRATION_JOB`, `APP_URL`, optional smoke product/tag IDs. Protect production with required reviewers and prevent unreviewed branches where the GitHub plan supports it.

Create a Microsoft Entra application or user-assigned managed identity, grant only the relevant resource-group/container-app permissions, and add one federated credential per GitHub Environment. The subject format is `repo:synkswitch09/nfc-platform:environment:development` (and staging/production equivalents), issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`. No long-lived Azure client secret is used. Follow the official [Azure Login OIDC guide](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect).

GHCR is selected over ACR for the initial low-cost phase. Keep the package private and configure each Container App/Job registry credentials using a narrowly scoped read-only GitHub token stored as an Azure secret; rotate it. If managed registry identity, private networking, regional pull performance or enterprise policy becomes important, migrate to ACR later.

## 11. SEO, analytics, logs and monitoring

Development/staging receive noindex/nofollow/noarchive through root metadata, `robots.txt`, empty sitemaps and the `X-Robots-Tag` response header. Production honors product/category CMS visibility/indexability and uses only its own `APP_URL` for metadata, canonical URLs, OpenGraph and structured data.

Every structured application log includes `environment` and goes to stdout/stderr. Do not log credentials, tokens, activation codes, DB URLs or request bodies. Start with Container Apps logs and short retention. Add Application Insights only after deciding sampling/retention and confirming the budget. Use a separate analytics property/stream per environment or leave lower environments disabled; revenue, orders, NFC scans and conversions must never mix across databases/properties.

## 12. Backups and restore test

Enable/confirm Azure managed backups and choose production retention based on the business recovery objective. Geo-redundancy and longer retention increase cost. Before risky releases, confirm a current restore point.

Also take an encrypted logical backup from a controlled workstation/job:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file tapkin-production.dump
```

Never place the dump in Git or a public container. Restore quarterly into a temporary isolated database, never over production:

```bash
createdb "$RESTORE_DATABASE_URL"
pg_restore --no-owner --no-acl --exit-on-error --dbname "$RESTORE_DATABASE_URL" tapkin-production.dump
```

Run migrations/config checks and representative read-only smoke tests against the restored database, record duration/results, then securely remove the temporary DB/dump according to retention policy. Azure managed backup details are in the [Flexible Server backup/restore guide](https://learn.microsoft.com/azure/postgresql/backup-restore/concepts-backup-restore).

## 13. Rollback and release safety

Application rollback: keep immutable SHA tags and Container Apps revisions. Stop traffic shift when readiness fails; reactivate the last healthy revision or update to its known image digest, then smoke test. Do not rebuild an old mutable tag.

Database rollback: prefer a forward-fix. A code rollback is safe only while the new schema remains backward compatible. For destructive/incompatible changes, stop release, restore to a new server/database from the pre-release point, validate, then deliberately repoint the app. `git revert` alone cannot undo migrated data.

Production checklist: staging passed; migration reviewed; backup/restore posture confirmed; lint/typecheck/unit/E2E/build/Docker passed; OAuth/Stripe/email are in correct modes; no demo admin/data; `/api/health/live` and `/ready` pass; homepage, Shop, login, one product, one non-sensitive test NFC route and Admin authorization pass; explicit approver authorizes the Environment.

Dependency audit note (10 September 2026): npm reports four high advisories through Prisma CLI 6.19's `@prisma/config` development/migration dependencies (`deepmerge-ts` and `effect`). The proposed automatic remediation downgrades Prisma to 6.12 and was intentionally not applied. The runtime standalone image does not include the Prisma CLI; the isolated migrator consumes trusted schema/config only. CI blocks critical advisories, while these high findings remain a tracked upgrade item to retest against the next compatible Prisma release. Re-evaluate before production approval.

## 14. NFC continuity

This cloud work does not alter `publicTagId`, NFC records or `/t/{publicTagId}`. Physical production tags continue to use `https://tapkin.com.au/t/{publicTagId}`. Development/staging test tags live only in their isolated databases and use their own domains. Never copy test tags into production or repoint a production domain to a lower database.

## 15. First deployment sequence

1. Confirm subscription/region and create budgets.
2. Create resource group, small PostgreSQL server, three databases and three least-privilege roles.
3. Create StorageV2 and three private containers/SAS credentials.
4. Create Container Apps Environment, three web apps and three manual migration jobs.
5. Configure environment-specific app/job secrets and probes.
6. Create GHCR package access credentials in Azure.
7. Create GitHub Environments, OIDC identities and least-privilege role assignments.
8. Bind development DNS/certificate and register development OAuth/Stripe callbacks.
9. Run `npm run config:check`; enable `AZURE_DEPLOY_ENABLED`; deploy `develop`; run smoke tests.
10. Only after development is stable, create `staging` from an approved `develop` commit, bind staging integrations, promote and test migrations/NFC/checkout/Admin/responsive/SEO behavior.
11. Configure production resources/secrets but keep production deployment disabled. Add required reviewers.
12. After business, legal, privacy, security and operational launch gates pass, request explicit production authorization, promote staging to main, validate, manually dispatch production, approve, migrate, deploy and smoke test.

Infrastructure as code is intentionally deferred. The first small deployment benefits more from a documented, observed setup than an untested Bicep/Terraform layer. Capture the final working Azure configuration and introduce Bicep when repeatability, a second brand/region or disaster recovery requires it.
