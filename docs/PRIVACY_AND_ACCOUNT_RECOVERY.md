# Pet photos and account recovery — block E

## Changes

`/api/media/[storageKey]` checks the current storefront and the same `publicTagState` policy used by the NFC profile on every request. ACTIVE/LOST public profiles allow their photo to be viewed. Private, MANUFACTURED, UNCLAIMED, DISABLED and REPLACED profiles deny visitors and unrelated customers. The authenticated owner can preview their own photo even when the profile is unavailable publicly. Authentication itself is storefront-scoped. An inaccessible or missing photo returns 404 before storage is read.

Pet responses (including denials) are `private, no-store, max-age=0`, with `Vary: Cookie`. Product/category commercial media retain their public cache policy. A pet reference takes precedence if a key also has a commercial reference. New pet uploads also carry private/no-store metadata in object storage. The ordinary profile PATCH no longer accepts changes to a pet's photo URL; uploading/removing through the authenticated photo endpoint controls that field. Saving profile text preserves its photo.

Both public profile and owner editor append `?privacy=1` to the image request, to avoid reusing old browser responses cached as immutable. Stored database URLs remain unchanged. Previously configured external pet-photo URLs are no longer rendered: upload those photos through My products → profile → Pet photo so authorization can be enforced by this application. No automatic external download or database rewrite is performed.

Password recovery now conditionally consumes an unused, unexpired, store-scoped token inside a serializable transaction. Losing that claim cannot change the password. Password update, token consumption, audit entry, revocation of **all sessions across all stores for that user**, and invalidation of other outstanding reset links commit together. Other users' sessions are unaffected. The shared global account identity remains unchanged. A transaction conflict returns a recoverable error, never a false success.

## Deploy

1. Update/rebuild the app on the intended environment. This block introduces **no migration and no seed requirement**. If block D has not been deployed, its migration is still required first.
2. Ensure stored uploads are accessible only through the application. For Azure, use a private container and keep SAS credentials server-side. For local storage, do not expose the upload directory through a public reverse-proxy/static alias. App authorization cannot protect a separate publicly accessible storage URL.
3. If a CDN/proxy previously cached `/api/media/*`, purge the old pet image URLs (including query variants) and configure pet responses to obey no-store. Do not ignore query strings for these URLs. Existing blob metadata is not rewritten by this release; purge/update any direct storage caching arrangement before claiming the privacy change is fully deployed.
4. Verify public and owner image requests reach the new app and receive private/no-store headers. Old direct API URLs must also perform authorization. A previously downloaded or cached copy cannot be remotely erased; a new image request key only avoids reusing that response in the updated UI.
5. Test password recovery with a disposable account. Successful recovery signs out that account's existing sessions on every storefront; request a fresh link if another outstanding reset link becomes invalid.

## Staging acceptance still required

- Upload a test photo; view it as a visitor while ACTIVE/public and LOST/public. Make it private, then disabled/replaced; request the same direct image URL and verify 404 with no-store.
- Repeat using the owner, another customer and another storefront. Only the owner may preview a restricted photo in the current storefront. Verify product images remain public.
- Remove/replace the photo and ensure old references are unavailable at the origin. Check actual browser/CDN behavior after purging earlier caches.
- Save profile text after uploading and verify the image is preserved; submitting an arbitrary photoUrl through the ordinary PATCH must not replace it.
- Race two uses of one reset link against PostgreSQL; exactly one commits. Repeat with separate outstanding links for the same account. Check expired and wrong-store tokens, rollback on transaction failure, and old sessions on two stores.
- Confirm unrelated users retain their sessions. Test complete recovery email → form → new login in a browser.

Automated tests simulate DB/auth/storage boundaries and verify policy, claim-loss behavior, query scoping and headers. They do not replace real PostgreSQL race/rollback tests, browser checks or a CDN/storage configuration audit. No real user data, account password, session, storage permission or cache was changed during implementation.
