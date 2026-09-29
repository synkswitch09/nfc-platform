# Refunds and durable order notices (block D)

## Activate this release

This release **requires migration `20260924090000_refunds_and_order_outbox`** before running the new application. Back up the target database first. Test in an isolated staging database with Stripe test keys; do not use seed or Start fresh.

For a Node deployment, install the committed dependencies, run `npm run db:deploy` against the intended database, then build/start the new app. The migration adds refund and notification tables and payment accounting fields; it does not delete content or reset inventory.

For the repository's development Docker Compose configuration:

```sh
docker compose build migrate app checkout-reconciler
docker compose run --rm migrate
docker compose up -d app
docker compose --profile operations up -d checkout-reconciler
```

Use your staging/production configuration for those environments; the default compose file explicitly uses development and mock email. Preserve database and upload volumes. Do not run `down -v`. App and worker must share a random `CHECKOUT_RECONCILE_SECRET` of at least 32 characters. The worker must use the new image: its script now processes refunds/notices before reconciling checkouts.

Add `refund.created`, `refund.updated`, and `refund.failed` to the environment's signed Stripe webhook `/api/stripe/webhook`, alongside the checkout events listed in CHECKOUT_RESERVATIONS.md. Match STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to the same test/live environment. Configure EMAIL_MODE and EMAIL_WEBHOOK_URL/EMAIL_WEBHOOK_SECRET for real email; mock mode records MOCKED, never ACCEPTED.

No migrations, provider changes, credentials or live financial operations were applied by this development session.

## Administrator workflow

Open Orders → order → Payment and refunds. A store administrator can request a **full Stripe refund** with a reason and confirmation showing the order and amount. A durable request is committed before contacting Stripe. REQUESTED/PENDING/REVIEW_REQUIRED do not mean money was refunded; only a confirmed successful provider result updates the refunded amount. Payment and preparation/delivery status are displayed separately. Fully refunded orders cannot advance through the order-status form.

Double clicks/retries reuse the same stored request. “Check refund with Stripe” checks active/uncertain requests. A terminal successful/failed request is not submitted again. Failed or review-required outcomes need inspection in Stripe; this UI does not create replacement requests automatically. Existing refunds made in Stripe are imported through signed refund events. External partial amounts are recorded and flagged for review, without labelling the entire payment refunded. Creating partial refunds and refunding Etsy payments are outside this block.

Refunds do not deactivate NFC tags or automatically undo manufacturing, shipments, labels or print jobs. Review that operational work separately. “Return sold stock” requires explicit confirmation and a reason after a full refund: inspect whether the goods are actually resellable, especially personalised or shipped goods. It returns only physical units recorded in the SALE/RETURN ledger, once, and queues Etsy inventory sync. It does not turn unfulfilled backorder demand into physical stock.

## Recovery rules

Stripe calls use the stored refund ID as their idempotency key. A network timeout is uncertain, not a failed refund. Recovery lists the payment's refunds and matches local metadata before considering another request. An existing unmatched refund, incomplete provider list, or a request aged 20 hours blocks a new automatic refund and raises REVIEW_REQUIRED. Resolve these in Stripe; do not delete records or generate another key to bypass the guard. Account-wide historical refunds are not backfilled automatically.

The authenticated endpoint `POST /api/integrations/orders/process` processes up to three due refunds and five due notices per call. The existing worker invokes it immediately and every five minutes after completing a cycle. Refund and email queues run independently. Inspect worker logs and the order screen for repeated errors. This bounded worker is intended for initial volume; monitor queue age before increasing throughput.

Payment notices (web and newly imported Etsy orders), admin status changes and confirmed refunds are queued inside their business transaction. A failed email request cannot lose the committed event. Existing historical orders do not receive a bulk replay. Retries use exponential backoff, with at most five automatic attempts; expired processing leases are recoverable. FAILED requires review and an explicit “Send again”. That action creates a new notice, so it can intentionally resend a previously accepted message.

The email adapter sends `Idempotency-Key` in the header and `idempotencyKey` in the JSON body. Your email gateway must enforce deduplication for this to prevent duplicates after an uncertain response. HTTP success records ACCEPTED, which does **not** prove delivery. There is no delivery/bounce webhook in this block and no claim of exactly-once email delivery. Each request has a 15-second timeout. Admin shows the latest 100 notices, attempts and safe error messages; recipients and reasons remain sensitive operational data.

## Staging acceptance checklist

1. Apply the migration to a backed-up disposable copy. Confirm existing orders/content/stock remain unchanged.
2. Pay with Stripe test mode. Verify payment and notices commit together, and webhook redelivery creates no duplicate business notice.
3. Request a full test refund twice; verify one Stripe refund, one local request and no stock/tag change.
4. Interrupt the provider response; recover the same refund via webhook/worker. Exercise pending, failed, partial external refunds and out-of-order events.
5. Confirm stock return twice; verify one RETURN per consumed variant and no return of unsupplied units. Exercise concurrent transactions in PostgreSQL.
6. Make the email gateway fail, then recover. Verify attempts, terminal failure and manual resend. Confirm the gateway's actual deduplication behavior after a timeout.
7. Verify cross-store and non-admin requests are rejected; open the admin on mobile and verify confirmations/status/errors.
8. Rebuild/start the Docker worker and observe several cycles with an invalid provider response without starving the other queue.

Unit tests mock DB/provider boundaries; they do not prove SQL rollback, concurrent transaction behavior, provider delivery or Docker startup. Real PostgreSQL, Stripe test integration, browser E2E and Docker build remain required in staging. For rollback, stop the worker and restore compatible application code; keep additive tables and financial records. Do not drop the outbox/refund data to roll back code.

Provider contracts: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [refund creation](https://docs.stripe.com/api/refunds/create), [refund object/status](https://docs.stripe.com/api/refunds/object). The local 20-hour cutoff is deliberately below Stripe's documented minimum 24-hour idempotency retention window.
