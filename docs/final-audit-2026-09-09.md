# Catalogue, content and NFC lifecycle audit — 9 September 2026

## Scope and branch protection

This phase was implemented exclusively on `develop`. No merge, commit or push was made to `main`. The public display brand is now **Tapkin** across navigation, account, checkout, administration, email text, SEO, seed data, documentation and operational scripts. Historical migrations that originally created `TapKind` defaults remain immutable; the new migration safely transforms existing records to Tapkin.

## Final architecture

| Domain | Purpose | Lifecycle | Effect on issued NFC tags |
|---|---|---|---|
| Category | Structured landing content, navigation, discovery, grouping and SEO | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED` plus per-surface visibility | None |
| Product | Sellable design, price, media, variants, inventory and personalisation | `DRAFT`, `ACTIVE`, `HIDDEN`, `OUT_OF_STOCK`, `ARCHIVED` plus Shop visibility | None |
| NFCTag | Durable physical/digital identity already manufactured or sold | `MANUFACTURED`, `UNCLAIMED`, `ACTIVE`, `LOST`, `DISABLED`, `REPLACED` | This lifecycle controls resolution |

The `/t/{publicTagId}` resolver fetches the tag and profile only. It deliberately does not join or test category/product commercial status. Active and lost profiles remain operational; disabled and replaced tags suppress profile data; manufactured/unclaimed tags offer activation. Checkout independently requires an active, Shop-visible product in a published category.

## Admin and content workflows

- **Content → Categories** creates and edits structured hero, benefits, steps, narrative blocks, FAQ, CTAs, display order, four public visibility surfaces and SEO metadata. There is no category hard-delete action.
- Category homepage cards, public navigation, Shop filters and category landings are database-driven. Every landing CTA defaults to the single filtered catalogue at `/shop?category={slug}`.
- **Catalog → Products** supports create, duplicate-as-draft, edit, category assignment, lifecycle actions, multiple variants/SKUs, AUD pricing/costs, inventory/backorders, typed personalisation, multiple uploaded images, primary/order/alt text and SEO.
- Product hard delete is ADMIN-only and allowed only without order items, issued tags, manufacturing batches or inventory movements. Otherwise Admin returns: “This product has historical data and cannot be permanently deleted. Archive it instead.”
- Product search covers name, slug and SKU with category, status and inventory filters, sort and pagination.
- **NFC → Tags** searches public ID, owner name/email, order number, product, SKU and batch, with lifecycle/category/product/batch and creation/activation date filters.
- Tag detail shows permanent URL/QR, product/category/variant, batch and manufacturing dates, owner/account, linked order when available, activation attempts/lock/version, scans, status controls and security audit events.

## Activation credential support

`Regenerate Activation Code` is available only to an ADMIN for an unclaimed unit. It requires a reason, support note and explicit confirmation that identity/order evidence was checked. A new high-entropy code replaces the stored HMAC hash atomically, increments its version, clears an activation lock and invalidates the previous credential immediately. The replacement is returned once; neither the code nor its hash is written to `AuditLog`.

## Security and data integrity review

- All new mutations enforce server-side role and same-origin checks and parse allow-listed Zod objects, preventing mass assignment.
- Structured CMS content is rendered as React text, never stored HTML; CMS CTA destinations permit safe internal paths only.
- Public redirect fields accept HTTP(S) only. JSON-LD escapes `<` before insertion.
- Image uploads verify declared MIME against file signature, read real PNG/JPEG/WebP dimensions, reject invalid or over-40-megapixel content, generate storage keys and retain dimensions/alt/order/primary metadata.
- OAuth transaction cookies now require exactly two segments and a canonical Base64URL HMAC signature, closing an intermittent non-canonical encoding acceptance found during the second review.
- Audit events cover category lifecycle, product creation/lifecycle/deletion, price/inventory, tag status, credential regeneration and role changes without storing activation secrets.

## SEO, catalogue and seed content

Five unique structured category experiences are seeded: Pet, Child Safety, Social Media, Business and Luggage/Objects. Eleven representative products demonstrate many-products-per-category. Published/indexable landings receive unique metadata, canonical URLs, OpenGraph data, breadcrumbs, ItemList and authored FAQ structured data. Hidden/archived landings are removed from discovery and resolve as non-public without affecting `/t/*`. Robots excludes admin, account, activation and public-tag identity URLs; the sitemap contains only public sellable/indexable content.

## Verification evidence

| Check | Result |
|---|---|
| Prisma schema validation/client generation | Passed; 34 models and 5 committed migrations |
| ESLint (`--max-warnings=0`) | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Vitest | 41 tests passed across 10 files; OAuth tamper test additionally repeated five times |
| Production build | Passed with Next.js 16.3.4/Webpack; 44 page routes and 34 API routes |
| Backup/restore shell syntax | Passed |
| Production dependency audit | Offline audit reported 0 vulnerabilities |
| Secret-pattern scan | No live Stripe/Google/private-key material found |
| Brand audit | Only immutable historical migration values and the explicit data-conversion migration still contain `TapKind`/`tapkind` |

The expanded HTTP E2E runner covers a real category landing and filtered Shop, credential regeneration/invalidated old code, owner management, active tag continuity across hidden/archived category and hidden/archived/out-of-stock product states, and disabled-tag privacy. This workspace has no Docker executable or PostgreSQL server, so the database migration and HTTP runner could not be executed locally; the CI workflow provisions PostgreSQL 17 and runs both after every push.

## Remaining release gates

1. Confirm the new migration and expanded HTTP E2E run in GitHub Actions and then repeat them in staging.
2. Perform desktop/mobile visual browser QA with representative category/product images and real uploaded media.
3. Configure live Stripe, Google, Apple and transactional email credentials in a secret manager and verify provider callbacks/webhooks.
4. Replace legal placeholders with Australian legal/privacy review, including a child-data privacy impact assessment and retention/consent decisions.
5. Run the real Docker/NAS stack, encrypted off-device backup/restore and reverse-proxy/TLS checks.
6. Add staff/admin MFA, centralized monitoring/alerts and distributed rate limiting before multi-instance operation.
7. Complete independent accessibility, penetration, dependency/container and disaster-recovery audits.
