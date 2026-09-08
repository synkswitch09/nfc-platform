# TapKind NFC Platform

Production-oriented MVP for an Australian business selling configurable physical NFC products. Each NTAG213 stores only one short, random public URL (`/t/{publicTagId}`); customer and emergency data remain in PostgreSQL and can be changed without rewriting the tag.

## Included

- Mobile-first public site, product catalogue and Stripe Checkout hand-off in AUD
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
3. Run `npm ci`, `npm run db:deploy`, `npm run db:seed`, then `npm run dev`. Prisma Client is generated automatically during installation.
4. Open `http://localhost:3000`.

To create the first local administrator, pass `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` only to `npm run db:seed`. The password must use 12+ characters with uppercase, lowercase, and a number. The development-admin mechanism refuses to run in production. Do not add these values to `.env` or commit real credentials.

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
docker compose exec app npm run db:seed
```

Terminate TLS at a trusted reverse proxy (for example Caddy, Traefik or a NAS proxy), set `APP_URL` to the public HTTPS origin, and set `TRUST_PROXY=true` only when direct access to the app port is blocked and the proxy overwrites forwarded-client headers. PostgreSQL is bound only to host loopback for local administration. Back up both the `postgres_data` and `product_uploads` volumes, and test restores regularly.

Product uploads accept content-verified PNG, JPEG and WebP files up to 5 MB. The Docker deployment persists them in `product_uploads`; a non-container deployment can set `UPLOAD_DIR` to a durable private directory. Uploaded originals must be included in the backup and restore plan.

## Stripe

Add Stripe secret keys and forward the `checkout.session.completed` webhook to `/api/stripe/webhook`. The server obtains all prices from PostgreSQL and never accepts a client-supplied price. Card data is entered on Stripe Checkout and is never stored by this application.

## Google and Apple login

Social login is optional. Set the corresponding client ID and secret, then register these exact callbacks with the providers:

- `https://your-domain.example/api/auth/oauth/google/callback`
- `https://your-domain.example/api/auth/oauth/apple/callback`

For Apple, `APPLE_CLIENT_SECRET` is the signed client-secret JWT generated from your Apple Developer key; rotate it before its expiry. OAuth accounts are linked to an existing user only when the provider cryptographically confirms the same email. The flow validates state, nonce, PKCE, signature, issuer, audience and expiry.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run lint` | Static linting |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Security and commerce tests |
| `npm run db:migrate` | Create a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Upsert the starter catalogue |

## Launch gates

Before accepting live customers: connect transactional email for verification/reset flows; replace legal placeholders with Australian legal advice; use managed object storage and image scanning for uploads; configure distributed rate limiting if the app runs across multiple instances; configure backups, monitoring and alerting; and complete an independent security/privacy review, especially for child profiles.

See [architecture](docs/architecture.md), [security](docs/security.md), [implementation status](docs/implementation-status.md), the [final audit](docs/final-audit-2026-09-08.md), and the [NAS operations runbook](docs/nas-operations.md).
