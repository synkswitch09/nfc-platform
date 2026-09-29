# Security and privacy baseline

## Implemented

- Random UUID internal keys and 16-character non-sequential public tag IDs (approximately 79 bits from the human-safe alphabet)
- Separate high-entropy activation credentials hashed with HMAC-SHA-256 and a server pepper; regeneration rotates the hash, invalidates the old credential and reveals the replacement only in the immediate response
- BCrypt password hashing at cost 12; opaque random sessions stored only as SHA-256 hashes
- HttpOnly, SameSite=Lax session cookie; Secure in production
- Same-origin enforcement for state-changing browser APIs
- Object ownership filters on customer reads and updates; STAFF/ADMIN checks for operations
- Atomic tag claim to prevent replay/races
- Per-IP and per-account activation throttles; login and registration throttles
- Rate limits across state-changing administrative APIs
- Zod allow-list validation and protocol validation for redirect URLs
- Security headers, CSP baseline, Stripe signature verification and webhook idempotency
- Server-authoritative pricing and no storage of payment-card data
- Child profile excludes address, school, routine and exact birth date by design
- Raw IP addresses are not stored in scan events
- Google/Apple Authorization Code Flow delegated to `openid-client` with PKCE, signed state storage, nonce and verified-email linking
- Product uploads are size-limited and checked by MIME, file signature, decoded dimensions and pixel count; filenames never control their storage path
- Suspended accounts and role changes revoke active sessions
- Sensitive credential regeneration is ADMIN-only, requires an explicit identity-verification confirmation and reason, and records versions and context without the secret
- Category/product status never authorizes public tag resolution; only tag state and profile visibility can expose or suppress an issued profile
- Exact environment-specific `StoreDomain` allow-list resolution; public and checkout Store context never trusts a client `storeId` or forwarded hostname
- Store-scoped sessions, catalogue/content/order/customer/media/Admin queries and Store-prefixed object keys prevent cross-brand IDOR and cache/media leakage
- Platform-wide identity with host-only sessions: credentials may be reused safely, but unrelated brand domains do not share browser cookies or customer views
- Store lifecycle stops new commerce without changing issued NFC tag state; NFC capability cannot be removed while the Store has issued tags
- Store selector navigates to a verified canonical Store origin; aggregate All Stores views are platform-admin-only and read-only

## Required before production

- Transactional email provider credentials and delivery monitoring
- MFA for staff/admin and stronger admin network/access policy
- Trusted-proxy configuration so forwarded IP and region headers cannot be spoofed
- Distributed rate limiter for more than one application replica
- Image decoding/re-encoding and malware scanning, or migration to a managed image pipeline, before accepting uploads from untrusted staff devices
- Consent/retention workflows and an Australian privacy impact assessment for child data
- Secret manager, key rotation, encrypted backups with restore tests, monitoring and security alerting
- Tighten CSP to remove development allowances after confirming Next.js production nonces/hashes
- External penetration test and dependency/container scanning
- Database-level row security is not enabled; logical Store isolation therefore requires continued query review, integration tests and least-privilege staff scopes
