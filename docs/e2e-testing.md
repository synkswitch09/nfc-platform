# Integrated E2E journeys

`npm run test:e2e` exercises the required business journeys through the running application's HTTP boundary and a real PostgreSQL database. It intentionally uses no mocked database or provider response.

The runner covers:

- Flow A: homepage, category landing, filtered Shop, product/cart/checkout surfaces, guest checkout, server-authoritative totals, test payment settlement and order success.
- Flow B: post-purchase email registration, verification, secure order attachment and appearance in the customer dashboard.
- Flow C: anonymous rejection from account/NFC management.
- Flow D: development-admin login, authorization, draft product creation, variant/stock, genuine image upload, publication and storefront visibility.
- Flow E: production batch, QR, manufacturing states, ADMIN-only credential regeneration, old-secret invalidation, one-time disclosure/audit safety, owner profile editing, public scan, unknown tag and disabled-tag privacy.
- Continuity gates: active tag and owner management remain available while its category is `HIDDEN`/`ARCHIVED` and while its product is `HIDDEN`/`ARCHIVED`/`OUT_OF_STOCK`.
- SEO boundaries: robots exclusions, dynamic sitemap, canonical metadata and product structured data.
- Payments: server-side price tampering resistance, invalid Stripe signature rejection, valid signed webhook processing and duplicate-event idempotency.

## Running safely

Use a disposable PostgreSQL database because the journey intentionally creates users, orders, products, uploads, batches, tags and audit records. Apply migrations and seed the temporary admin before starting the development server:

```bash
npm run db:deploy
DEV_ADMIN_EMAIL=e2e-admin@example.test DEV_ADMIN_PASSWORD=E2eAdminPassword123 npm run db:seed
ENABLE_TEST_CHECKOUT=true APP_URL=http://127.0.0.1:3000 npm run dev -- --hostname 127.0.0.1
```

In another terminal:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 \
E2E_ADMIN_EMAIL=e2e-admin@example.test \
E2E_ADMIN_PASSWORD=E2eAdminPassword123 \
E2E_APP_LOG=/path/to/server.log \
npm run test:e2e
```

The checkout shortcut is refused when `NODE_ENV=production`. Test credentials and the verification URL exist only inside the disposable CI job. Live Stripe and OAuth provider journeys still require provider sandbox credentials and must be repeated in staging.
