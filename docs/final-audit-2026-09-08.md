# Final audit — 8 September 2026

## Scope and branch safety

The work was based on `main` commit `dd801183f5b4936ffddc1793c394d913fbc48ab5` and implemented exclusively on `develop`. No merge or new commit was made to `main`. The repository is a modular Next.js/TypeScript application backed by PostgreSQL through Prisma, with Stripe-hosted checkout and Docker/NAS deployment assets.

## Verification evidence

| Check | Result |
|---|---|
| ESLint, zero warnings | Passed |
| TypeScript `tsc --noEmit` | Passed |
| Vitest | 30 tests passed across 9 files |
| Integrated E2E | 52 assertions passed across required flows A–E, including signed and duplicate Stripe webhooks |
| Production build | Passed with Next.js 16.3.4 and Webpack |
| Prisma schema validation | Passed; 34 models and 4 committed migrations |
| Backup script shell syntax | Passed for backup, verification and restore scripts |
| Production dependency audit | Offline lockfile audit reported 0 vulnerabilities |
| Secret-pattern scan | No committed Stripe, GitHub or private-key material detected |
| Application inventory | 42 pages and 32 API routes |

The workspace did not provide a Docker daemon, so image build and Compose startup were not repeated locally. CI includes PostgreSQL, migration deployment, lint, type checking, tests, production build and integrated HTTP journeys. A provider-sandbox and visual browser run remains a staging release gate.

## Security and privacy review

- Prices, inventory and customisation charges are calculated on the server; Stripe events require signatures and are idempotently reconciled.
- Sessions and one-time claims are opaque and stored as hashes. Passwords use bcrypt. Administrative and ownership checks are performed server-side.
- NFC public identifiers are random 16-character human-safe values; activation codes are separate, HMAC-hashed, one-time credentials with throttling, lockout and audit events.
- OAuth uses Authorization Code Flow through `openid-client`, PKCE, signed state, nonce and provider-verified email before account linking.
- Child/emergency public models intentionally omit addresses, schools, exact birth dates, routines and historical location. Geolocation requires an explicit visitor action.
- Public scan analytics avoid raw IP storage, use coarse device/location fields, apply abuse limits and show only aggregate windows to owners.
- Uploads allow content-sniffed PNG, JPEG and WebP files up to 5 MB, use server-generated storage keys and persist outside the public source tree.
- State-changing browser routes enforce same origin. Security headers, noindex boundaries, structured request IDs, rate limits, audit logs and session revocation are present.

## Commerce and operations review

The marketplace covers browse/search, category and product landing pages, variants, stock policy, personalisation, cart, Australian shipping, guest checkout, confirmation, secure order claim and customer order history. Admin covers dashboard metrics, products, duplication, media, categories/FAQ, inventory adjustments, orders, tracking, customers, roles, settings, audit logs, tags and manufacturing.

Production batches create traceable per-unit records and expose activation credentials only in the immediate batch response/print/CSV workflow. Only credential hashes are persisted. Unit states support manufacturing through sale, activation, disablement and replacement. Direct hardware writing and automated carrier/refund APIs are deliberately outside this release.

## SEO, accessibility and performance review

Indexable surfaces have canonical metadata and clean URLs; private/account/admin/checkout/activation/tag surfaces are noindex. Sitemap and robots are dynamic. JSON-LD uses real catalogue/settings data and never invents reviews. Category FAQ markup is emitted only when authored FAQ is visible. The `/guides` architecture includes one substantive article rather than bulk low-quality pages.

The UI uses semantic landmarks, labels, keyboard-native controls, visible status text, responsive layouts, descriptive image alt text and mobile-first public safety actions. Database indexes cover main operational lookups; public scan writes are non-blocking, images have explicit dimensions and expensive admin aggregates are bounded.

## Release gates and residual risk

1. Configure live Stripe, transactional email, Google and Apple credentials in a secret manager and verify callbacks/webhooks in staging.
2. Replace legal placeholders with Australian legal advice and complete a privacy impact assessment for child information.
3. Run the full Docker Compose stack, migrations and critical browser journeys against a staging PostgreSQL database.
4. Add staff MFA, encrypted off-device backups, alerting, centralized logs and distributed rate limiting before multi-replica deployment.
5. Move media to a managed scanning/transform pipeline before accepting files from less-trusted operators.
6. Complete independent accessibility, penetration, dependency/container and disaster-recovery reviews before launch.
