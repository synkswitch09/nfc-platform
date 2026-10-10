# Phase 4 — store measurement and Meta catalog

Implemented for Tapkin and Kosykin independently. Develop and staging never load provider scripts, submit provider events or serve the production catalog, even with switches enabled. Existing optional integration settings are preserved; new switches default off. No production test orders, tickets or emails are created by deployment.

## Activate each store

Open **CMS → Store settings → Checkout, privacy & integrations**. Each store must have distinct GA4, Clarity, Meta dataset and catalog IDs. CMS stores public IDs and switches; credentials stay on the server.

1. **Google Analytics 4:** create/select a property for this brand, create its Web stream with the production domain and currency AUD. Copy its `G-…` ID. In the stream's Measurement Protocol API secrets section, create a secret. Save the public measurement ID in the CMS, then configure the matching ID and secret in the Azure JSON below. Enable GA4 in the CMS.
2. **Clarity:** create/select one project for this brand's production domain. Copy the project ID (not the full installation script) into the CMS. In Clarity settings, require cookie consent and use strict masking. Enable Clarity in the CMS. No Azure credential is required. This implementation records only anonymous home/shop/FAQ/legal pages, masks all text, and excludes product personalizers, cart, checkout, accounts, orders, tickets, admin and NFC profiles. Query/hash-bearing pages and private referrers are excluded. Recorded pages use full-document navigation to unload the recorder at private boundaries. Do not enable Clarity for a site targeting under-18 users.
3. **Meta Pixel:** in Events Manager create/select this brand's Web dataset/pixel, associate the production domain and verify ownership using Meta's own domain-verification workflow. Copy the numeric dataset ID into the CMS. Enable Pixel if browser measurement is desired. No access token is exposed in the CMS or frontend. Disable automatic advanced matching and automatic event detection in Events Manager: this integration sends explicit events only and deliberately excludes customer/contact data.
4. **Conversions API:** in the same dataset's Settings, choose direct Conversions API integration and generate an access token with access to that dataset. Put the dataset ID and token in the Azure JSON below. Enable CAPI in the CMS. The ID must match the CMS Pixel/dataset ID. Browser and server events use the same event name and event ID; purchases use `purchase:<internal UUID>`. No email, name, telephone, address, IP or personalised text is submitted. CAPI uses an anonymous hashed external ID, the consenting browser's user agent and validated Meta cookies when present. This privacy choice may reduce Meta match quality compared with advanced matching.
5. **Catalog:** create/select one ecommerce catalog per brand in Commerce Manager. Copy its numeric ID into the CMS and enable the catalog feed. Add a scheduled data feed using the **Production feed URL** displayed in the CMS. Choose a complete refresh/replacement schedule (hourly or daily), rather than an update-only import, so unpublished/deleted variants disappear at the next import. Associate this brand's dataset with its catalog. No Meta Catalog API token is needed: Meta fetches the current complete CSV automatically. Serving a feed alone does not create the external catalog or its import schedule.

### Azure credentials

The deployment provisioner adds these variables, **empty and without a secret reference if no credential is available**, in staging and production. Never paste real tokens into source control or chat.

`ANALYTICS_GA4_STORES`:

```json
{
  "tapkin": {"measurementId": "G-YOURTAPKINID", "apiSecret": "YOUR_TAPKIN_SECRET"},
  "kosykin": {"measurementId": "G-YOURKOSYKINID", "apiSecret": "YOUR_KOSYKIN_SECRET"}
}
```

`META_CONVERSIONS_STORES`:

```json
{
  "tapkin": {"pixelId": "YOUR_TAPKIN_NUMERIC_ID", "accessToken": "YOUR_TAPKIN_CAPI_TOKEN"},
  "kosykin": {"pixelId": "YOUR_KOSYKIN_NUMERIC_ID", "accessToken": "YOUR_KOSYKIN_CAPI_TOKEN"}
}
```

