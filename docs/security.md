# Security and privacy baseline

## Implemented

- Random UUID internal keys and 10-character non-sequential public tag IDs
- Separate high-entropy activation credentials hashed with HMAC-SHA-256 and a server pepper
- BCrypt password hashing at cost 12; opaque random sessions stored only as SHA-256 hashes
- HttpOnly, SameSite=Lax session cookie; Secure in production
- Same-origin enforcement for state-changing browser APIs
- Object ownership filters on customer reads and updates; STAFF/ADMIN checks for operations
- Atomic tag claim to prevent replay/races
- Per-IP and per-account activation throttles; login and registration throttles
- Zod allow-list validation and protocol validation for redirect URLs
- Security headers, CSP baseline, Stripe signature verification and webhook idempotency
- Server-authoritative pricing and no storage of payment-card data
- Child profile excludes address, school, routine and exact birth date by design
- Raw IP addresses are not stored in scan events

## Required before production

- Transactional email provider, single-use verification/reset flows and session revocation UI
- MFA for staff/admin and stronger admin network/access policy
- Trusted-proxy configuration so forwarded IP and region headers cannot be spoofed
- Distributed rate limiter for more than one application replica
- Upload pipeline with content sniffing, decoding/re-encoding, size limits, malware scanning and signed object access
- Consent/retention workflows and an Australian privacy impact assessment for child data
- Secret manager, key rotation, encrypted backups with restore tests, monitoring and security alerting
- Tighten CSP to remove development allowances after confirming Next.js production nonces/hashes
- External penetration test and dependency/container scanning
