# Architecture

## Runtime

The MVP is a modular monolith. Next.js renders the public website, dashboards and tag pages; Route Handlers provide authenticated mutations and Stripe webhooks. Prisma is the only data-access layer and PostgreSQL is the source of truth. This keeps local and NAS operation simple while preserving a clean path to managed containers and PostgreSQL later.

## Core flow

1. Manufacturing creates a cryptographically random `publicTagId` and an independent activation code.
2. Only `APP_URL/t/{publicTagId}` is encoded in the NTAG213 and matching QR.
3. The activation code is HMAC-SHA-256 hashed with a server-side pepper and shown only on the production result.
4. Activation checks per-IP and per-account limits, verifies the code in constant time, then claims the tag atomically.
5. A public scan resolves the tag status and profile. Direct social redirects accept only HTTP(S) destinations.
6. Scan analytics retain a time bucket, broad device class and coarse location supplied by trusted infrastructure—never a raw IP address.

## Data model

`NFCTag` is the stable product identity. `TagProfile` holds shared public controls and has a one-to-one relation with exactly one type-specific profile. Emergency products reuse the constrained emergency model; review and custom link products reuse the validated link model. Accessories intentionally have no NFC profile. Orders snapshot unit prices, SKUs, product types, addresses and personalisation; Stripe records are separate and webhook events are idempotent.

Catalogue media is referenced in PostgreSQL but stored in a durable private volume and served through a content-type-controlled route. This keeps the first NAS deployment self-contained while preserving a clean migration path to S3-compatible object storage.

## Scale path

- Cache active public tag records briefly at the edge and invalidate on profile/status updates.
- Move scan writes to a queue and aggregate daily counts when traffic grows.
- Replace database-backed security events with Redis-compatible distributed rate limiting for multiple app replicas.
- Store validated/resized images in S3-compatible storage.
- Split checkout, manufacturing or analytics into services only when independent scaling justifies it.