Omit brands not yet configured. An empty variable is valid; placeholder values should never be stored as if they were real credentials. Recommended Azure secret names: `analytics-ga4-stores` and `meta-conversions-stores`; reference them from their matching environment variables after saving the complete JSON. Staging remains inert even if credentials are supplied; preferably leave its analytics/advertising variables empty. The existing authenticated order worker sends queued events every five minutes. No new worker/resource is required.

## Event and data rules

- `page_view`: allowlisted public path only, no query/hash or referrer; no private page URLs.
- `view_item`: selected/default active variant catalog ID; current server price.
- `add_to_cart`, `begin_checkout`: validated variant IDs, quantities and base option prices. Optional personalisation surcharge is omitted at these browsing stages; settled purchases use actual paid prices.
- `personalizer_interaction`: product UUID, action and field category only; never its typed value or design.
- `purchase`: created transactionally when payment settlement succeeds, only when checkout had a store-bound consent session. Does not depend on returning from Stripe. GA4 value is merchandise after discount; shipping is separate. Meta value includes shipping. Owned success pages can dispatch the matching browser event, once admitted by a durable Pixel record; server and browser share the same ID. An uncertain browser response can lose its Pixel event, but the consented CAPI purchase remains queued. Purchases are not retroactively backfilled for old orders or newly accepted consent.
- `refund`: created once per provider-confirmed refund, including partial refunds, with its original order ID and confirmed amount. GA4 only; Meta has no standard ecommerce Refund event here. Refunds require the original analytics consent session still to be active and configured.
- Provider rows are unique by store/provider/event key, leased atomically and checked again for consent, expiry, credential/ID match and enabled switches before submission. Meta retries retain the ID within 46 hours; GA4 transport/5xx ambiguity is marked `REVIEW_REQUIRED` rather than blindly repeated. Provider acceptance is not proof of report ingestion. There is no claim of perfect external exactly-once delivery.
- Privacy controls have independent analytics and advertising choices, default denied, plus reject optional and save choices. Consent withdrawal updates the anonymous server session, disables pending delivery, removes first-party optional cookies and unloads Clarity. A provider cannot be made to retract a request already sent before withdrawal; offline withdrawal becomes effective for pending server events when the request reaches the server.
- Anonymous sessions and their queued deliveries are retained at most 90 days (bounded by the consent expiry), then deleted by the worker; order links become null without deleting order/accounting records. GA4 session IDs renew after 30 minutes of inactivity.
- Pixel SDK runs only inside an empty same-origin measurement document with automatic configuration disabled, never inside checkout/order/profile/ticket DOM. Provider identifiers/tokens from private URLs are not passed to it. Frame admission requires current advertising consent and production settings.

## Catalog rules

The production endpoint `/api/meta/catalog` is public, contains only currently public sale items and returns 404 while disabled. A full feed uses active/shop-visible products in a published category from the current store, active variants, stable variant UUID `id`, product UUID `item_group_id`, valid minimum option price, public product link selecting the variant, public image, brand/colour/size/material and stock or made-to-order availability. Manufacturing pauses and shared capacity affect made-to-order availability. A product without a valid price or an HTTPS image without credentials/query tokens is omitted and counted in the CMS status view. There are no customer uploads, order tokens or private media links in the feed. New products/changes arrive when Meta next imports the feed, not instantly at every CMS save.

## Review after activation

CMS → Store settings → **View measurement delivery status** shows readiness, feed count/omissions and sanitized provider statuses. Use GA4 Realtime and Meta Events Manager/Test Events to confirm the actual provider setup. Check with consent denied, analytics only, advertising only and both, then revoke consent. Confirm no recordings from excluded pages. Check Meta catalog Diagnostics, images, variant links, prices and removal of a deliberately unpublished test listing. Use disposable data and separate test integrations when conducting purchases; never point staging at live reporting. A provider rejecting its credential is shown as failed and does not interrupt checkout, shipping or support.

## References

- https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
- https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2
- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api
- https://developers.facebook.com/documentation/ads-commerce/conversions-api
- https://github.com/facebook/facebook-python-business-sdk
- https://github.com/facebookarchive/Facebook-Server-Side-API-Swagger
- https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields
