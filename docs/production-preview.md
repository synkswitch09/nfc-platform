# Production-domain preview before commerce launch

This mode serves Tapkin and Kosykin from a **dedicated production database and storage account**, with the public production hostnames, while deliberately keeping commerce inactive. The same container hosts both Stores. It does not copy staging customers, tags, orders, passwords or payment records.

## Preconditions

- Promote the reviewed current application from `staging` to `main`; the historic `main` branch predates the multi-store platform. Validate the exact SHA in staging first. Never point production at the staging database or Blob container.
- Create production-only PostgreSQL `tapkin_production`, migration and application roles; run all migrations with the dedicated migrator job. The Kosykin production migration creates an active but empty Store and binds `kosykin.com.au`. Tapkin is created by the multi-store foundation migration and binds `tapkin.com.au` and `www.tapkin.com.au`.
- Bind both apex hostnames to the single production Container App with verified DNS and managed certificates. Do not repoint staging hostnames or its Container App.
- Use an independent `production` GitHub Environment and OIDC identity; the production workflow is manual and gated by `AZURE_PRODUCTION_DEPLOY_ENABLED=true`. Record backup/restore plan before migration.

## Preview runtime settings

Set `APP_ENV=production`, `PRODUCTION_PREVIEW_MODE=true`, `APP_URL=https://tapkin.com.au`, `DATABASE_EXPECTED_NAME=tapkin_production`, `STORAGE_PROVIDER=azure-blob`, `STORAGE_ENVIRONMENT=production`, and an Azure Blob container URL ending in `-production`. Set distinct `DATABASE_URL`, `SESSION_SECRET`, `ACTIVATION_PEPPER` and container-scoped storage SAS for production. `DATABASE_URL` must require TLS.

Set `EMAIL_MODE=mock`. **Leave all Stripe keys and webhook secrets, email webhook URL and secret, analytics and OAuth credentials unset.** Configuration rejects preview mode if live payment or mail credentials are present. Do not reuse staging secrets. Do not enable `ENABLE_TEST_CHECKOUT`, demo admin or production seeds.

In preview mode all HTTP mutation methods return 503, public `/api` reads except health/media return 503, checkout returns 503 before order creation, no email is sent, robots.txt disallows crawling, metadata and `X-Robots-Tag` say noindex/nofollow/noarchive, and a site-wide banner says orders are not accepted. Visitors can see public pages and catalog content. Admin editing is intentionally unavailable while preview is active. For a richer public preview, import reviewed storefront content through a controlled pre-preview release process, not by copying operational data.

The sites become public to anyone with their URLs. `noindex` is a request to crawlers, **not access control**. If a private preview is needed, use an access gate before attaching public DNS.

## Launch later

Finish legal/privacy copy, catalog, responsive review, carrier rates, email delivery, Stripe live account and webhook, OAuth callbacks, backup restore test and monitoring. Review this flag and the production secrets as a single release: change `PRODUCTION_PREVIEW_MODE=false`, configure live integrations and redeploy after a separate launch decision. Never disable preview simply to edit Admin; use a maintenance procedure that preserves the write block for the public.

## Verification

- Both hostnames serve the intended Store and HTTPS certificate, with no cross-store catalog or SEO links.
- `/api/health/live` and `/api/health/ready` respond successfully; `/robots.txt` disallows crawlers and `/sitemap.xml` is empty.
- A public homepage returns `X-Robots-Tag: noindex, nofollow, noarchive`.
- A checkout POST and a registration POST return 503 with no order/user creation; no live Stripe or email credentials are configured.
- Production has its own app, database, storage, migrations, backups and release identity. Confirm Azure subscription remains active after free credits expire.

## Azure preparation status (28 September 2026)

- Created `rg-commerce-production-au` in Australia East with a monthly A$50 budget (`production-preview-50-aud`), forecast alert at A$40, actual-cost alert at A$50, sent to the account owner. Azure budgets notify but do not stop charges.
- Created `vnet-commerce-production-au` (`10.85.0.0/16`), the delegated PostgreSQL subnet (`10.85.1.0/27`), the delegated Container Apps subnet (`10.85.2.0/27`), and a linked private DNS zone `commerce-production.postgres.database.azure.com`. A VNet has no standing charge; the private DNS zone may incur a small charge.
- A separate Container Apps environment `cae-commerce-production-au` failed to create: `MaxNumberOfRegionalEnvironmentsInSubExceeded`. This free-trial subscription permits only one environment in Australia East, already occupied by staging. The Azure Quotas portal currently disables the adjustment request and links to subscription upgrade. Do not deploy production in the staging environment or create the database while the production app environment is blocked.
- Azure's PostgreSQL B1ms + 32 GiB estimate was USD 23.40/month in Australia East before currency conversion, networking, app compute, storage and tax. The free 750-hour B1ms grant is subscription-wide and staging already uses a B1ms. Reassess the entire production estimate against the A$50/month limit before provisioning billable resources. The A$276.73 free-trial credit expires 10 October 2026 and services will pause unless the account is upgraded.
- `production-preview` is a draft PR into `staging`; CI run 36404829676 passed. There is no production database, Container App, storage account, DNS binding, certificate or deployment yet.
