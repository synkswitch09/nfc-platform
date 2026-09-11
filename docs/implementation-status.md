# Implementation status

## Implemented on `develop`

- Host-resolved multi-Store foundation with trusted domains per environment, Store lifecycle/capabilities, Store-specific themes/homepages/SEO, platform identity plus Store memberships, host-bound sessions and Store-scoped catalogue/content/orders/media/audit
- Separate Store administration contexts with domain-based selector, platform-admin All Stores metrics, Store branding/settings and capability-aware navigation; development-only Home Demo proves category/product/theme/SEO isolation without NFC
- Generic 3D-print `ManufacturingJob` queue created from paid order items, separated from Tapkin NFC identity batches and annotated when NFC-specific work is required
- Guest and account checkout with server-authoritative prices, inventory reservations, Stripe Checkout, signed/idempotent webhooks and secure post-purchase account claiming
- Password authentication, verified-email and reset flows, opaque database sessions, Google/Apple OIDC through `openid-client`, and safe verified-email account linking
- Customer dashboard with orders, printable receipts, tracking, saved Australian addresses, NFC activation, scan windows and profile management
- Pet, child, emergency, social, business, luggage, review and custom NFC profiles, including editable social links, secondary emergency contacts and business vCard download; accessories remain catalogue-only
- Commercial catalogue with independent category/product lifecycles, duplicate-as-draft, variants, inventory, pricing, personalisation fields, safe-delete rules, SEO preview and content-verified product media
- Structured category CMS for five distinct clean-URL landings, homepage/navigation/Shop visibility, themes, compositions, hero, benefits, use cases, steps, narrative sections, final CTA, accessible image text, FAQ and SEO without arbitrary HTML
- Operations console for dashboard metrics, product/category search and filters, inventory, orders, customers, detailed tag search, manufacturing batches, team roles, settings and audit history
- Per-unit NFC manufacturing states, permanent random public URLs, separate one-time activation secrets stored only as hashes, admin-only credential rotation with one-time disclosure, QR/CSV/print exports and scan diagnostics
- Configurable Australian shipping, AUD/GST presentation, metadata, canonical URLs, robots, sitemap, editorial guides, and Organization, WebSite, Product, Offer, Breadcrumb, ItemList, Article and legitimate FAQ structured data
- PostgreSQL migrations and constraints, Docker/NAS deployment, persistent media volume, health check, CI and database/media backup tooling
- CI-backed HTTP E2E coverage for guest purchase, post-purchase account, protected NFC management, Product Admin, credential rotation and continuity of active tags when categories/products leave sale

## External configuration before launch

- Register Google and Apple applications and place their secrets in the deployment secret store
- Configure Stripe live keys/webhook and a transactional email webhook
- Replace placeholder legal text with reviewed Australian terms/privacy content and complete a privacy impact assessment for child information
- Put TLS, alerting, encrypted off-device backups and a regular staging restore test in place
- Add distributed rate limiting if more than one app replica is deployed
- Complete dependency/container scanning, accessibility review, browser end-to-end tests and an independent penetration test
- Verify every real Store domain, OAuth return URI, transactional-email brand and Stripe flow in staging before enabling that Store in production

## Deliberately deferred

- Direct NFC-writer hardware integration. The manufacturing model and permanent URL format are ready for a future station, while current operations use QR/CSV/print output.
- Automated carrier APIs and Stripe refund initiation. Operations cannot mark a refund or manufacture an unpaid order without a real external action.
- Horizontal service decomposition. The modular monolith is intentionally retained until traffic justifies independent scaling.
- A generic Store creation wizard, shared physical `ManufacturingDefinition`, raw-material/spool inventory and per-Store logical backup/restore. The present model leaves explicit extension points without building an ERP or MES prematurely.
