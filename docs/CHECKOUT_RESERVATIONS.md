# Checkout stock and reconciliation

## Behaviour

Existing stock is adjusted in **Catalog → Inventory**, with a reason. The request carries the stock shown when the screen loaded. A sale or another adjustment changing that number causes HTTP 409 instead of overwriting it. New products/variants can still receive initial stock; the initial movement is recorded with its actor. Saving an existing product's description, price or options never writes its submitted stock quantity.

Checkout reserves tracked, non-backorder stock. A signed Stripe notification or the reconciler retrieves the current Stripe session before deciding what to do:

- Paid: settle once, consume the held units, create manufacturing work using existing rules.
- Expired: cancel the pending order once and release its actual reservation ledger.
- Confirmed delayed-payment failure: cancel/release once.
- Open, processing, API unavailable or missing/ambiguous session: keep the reservation. Returning to `cancel_url` does not prove cancellation.

An admin cancellation expires an open Stripe session first. If payment wins that race, the order is settled and the admin sees that it was not cancelled. It does not release paid stock. Calls that lose a serializable database transaction can be retried by webhook delivery or the reconciler.

The checkout stores the inventory policy with its item snapshot. Later variant-policy edits do not alter reservations already recorded. Older orders fall back to their existing ledger and current policy; inconsistent or missing required reservations need review. SQL stock constraints are unchanged. Backorders and Etsy consumption cannot consume units held for other orders; their SALE movement records only physical units actually consumed, while the order retains the full demand quantity.

## Enable Stripe events

Configure the environment's Stripe webhook endpoint `/api/stripe/webhook` for:

1. `checkout.session.completed`
2. `checkout.session.async_payment_succeeded`
3. `checkout.session.async_payment_failed`
4. `checkout.session.expired`

Use the matching `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for staging/test or production/live. No Stripe configuration was changed remotely by this implementation.

## Enable the recovery worker in Docker

1. Set a random **CHECKOUT_RECONCILE_SECRET** of at least 32 characters in your environment. Do not commit its value. The app and worker must share it.
2. Rebuild/recreate the app with the updated code and variable:

   ```sh
   docker compose up -d --build app
   ```

3. Start the optional worker:

   ```sh
   docker compose --profile operations up -d --build checkout-reconciler
   docker compose logs -f checkout-reconciler
   ```

It runs immediately and then five minutes after each completed cycle. Payments younger than five minutes are skipped. Pages of ten are processed using an ID cursor, so unresolved early orders do not prevent later ones from being checked. This does not shorten Stripe's checkout expiration; it checks confirmed status. The worker requires a configured Stripe account in the app. It remains disabled unless started.

For another hosting provider, inject APP_URL and CHECKOUT_RECONCILE_SECRET into a scheduled Node 24 job and run `node scripts/reconcile-checkouts.mjs` every five minutes, or run it as a managed worker with `--watch`. APP_URL must point to that environment's app. The script calls `POST /api/integrations/checkout/reconcile` using Bearer authentication and follows `nextCursor`; configure the job's network access accordingly. No secret or production job was created in this development session.

## Recovery and operations

- `paid` / `cancelled`: provider-confirmed transition applied.
- `pending`: session is open or its payment is not final; leave reserved.
- `unchanged`: already processed.
- `retry_required`: provider/database conflict or unavailability; retry on the next cycle. Investigate repeated outcomes using the payment ID in worker logs.
- `review_required`: no unique session was safely found. A crash may have occurred before or after creating Stripe's session. The search is bounded to five pages in the creation window; absence is not proof that no charge exists. Check Stripe and order history manually; do not reset reservation counters.

Session creation uses a payment-specific idempotency key. If the network or DB attachment fails, the order stays pending. A later signed event or reconciliation can recover the missing session link by matching order/store metadata and amount/currency. Ambiguous sessions are not automatically cancelled. A paid Stripe session associated with a historically failed local payment raises a review error rather than silently accepting the mismatch.

Block D adds durable notifications and full Stripe refunds; see [REFUNDS_AND_NOTIFICATIONS.md](REFUNDS_AND_NOTIFICATIONS.md) for its required migration and activation. Checkout reconciliation does not unreserve orders based only on elapsed time or promise that all orphan requests can be resolved automatically.

## Staging acceptance still required

Use disposable PostgreSQL and Stripe test mode, with products scoped to the test store:

1. Start with stock 10. Reserve 2, then cancel/expire twice. Assert physical stock 10, reserved 0 and only one RELEASE transition.
2. Pay a reservation twice using redelivery; assert one SALE, one PAID transition and no duplicate manufacturing work.
3. Race admin cancellation with successful payment; exactly one provider-confirmed outcome must win. Inspect PostgreSQL serializable retries, not only mocked tests.
4. Change variant policy after reserving; release must still use the original ledger.
5. Open inventory, make a sale, then submit the stale adjustment. Expect HTTP 409. Save an old product form; stock must remain unchanged.
6. Disable webhook delivery in a test endpoint, expire/pay a session, run the worker and verify recovery. Restore webhook delivery and check duplicates.
7. Simulate a failed session attachment and a Stripe outage. Never release until status is confirmed. Test delayed payment success/failure if those methods are enabled.
8. Check unauthorized scheduler calls return 401 and another store's session is never expired by admin cancellation.

There is **no new migration or seed requirement**. Docker build, live Stripe calls and real PostgreSQL race/rollback tests were not run in the implementation environment. Existing database migrations, including stock constraints, must already be installed.

To pause recovery: `docker compose --profile operations stop checkout-reconciler`. Keep signed webhooks enabled. Do not revert to the earlier unsafe cancellation code to clear pending orders; investigate uncertain provider states first.

Provider references: [Stripe session expiration](https://docs.stripe.com/api/checkout/sessions/expire), [session listing and status meanings](https://docs.stripe.com/api/checkout/sessions/list).
