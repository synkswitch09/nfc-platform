# Implementation status

## Implemented on `develop`

- Guest and account checkout with server-authoritative prices, inventory reservations, Stripe Checkout, signed/idempotent webhooks and secure post-purchase account claiming
- Password authentication, verified-email and reset flows, opaque database sessions, Google/Apple OIDC through `openid-client`, and safe verified-email account linking
- Customer dashboard with orders, printable receipts, tracking, saved Australian addresses, NFC activation and profile management
- Pet, child, emergency, social, business, luggage, review and custom NFC profiles; accessories remain catalogue-only
- Commercial catalogue with status, categories, variants, inventory, pricing, personalisation fields, SEO and content-verified product media
- Operations console for dashboard metrics, products, categories, inventory, orders, customers, tags, manufacturing batches, team roles, settings and audit history
- Per-unit NFC manufacturing states, permanent random public URLs, separate one-time activation secrets stored only as hashes, QR/CSV/print exports and scan diagnostics
- Configurable Australian shipping, AUD/GST presentation, metadata, canonical URLs, robots, sitemap, Product and ItemList structured data
- PostgreSQL migrations and constraints, Docker/NAS deployment, persistent media volume, health check, CI and database/media backup tooling

## External configuration before launch

- Register Google and Apple applications and place their secrets in the deployment secret store
- Configure Stripe live keys/webhook and a transactional email webhook
- Replace placeholder legal text with reviewed Australian terms/privacy content and complete a privacy impact assessment for child information
- Put TLS, alerting, encrypted off-device backups and a regular staging restore test in place
- Add distributed rate limiting if more than one app replica is deployed
- Complete dependency/container scanning, accessibility review, browser end-to-end tests and an independent penetration test

## Deliberately deferred

- Direct NFC-writer hardware integration. The manufacturing model and permanent URL format are ready for a future station, while current operations use QR/CSV/print output.
- Automated carrier APIs and Stripe refund initiation. Operations cannot mark a refund or manufacture an unpaid order without a real external action.
- Horizontal service decomposition. The modular monolith is intentionally retained until traffic justifies independent scaling.
