# Architecture

## Runtime

The platform is a host-resolved modular monolith. Next.js renders Store-specific public websites, dashboards and optional NFC tag pages; Route Handlers provide authenticated mutations and Stripe webhooks. Prisma is the only data-access layer and PostgreSQL is the source of truth. One runtime and database serve multiple logically isolated Stores, keeping Azure cost and operations low while preserving a clean extraction path if a Store later requires independent deployment.

## Core flow

1. Manufacturing creates a cryptographically random `publicTagId` and an independent activation code.
2. Only `APP_URL/t/{publicTagId}` is encoded in the NTAG213 and matching QR.
3. The activation code is HMAC-SHA-256 hashed with a server-side pepper and shown only on the production result.
4. Activation checks per-IP and per-account limits, verifies the code in constant time, then claims the tag atomically.
5. A public scan resolves the tag status and profile. Direct social redirects accept only HTTP(S) destinations.
6. Scan analytics retain a time bucket, broad device class and coarse location supplied by trusted infrastructure—never a raw IP address.

## Data model

`ProductCategory`, `Product` and `NFCTag` have deliberately separate lifecycles:

- A category controls commercial content, navigation, landing-page SEO and catalogue discovery. `DRAFT`, `HIDDEN` and `ARCHIVED` categories are not public, but remain available to Admin and retain historical relations.
- A product controls whether a new unit can be sold. Only `ACTIVE` products with `shopVisible=true` inside a published category enter Shop or checkout. Hidden, out-of-stock and archived products retain orders, manufacturing records and issued tags.
- An `NFCTag` is a durable issued identity. Its resolver uses only the tag's own status, ownership/profile visibility and security rules; it does not query category or product availability. `ACTIVE` and `LOST` profiles resolve, `DISABLED` and `REPLACED` expose no profile, and unclaimed units enter activation.

`TagProfile` holds shared public controls and has a one-to-one relation with exactly one type-specific profile. Emergency products reuse the constrained emergency model; review and custom link products reuse the validated link model. Accessories intentionally have no NFC profile. Orders snapshot unit prices, SKUs, product types, addresses and personalisation; Stripe records are separate and webhook events are idempotent. An optional `OrderItem` link on `NFCTag` supports traceability without making order history a runtime dependency of the public resolver.

Category landing content is structured JSON validated by Zod (benefits, use cases, steps, narrative sections and FAQ), rather than arbitrary HTML. Public CTA paths are restricted to internal URLs. The same category record controls homepage, navigation, Shop-filter and landing visibility independently. Themes and reusable compositions are CMS-selected presentation data, never category-name conditions. Clean root slugs are protected from application-route collisions, and historical slugs are retained for permanent SEO redirects.

`Store` owns commercial catalogue, category content, orders, domains, theme, SEO and enabled capabilities. `User` is a shared identity while `StoreMembership` is the Store-local customer/staff relationship. Sessions remain host-bound and carry Store ID. A validated `StoreDomain` plus deployment environment resolves every public request; Store IDs submitted by clients are never authoritative. See the detailed [multi-brand decision](architecture/multi-brand.md).

Generic `ManufacturingJob` records are created idempotently per paid order item for Stores with `PRINT_3D`. They track the current print/finishing/QA/packing queue and whether NFC work is also required. `ManufacturingBatch` remains the separate Tapkin NFC identity generation/programming workflow; sellable inventory and future raw-material/spool inventory remain different concepts.

Catalogue and category landing media is referenced in PostgreSQL but stored in a durable private volume and served through a content-type-controlled, Store-scoped route. Uploads are checked by content signature, decoded dimensions and pixel limits; product metadata records primary image and ordering while category image records retain category ownership. This keeps the first NAS deployment self-contained while preserving a clean migration path to a resizing/scanning S3-compatible pipeline.

## Scale path

- Cache active public tag records briefly at the edge and invalidate on profile/status updates.
- Move scan writes to a queue and aggregate daily counts when traffic grows.
- Replace database-backed security events with Redis-compatible distributed rate limiting for multiple app replicas.
- Store validated/resized images in S3-compatible storage.
- Split checkout, manufacturing or analytics into services only when independent scaling justifies it.
