# Shipping, fulfilment and modular commerce content

Status: accepted for incremental implementation on `develop`.

## Boundaries

Shipping, fulfilment, print automation and landing content are scoped by `storeId`. The storefront never supplies an authoritative store identifier: the validated host resolves the Store, while Admin mutations use the authenticated Admin store context. Catalog visibility and Store commerce status do not control issued NFC tag operability.

## Shipping flow

1. The shopper supplies an Australian destination and the current cart.
2. The server reloads sellable variants for the resolved Store, validates the Basic/Personalised choice and selected option-to-variant mapping, then calculates packed dimensions/weight.
3. A `ShippingProvider` adapter returns eligible services. `MANUAL` provides the production-safe fallback and `MOCK` supports local end-to-end testing.
4. The server persists a short-lived quote with hashed opaque token plus cart and destination hashes.
5. Checkout must consume that exact quote atomically. Price, Store, cart, address and expiry are revalidated before the Order is created.
6. Order and OrderItem records freeze service, origin, every packaging profile used, dimensions, product selections, the Basic/Personalised choice and custom-input snapshots so later catalog edits cannot rewrite history.

Variant packaging and dimensions override product defaults; product packaging overrides the Store fallback. Lines using different packages are packed independently. Package-specific flat rates are eligible only when the whole quote uses that package; mixed-package orders require a generic configured rate or a future live-provider response. Inactive providers and providers without rate support are excluded, and package weight limits fail closed.

`ShippingProviderKind.AUSTRALIA_POST` is an integration seam, not a pretend live adapter. Live rates and labels require approved credentials and an account/contract supported by Australia Post. Their current Shipping and Tracking API supports creating shipments, labels and tracking; Australia Post states that the integration requires an eParcel or StarTrack contract. See:

- https://developers.auspost.com.au/apis/shipping-and-tracking/getting-started
- https://developers.auspost.com.au/apis/shipping-and-tracking/reference
- https://auspost.com.au/integrate-shipping-and-tracking-apis

The initial commercial path is therefore configurable manual/MyPost Business rates. The provider interface preserves a future eParcel adapter without coupling checkout to Australia Post request formats.

## Fulfilment and labels

Only an order in `READY_TO_SHIP` may create a shipment. Shipment creation is idempotent for an existing usable label. A provider creates a label and tracking identifier; the label is stored through the existing private object-storage abstraction. Creating or printing a label does not mark the order as shipped. Shipping remains an explicit audited action.

The explicit `SHIPPED` transition moves any label-ready Shipment to `IN_TRANSIT` with the same tracking snapshot. `DELIVERED` similarly stamps the Shipment as delivered. This keeps the customer-facing Order lifecycle and carrier/label record consistent without allowing a printer response to dispatch an order.

`PrintJob` is a durable queue. A local Tapkin Print Agent authenticates with a one-time-issued opaque credential whose hash is stored. It claims one job with a short lease, downloads the label through an authenticated endpoint, invokes the configured printer without a shell, and reports success or failure. Reprints always create a new audited queue job.

## Content model

`LandingPageSection` is a typed, ordered category child record rather than arbitrary HTML. The supported registry covers hero, badges, benefits, steps, product showcase, feature/media stories, FAQ, CTA, product/category grids, trust and stats. Admin may add, edit, hide/show, reorder, duplicate and remove sections. Public rendering validates stored JSON and escapes text; CTA destinations must be safe internal paths.

The category editor keeps identity, lifecycle, homepage-card, visibility and SEO settings separate from landing content. Existing legacy landing fields remain stored for rollback compatibility and continue to render only when a category has no modular sections; they are not exposed as a second content editor.

Legacy category JSON remains readable as a fallback during migration. Seed/upsert migrates the five Tapkin category experiences into section records without changing their stable slugs or product/tag relationships.

## Product configuration

- Product and variant physical fields drive shipping; variant overrides take precedence.
- Packaging is Store-scoped and reusable.
- Colour option values may carry accessible colour/image swatches.
- Product images may be associated with an option value, while variants may keep a direct primary image.
- The storefront gallery prioritises the selected variant image, then images associated with the selected colour, then generic product images.
- `PersonalisationMode` separates `NONE`, `OPTIONAL` and `REQUIRED` from NFC capability. `OPTIONAL` exposes distinct Basic and Personalised purchases; `NONE` and `REQUIRED` are enforced server-side. NFC is a Store/product workflow concern, not proof that a physical product is personalised.
- Selection options remain available to Basic purchases. Custom text/checkbox/image work is accepted only for Personalised purchases. Image work is recorded as an operations follow-up until a dedicated customer-upload workflow is introduced.
- Cart quote hashes and Orders snapshot the choice, chosen option values and normalised custom details. Manufacturing sees those immutable OrderItem snapshots and still derives NFC requirements independently from Store capability and product type.

## Security and isolation

- All mutable resource relationships are revalidated against the current Store.
- Client totals, provider keys, package IDs, image/variant associations and `storeId` values are never trusted.
- Product option-value IDs are preserved during Admin edits so existing image associations cannot silently move; every image, variant, option value and package relationship is checked against the authenticated Store and product.
- Quote and print-agent secrets are stored only as hashes and never included in audit metadata.
- Label documents stay private and require Admin session or a valid leased print job.
- Rate/provider failure falls back only to explicitly configured manual rates; checkout fails closed when no eligible service exists.

## Operational path

Start with manual rates and mock labels in development. Configure real origins, packages and zones per Store. Run the Print Agent under a dedicated OS account with its one-time token kept outside the web process; define the print executable and argument array explicitly. When the business qualifies for eParcel, implement the Australia Post adapter behind the existing provider contract, verify address/rate/shipment/label/tracking APIs in staging, then enable it Store-by-Store. Keep manual rates enabled as an intentional fallback and monitor quote/label failure rates.
