# Multi-brand commerce platform · Tapkin

Production-oriented shared commerce platform for specialised 3D-printed product Stores. Tapkin is the first public Store and adds NFC, QR and digital-profile capabilities. Each Tapkin NTAG213 stores only one short, random public URL (`/t/{publicTagId}`); customer and emergency data remain in PostgreSQL and can be changed without rewriting the tag.

## Included

- Mobile-first public site, product catalogue and Stripe Checkout hand-off in AUD
- Store-scoped shipping quotes, fulfilment labels, tracking and a leased thermal-print queue
- Modular category landing pages plus colour-aware product galleries and Basic/Personalised purchases
- Password authentication with hashed sessions, secure cookies and role-based access
- Atomic tag activation with a separate high-entropy activation code
- Public resolver for pet, child/emergency, social, business and luggage tags
- Owner-only profile editing, QR generation, status controls and scan totals
- Admin production batches of up to 100 NFC URLs, activation codes and QR codes
- Privacy-minimised scan analytics and audit records
- PostgreSQL/Prisma model, Docker Compose, health check, tests and GitHub Actions

## Local setup

1. Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD`, use the same value inside `DATABASE_URL`, and replace both application secrets with independent random values of at least 32 characters.
2. Start PostgreSQL with `docker compose up -d db`, or point `DATABASE_URL` at an existing PostgreSQL instance.
3. Run `npm ci`, `npm run db:deploy`, `npm run db:seed`, then `npm run dev`. Prisma Client is generated automatically during installation. `APP_ENV=development` is the safe local default.
4. Open Tapkin at `http://localhost:3000`. After seeding, Home Demo is available only in development at `http://home.localhost:3000` and proves theme, catalogue, category, SEO and capability isolation without NFC.

To create the first local administrator, pass `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` only to `npm run db:seed`. The password must use 12+ characters with uppercase, lowercase, and a number. The development-admin mechanism refuses to run in staging and production. Do not add these values to `.env` or commit real credentials.

PowerShell:

```powershell
$env:DEV_ADMIN_EMAIL="admin@example.com"
$env:DEV_ADMIN_PASSWORD="replace-with-a-strong-local-password"
npm run db:seed
Remove-Item Env:DEV_ADMIN_EMAIL, Env:DEV_ADMIN_PASSWORD
```

macOS/Linux:

```bash
DEV_ADMIN_EMAIL=admin@example.com DEV_ADMIN_PASSWORD='replace-with-a-strong-local-password' npm run db:seed
```

Then open `/login` with those credentials and visit `/admin`. Re-running the seed updates the same local account instead of creating duplicates.

## Docker / NAS

Create a private `.env` containing `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ACTIVATION_PEPPER`, `APP_URL` and optional Stripe keys, then run:

```bash
docker compose up -d --build
docker compose --profile tools run --rm seed
```

Terminate TLS at a trusted reverse proxy (for example Caddy, Traefik or a NAS proxy), set `APP_URL` to the public HTTPS origin, and set `TRUST_PROXY=true` only when direct access to the app port is blocked and the proxy overwrites forwarded-client headers. PostgreSQL is bound only to host loopback for local administration. Back up both the `postgres_data` and `product_uploads` volumes, and test restores regularly.

Product and category landing uploads accept content-verified PNG, JPEG and WebP files up to 5 MB. Category editors can upload directly from the Homepage card, SEO social image and modular landing section controls; the saved `/api/media/...` URL is Store-scoped and does not require a public image host. Local Docker persists uploads in `product_uploads`; staging and production require the Azure Blob provider (or a future provider implementing the same interface), because container filesystems are ephemeral. Uploaded originals must be included in the backup and restore plan.

The production runtime image is non-root and does not run migrations. Compose and cloud releases use the dedicated `migrator` target once before starting/updating the app. Health endpoints are `/api/health/live` and `/api/health/ready`; `/api/health` remains a readiness-compatible alias.

## Promote storefront content

Use **Admin → Store settings → Storefront releases** to avoid rebuilding the catalogue and CMS manually in another environment. Download a release from Development, then upload it in the destination, preview the create/update counts and confirm the import. A release includes Store visual settings, categories, products/variants/options, modular pages/FAQs and uploaded media (up to 25 MB total). Media is copied into the destination storage and `/api/media/...` references are updated.

Releases deliberately exclude customers, accounts, sessions, carts, orders, payments, NFC tags, manufacturing batches, print jobs and credentials. Imports create or update by category/page slug and product SKU; they never remove content that is absent from the release. Do not run `db:seed` after **Start fresh**: reset already creates the initial Pets catalog, while seed is only for bootstrapping an empty development database.

## Stripe

Add Stripe secret keys and forward the `checkout.session.completed` webhook to `/api/stripe/webhook`. The server obtains all prices from PostgreSQL and never accepts a client-supplied price. Card data is entered on Stripe Checkout and is never stored by this application.

## Etsy marketplace

