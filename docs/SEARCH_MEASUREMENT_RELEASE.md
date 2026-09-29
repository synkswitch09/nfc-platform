# Block I: search ownership and limited commerce measurement

## Domain and sitemap acceptance

1. After the G release checks and migrations pass, confirm the production host and canonical for each Store separately. Keep staging excluded from indexing.
2. Add each production domain as a domain property in Google Search Console and as a site in Bing Webmaster Tools. Prefer the DNS record each console supplies; perform DNS changes in the domain provider and confirm ownership in the console. The application does not need a verification script or arbitrary HTML token.
3. Run `node scripts/check-search-readiness.mjs --origin=https://<production-domain>` for **each** store. This checks sitemap response, same-origin locations, HTTP 200, canonical alignment, noindex and the sitemap declaration in robots.txt. Inspect representative hidden/archived URLs and product variants manually too. An HTTP 200 response from a submission does not establish indexing.
4. Submit the checked `/sitemap.xml` separately in each property's sitemap interface. Record property, owner, submission date, status, discovered URLs and errors. No submissions or DNS changes have been made by this code release.

## GA4 event configuration

Create one GA4 web stream for each production Store. Obtain its Measurement ID and Measurement Protocol API secret. Set the server-only environment variable `ANALYTICS_GA4_STORES` as JSON keyed by the Store slug, for example `{"tapkin":{"measurementId":"G-ABCDEF1234","apiSecret":"<secret>"}}`. Never use a shared `ANALYTICS_ID`, put secrets in `NEXT_PUBLIC_*`, or paste a tag script into CMS content. Missing configuration leaves analytics off; development and staging do not forward events.

On the relevant storefront, a visitor may allow or decline analytics. Only after allowing, the browser sends `view_item`, `begin_checkout` and `purchase` to the same-origin endpoint. The server checks Store ownership, product and paid order before forwarding allowlisted GA4 Measurement Protocol fields. It does not forward browser IP, page URL, referrer, contact details, personalisation or public tag ID. A random session-scoped client ID is necessary for GA4; consent and the per-order deduplication marker are kept in browser local storage. Purchases use the Store's order UUID as `transaction_id`; GA4 also deduplicates web stream purchases by this ID. The acknowledgement from Measurement Protocol indicates receipt, **not** that a report has processed the event.

Before turning on GA4, review and approve the store's privacy notice and consent language. Test allow and decline, repeat page loads and return visits to the same order, guest and account purchase flows, two different orders, two different Stores, and a pending or refunded order. Confirm one purchase per order in GA4 reports after processing, and confirm no email, name, claim token, address, publicTagId, query string or URL appears in the event payload. Do not enable automatic page tagging on order URLs, which can contain a guest claim token. If events are missing, check stream/secret pairing and processing delay before retrying with a different transaction ID.

## Review cadence

For the first weeks after launch, review Search Console and Bing weekly per domain: queries, impressions, clicks, CTR, position, indexed pages, errors and top landing pages. Check product views → checkout → confirmed purchases in GA4, compare with settled orders and investigate mismatches. Review content and offers monthly with dated evidence. Identify AI referrals only when a real referrer is available; no dashboard or automated task is configured by this guide.

External acceptance status: **NOT RUN**. No live domain, DNS property, GA4 stream, production database or authorised paid order was available in this workspace.

Official documentation: [Google Search Console domain properties](https://support.google.com/webmasters/answer/34592), [Google Sitemaps report](https://support.google.com/webmasters/answer/7451001), [Bing sitemaps](https://www.bing.com/webmasters/help/Sitemaps-3b5cf6ed), [GA4 ecommerce events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce), [GA4 transaction deduplication](https://support.google.com/analytics/answer/12313109).
