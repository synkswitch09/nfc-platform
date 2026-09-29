# Multi-brand / multi-store architecture

Status: accepted for incremental implementation on `develop`.

Baseline at commit `84ebaac` before schema changes: lint passed, TypeScript passed, runtime configuration validation passed, all 58 unit/security tests passed, and the Next.js production build completed successfully. The working tree was clean and matched `origin/develop`.

## Decision

Keep the existing modular monolith and evolve it into one host-resolved Next.js application backed by one PostgreSQL database and one shared commerce/operations core. A first-class `Store` owns each storefront's commercial data and a `StoreDomain` maps an allow-listed hostname and application environment to that store.

This is deliberately not a generic SaaS multi-tenant platform. Stores are created only by platform administrators, share one business backend, and are isolated at every query and mutation boundary. The design can later split a high-volume or legally distinct store into its own runtime without rewriting the domain model.

```text
validated request host
        |
        v
StoreDomain (environment + hostname)
        |
        v
Store context ---- theme / SEO / navigation / capabilities
        |
        +---- store-scoped catalogue, content, carts and orders
        |
        +---- shared identity and platform services
        |
        +---- optional NFC and manufacturing modules
```

## Alternatives considered

### Multiple cloned repositories

Rejected. Clones would immediately duplicate checkout, authentication, security fixes, Admin, CI/CD and infrastructure. Behaviour would drift and every new brand would multiply operational cost.

### Monorepo with one storefront application per brand

Deferred. Separate apps provide strong visual and deployment independence but would duplicate route composition and require at least one runtime/release per store. The current codebase has one mature storefront and one operator, so that cost is premature. Shared packages remain a future extraction option if storefronts later need materially different release cadences or frameworks.

### One application selected by untrusted request data

Rejected as stated. A single runtime is appropriate, but `storeId` from query strings, forms, JSON bodies or arbitrary forwarded headers is never authoritative. Public store context comes only from an exact `StoreDomain` allow-list lookup for the current `APP_ENV`; Admin mutations additionally require an authorised store scope.

### Selected: modular monolith with host-resolved stores

This has the lowest initial Azure cost, preserves Tapkin, keeps one migration/release path and enables real domain, theme, catalogue, content and SEO isolation. Logical isolation requires disciplined server-side scoping and tests; it is not the same as separate databases.

## Store and domain model

`Store` represents the commercial/customer-facing boundary. It contains lifecycle, identity, market defaults, structured theme/homepage settings, SEO defaults, social links and enabled capabilities. `DRAFT`, `HIDDEN` and `ARCHIVED` never delete history.

`StoreDomain` separates brand identity from deployment environment. A hostname is unique within an environment and one domain is canonical for each store/environment pair. Examples:

| Environment | Hostname | Store |
| --- | --- | --- |
| development | `localhost` | Tapkin |
| development | `home.localhost` | Home Demo |
| staging | `staging.tapkin.com.au` | Tapkin |
| production | `tapkin.com.au` | Tapkin |

Unknown hosts fail closed. Host lookup ignores a port, lowercases the hostname, rejects malformed hosts and never falls back to another store in staging/production. A controlled default store is allowed only for local development/builds.

Commercial availability and issued-service continuity remain different concerns. A hidden or archived store is removed from commerce surfaces, but its exact domain can continue resolving issued NFC service routes. Store, category and product status never changes an `NFCTag` status.

## Data ownership and uniqueness

The first migration adds Store relations, backfills all existing records to Tapkin, validates them, and only then makes required relations non-null. It preserves IDs, tag URLs, order numbers and history. Because historical orders did not record a trustworthy source domain or deployment environment, they are labelled `legacy-unrecorded` / `LEGACY`; only newly created orders receive an exact server-resolved snapshot.

- `ProductCategory` and `Product` are store-owned. Their slugs become unique per Store.
- `ProductVariant.sku` remains globally unique initially. Operations and manufacturing need an unambiguous SKU across the whole company.
- `Cart`, `Order`, `NFCTag`, NFC production batches and relevant audit events carry Store context.
- Product media derives its Store through Product and new object keys include environment and Store prefixes. Legacy object keys remain readable.
- User identity, OAuth accounts and password credentials are global platform data.

Indexes follow actual access patterns: Store plus status/order for storefront lists, Store plus slug for route resolution, Store plus creation date/status for Admin and orders. Redundant Store columns are added only where they enforce an important boundary or avoid unsafe relation traversal.

## Product strategy

For this phase, a `Product` is a store-owned sellable listing. This matches the existing schema and keeps category, copy, price, options, visibility and SEO together. Selling the same physical design in two stores creates two commercial Products with independently frozen order history.

The future sharing boundary should be a manufacturing definition, not the customer-facing Product. A later `ManufacturingDefinition` can hold STL/3MF references, print profile, bill of materials and revision, and can be referenced by Product variants from multiple Stores. This avoids coupling brand copy/pricing/SEO while still reusing one physical design. A generic `StoreListing` layer is therefore unnecessary until evidence shows that commercial listings themselves must be shared.

## Identity, customers and sessions

`User` remains the global identity. `StoreMembership` records the relationship between a User and Store, including store-local role and marketing-consent timestamp. Orders and owned products shown in a storefront are always filtered by the current Store.

Cookies remain host-only; unrelated brand domains do not share browser cookies. The same credentials or OAuth identity can establish a separate session on each store. Verification, password-reset and OAuth return URLs are built from a previously resolved, allow-listed Store origin. Arbitrary return URLs are rejected.

Current `ADMIN` users act as platform administrators. `STAFF` access is scoped through Store memberships. The safe evolution is:

- `CUSTOMER`: global identity with one or more StoreMembership relationships.
- `STAFF`: requires explicit Store staff scope.
- `ADMIN`: platform administrator during the first internal-operations phase.
- future `STORE_ADMIN`: represent through scoped membership rather than another global role.

Every store-owned Admin mutation checks both the role and Store scope. An All Stores view is read-only/aggregate unless a specific Store is selected. The selector navigates to the Store's allow-listed canonical domain instead of placing a client-controlled Store ID in a cookie or query string. Because sessions are host-only, the same identity establishes a separate session on each unrelated brand domain.

Store staff see only the selected Store's customer relationship, orders and owned products. Authentication methods and shared-identity suspension are Platform Admin concerns because changing them affects every Store session. Per-Store suspension can be added later to `StoreMembership` without weakening this boundary.

## Checkout, orders and payments

Checkout resolves Store server-side from the trusted request context. Submitted variant IDs must belong to that Store. The Order snapshots Store, source domain, environment, currency, product name, variant, SKU, price, tax-relevant values and personalisation. Guest claims match email, claim token and Store.

One Stripe account can serve all Stores initially. Store ID/slug is included in trusted Stripe metadata and is verified against the Order during webhook settlement. Store holds a non-secret payment profile key so a future deployment can map a Store to separate environment-held Stripe credentials without schema redesign. Stripe Connect is not introduced.

Transactional email accepts Store context and uses its name, support address, canonical origin and brand tokens. Message bodies and reset/verification destinations never derive from an arbitrary Host header.

## Storefront, theme and content

Shared components retain accessibility, forms, cart and commerce interaction. Store theme is validated structured data exposed as CSS custom properties: palette, typography style and radius. Header, hero and card variants are selected from a bounded allow-list rather than arbitrary HTML or CSS. Browser-local carts are namespaced by Store ID in addition to the browser origin.

Homepage content is a small ordered set of typed modules (hero, categories, featured products, editorial/trust and CTA). Category CMS remains structured and becomes Store-owned. This provides meaningful brand variation without a generic page builder or CSS forks.

## Capabilities and NFC continuity

Capabilities control navigation and creation workflows, not historical service availability. Initial capabilities include commerce, 3D printing and optional NFC/digital-profile modules. Stores without NFC do not see NFC Admin navigation or NFC product types.

Capability-specific Admin pages and mutations also fail closed when reached directly. Existing Tapkin-only editorial guides remain explicitly owned by Tapkin until a Store-owned editorial-content model is introduced; merely enabling NFC for a future Store must not publish Tapkin content there.

Every existing Tapkin tag retains its `publicTagId`, owner, profile and `/t/{publicTagId}` URL. The migration adds Tapkin Store context without regenerating credentials. Tag resolution is authorised by tag status/profile rules and exact Store-domain association; Store commerce status is ignored for an already issued service. Hiding Home Demo cannot affect Tapkin tags, and hiding Tapkin commerce cannot disable them.

## Manufacturing

NFC `ManufacturingBatch` remains the identity-generation/programming workflow. It is not renamed into generic manufacturing.

A generic `ManufacturingJob` is introduced incrementally from paid OrderItems and can track Store, item, quantity, status, priority, material/colour and timing fields only when currently known. Later entities can add versioned manufacturing definitions, printer profiles, material lots/spools, failures/reprints and QA without mixing sellable inventory with raw-material inventory.

## SEO, cache and observability

Canonical origin, metadata, Organization/WebSite/Product structured data, robots and sitemap are generated from current Store plus environment. Each sitemap queries only its Store. Development and staging remain noindex. Shared physical designs require independently written Store Product copy; no cross-domain canonical is used unless content is intentionally identical and reviewed.

Every cache key includes Store ID or hostname when output is Store-dependent. Request-local memoisation avoids repeated Store resolution without risking cross-request leakage. Logs include environment, request ID and Store slug where known, but never secrets or personal request bodies.

## Azure and storage implications

Initially one Azure Container App revision can bind multiple verified custom domains and serve every Store. One Container Apps Environment, PostgreSQL server/database, Blob account and environment-specific container are sufficient. Adding a Store normally adds DNS/certificate/OAuth redirect configuration, not another server.

Blob isolation uses private environment containers plus Store path prefixes (`store-slug/...`). This is low cost and supports intentional internal sharing through explicit records. Separate accounts/containers remain an option for legal or operational isolation.

A shared database backup restores all Stores together. Per-Store point-in-time restore is not promised; a logical Store export/import tool can be added when required. Production extraction to a separate database remains possible because every owned record has Store context.

## Incremental implementation

1. Add this ADR and baseline evidence.
2. Add Store/Domain/customer/scope schema using expand/backfill/constrain migration; migrate existing data to Tapkin.
3. Scope catalogue, category CMS, orders, media and audit data.
4. Resolve Store by validated host and render Store-specific settings/theme/SEO.
5. Add explicit Admin Store selector and scoped mutations.
6. Gate NFC navigation/creation by capability while preserving issued-tag resolution.
7. Add the minimal generic manufacturing job foundation.
8. Seed Home Demo in development only and prove isolation.
9. Audit IDOR, Host handling, OAuth/reset destinations, cache keys, SEO and performance.

Every stage must pass relevant tests before commit. Schema contraction and removal of legacy singleton settings are deferred until all environments have completed the expanded migration and a rollback window has passed.

## Tradeoffs and triggers to revisit

- Logical isolation has a larger blast radius than separate databases. Split a Store when legal boundaries, teams, restore objectives or load justify it.
- One runtime couples releases. Extract storefront apps into a monorepo when brands require materially different release cadence or frontend technology.
- A single Stripe account and business identity simplify the start but may not fit future accounting entities.
- Global identity does not mean cross-store staff visibility; permissions must remain scoped.
- Shared backups cannot restore one Store independently without a logical export workflow.