Etsy is an optional sales channel. This Store remains the source of truth for stock: available inventory is `on hand − reserved`, so an unpaid checkout temporarily reduces the quantity sent to Etsy and cancellation restores it. This avoids selling the same tracked unit in both channels.

1. Create an Etsy Open API v3 app and configure `ETSY_API_KEY` and `ETSY_SHARED_SECRET` as deployment secrets.
2. Register the exact HTTPS callback URL: `https://your-domain.example/api/admin/etsy/callback`. Etsy rejects callback URLs that differ even by a trailing slash.
3. In **Admin → Etsy**, connect the seller account, then create/configure the physical listing and its variations in Etsy. Link it to a local product with its Etsy listing ID only when all active local SKUs match the Etsy SKUs exactly.
4. Set a separate random `ETSY_SYNC_SECRET` and call `POST /api/integrations/etsy/sync` with `Authorization: Bearer <ETSY_SYNC_SECRET>` every minute from your host scheduler. You can also use **Sync now** in Admin.

Credentials and OAuth tokens never reach the browser; tokens are encrypted at rest using the deployment session secret. Each scheduled run does two things: it updates quantity, price and enabled state for explicitly linked listings, and imports paid, non-cancelled Etsy receipts as paid Tapkin orders. An imported receipt is recorded exactly once, decrements the matching local SKU, creates its manufacturing jobs, and triggers the paid-order notification. It stops safely if a receipt contains an unlinked Etsy listing, an unknown SKU, a currency mismatch, or insufficient no-backorder stock; correct the mapping/stock and run the sync again.

The integration deliberately does not create Etsy listings, mark Etsy receipts as shipped, or push Tapkin tracking back to Etsy yet: those operations require seller-specific taxonomy, shipping and processing-profile decisions. The Etsy API itself requires an app API key on every request plus OAuth/PKCE for seller-authorised writes. [Etsy authentication documentation](https://developers.etsy.com/documentation/essentials/authentication/) and [Etsy receipt documentation](https://developers.etsy.com/documentation/reference/) describe those requirements.

## Google and Apple login

Social login is optional. Set the corresponding client ID and secret, then register these exact callbacks with the providers:

- `https://your-domain.example/api/auth/oauth/google/callback`
- `https://your-domain.example/api/auth/oauth/apple/callback`

For Apple, `APPLE_CLIENT_SECRET` is the signed client-secret JWT generated from your Apple Developer key; rotate it before its expiry. OAuth accounts are linked to an existing user only when the provider cryptographically confirms the same email. The flow validates state, nonce, PKCE, signature, issuer, audience and expiry.

## Shipping and Tapkin Print Agent

Admin Shipping shows the current Store's origins, packaging, zones, configured rates, providers and print queue. Checkout obtains a short-lived server quote for the exact Store, cart, personalisation choice and Australian address; it never accepts a client shipping price. Manual rates are the launch-safe MyPost Business path. The Australia Post provider kind is reserved for a future approved eParcel Shipping and Tracking API integration.

For automatic thermal printing, register an agent in Admin Shipping and copy the one-time token immediately. On the workstation connected to the printer, set `TAPKIN_PRINT_AGENT_URL`, `TAPKIN_PRINT_AGENT_TOKEN`, `TAPKIN_PRINT_COMMAND` and `TAPKIN_PRINT_ARGS_JSON`, then run `npm run print-agent`. Arguments are passed directly without a shell; use `{file}` for the temporary label path and `{printer}` for `TAPKIN_PRINTER_NAME`. The agent leases one Store-scoped job at a time, removes the temporary PDF after printing and reports the result to the durable queue.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run lint` | Static linting |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Security and commerce tests |
| `npm run test:e2e` | Required HTTP business journeys against a disposable database |
| `npm run config:check` | Validate environment configuration without printing secrets |
| `npm run smoke` | Verify a deployed environment using `SMOKE_BASE_URL` |
| `npm run db:migrate` | Create a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Upsert the starter catalogue |

## Launch gates

Before accepting live customers: connect transactional email for verification/reset flows; replace legal placeholders with Australian legal advice; add malware/image scanning appropriate to the upload risk; configure backups, monitoring and alerting; and complete an independent security/privacy review, especially for child profiles.

See the [shipping/content architecture](docs/architecture/shipping-content-platform.md), [multi-brand architecture decision](docs/architecture/multi-brand.md), [Azure deployment runbook](docs/deployment-azure.md), [architecture](docs/architecture.md), [category content operations](docs/category-content.md), [security](docs/security.md), [implementation status](docs/implementation-status.md), [E2E testing](docs/e2e-testing.md), the [category experience audit](docs/final-audit-2026-09-10.md), the [catalogue/content/NFC audit](docs/final-audit-2026-09-09.md), the [original platform audit](docs/final-audit-2026-09-08.md), and the [NAS operations runbook](docs/nas-operations.md).

For the end-to-end operational explanation in Spanish, including module setup and Development/Staging/Production procedures, see the [operational and deployment manual](docs/manual-operativo-despliegue.md).
