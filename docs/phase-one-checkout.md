# Phase 1: checkout assistance, privacy and integration settings

Each store has an independent **Admin → Store settings → Checkout, privacy & integrations** section. Changes require `settings.write`, use the current host's store, preserve other settings, and create an audit record. No database schema change is required; public integration settings live under `Store.accountConfig.integrations`.

## Azure configuration

The deployment configuration job creates `GEOAPIFY_STORES` as an empty value with **no secret reference** if it is absent. It preserves existing values and references. The empty value is valid and keeps suggestions unavailable. Do not add placeholder API keys.

After obtaining Geoapify credentials, create these Container App secrets separately:

- Staging: `geoapify-stores-staging`
- Production: `geoapify-stores-production`

Secret value structure (replace the examples with real keys; omit stores without credentials):

```json
{"tapkin":{"apiKey":"REAL_TAPKIN_KEY"},"kosykin":{"apiKey":"REAL_KOSYKIN_KEY"}}
```

Reference the corresponding secret from the **application** environment variable `GEOAPIFY_STORES`. Migration and order-worker jobs do not use Geoapify. Prefer separate provider keys for staging and production. A server proxy makes the API calls; browser referrer restrictions are not appropriate for these private keys. Provider IP restrictions require a known, stable outbound IP.

Enable suggestions in each store's CMS after configuring its credential. The CMS reports only whether a credential is present, never its value. Lack of credentials, disabled configuration, upstream errors and rate limits all preserve manual entry. A configured key still needs a real provider test; presence alone does not validate it.

## Address suggestions

- Same-origin POST endpoint; country and store cannot be supplied by the caller.
- Every provider request includes `filter=countrycode:au`, `lang=en`, and at most five results. Non-Australian responses are discarded.
- Four characters minimum; 450 ms debounce; cancellation of stale queries; a small, component-local result cache. Selecting a result makes no second provider request.
- Keys remain server-side. Responses contain only address fields, never provider credentials or coordinates. Query text is not written to application logs or the database.
- Limits: 60 requests/minute per store/IP and approximately 2,500 provider attempts/key per rolling 24 hours. The existing database rate limiter is best-effort under concurrency. This is not a provider billing cap. Other keys/projects and other callers can share the account's credit allowance; monitor the Geoapify dashboard.
- Fields remain editable, including unit/apartment. Check the selected suburb, state and postcode. Autocomplete does not prove delivery eligibility; shipping quotation and checkout validation still apply.
- Saved account addresses use the same optional suggestions. Changing an address invalidates previous shipping quotes, including requests still in progress.

## Remember details

Guest opt-in is initially unchecked. On successful checkout preparation, opted-in contact and delivery data are stored in `localStorage`, scoped to the current origin and store. Maximum retention is 90 days, reducible in the CMS. Reading data does not extend expiry. A new opted-in checkout refreshes it. Expired/malformed records are discarded when the site next accesses them; browsers cannot be made to delete localStorage while the site is closed.

No password, card data, order-access token or login session is saved in this record. It grants no account access and does not consent to marketing. Signed-in checkout prioritises the account's saved addresses. Account-address storage remains a separate explicit option.

Unchecking the option removes the stored record. **Forget my saved details** and **Privacy & cookie settings → Forget checkout details on this device** remove it. Disabling the feature or reducing retention takes effect on the next site visit. Browser-native autofill is separate and managed by the visitor's browser. Blocked browser storage never blocks payment.

## Consent and future tools

The host-only `privacy-preferences-{store}` cookie records version, timestamp and separate analytics/advertising flags for up to one year. Optional consent defaults to denied. Legacy analytics choices are not treated as new consent. Visitors can reopen settings, reject or change their choice. Rejecting cancels pending browser analytics requests and removes the session analytics identifier; events already delivered cannot be recalled.

Existing GA4 shopping events now require production mode, the store's CMS enable switch and measurement ID, its existing server credential, and a current analytics consent cookie. The endpoint independently checks consent. Staging never sends these events. Store the measurement ID in the CMS; the existing `ANALYTICS_GA4_STORES` server configuration still supplies the API secret (its legacy measurementId field remains in that schema until the full analytics phase).

Clarity, Meta Pixel and Meta catalog IDs can be prepared in the CMS. No Clarity script, advertising pixel, Conversions API delivery or catalog synchronisation is added in this phase. Advertising remains unavailable/denied. Provider-specific activation, consent handling, consent version changes, event deduplication and catalog synchronisation belong to the measurement phase.

## Staging acceptance

1. Check settings independently on both stores; save and reopen them.
2. With no key, complete manual entry and shipping quotation as before.
3. With a real key, enable Geoapify and test Australian suggestions, keyboard selection, editing, a unit number and the manual fallback.
4. Opt in as a guest, proceed to test payment, return to checkout and confirm details are restored; test forgetting. Do not use real card details in staging.
5. Sign in and verify default/saved/new address choices and account-address saving.
6. Open privacy settings, reject and save. No analytics/ad requests should leave staging.

This phase is released to `develop` and staging. Production configuration can be prepared independently; application release to production follows staging review.
