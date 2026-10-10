# Phase 5: independent store points

Points are enabled by default for AUD stores. Admin → Store settings → **Points & rewards** edits each store's earning rate, redemption value/unit/minimum, percentage cap, expiry months, pause switch and offer stacking. `settings.write` is required; settings and manual adjustments are audited. Existing checkout snapshots retain their original economic terms. No new Azure variables, credentials or secrets are required.

## Initial economics

- One point per whole A$1 of merchandise after promotional and points discounts; shipping never earns points.
- 100 points give A$2 off; minimum 100 and increments of 100.
- Maximum 10% of merchandise after promotional discounts. The final provider total remains at least A$0.50.
- Expiry is 12 calendar months after confirmed payment, clamped for month ends. Manual positive adjustments use the current store expiry rule.
- Offer stacking is disabled. Choosing points replaces automatic offers and disables discount codes; opting into stacking makes the server recompute the cap after the promotion.
- No cash withdrawal, transfer between brands or retrospective awards for legacy orders.

## Customer and administrator

Account → **Points** shows available and reserved balances, upcoming expiry and recent history. Qualifying guest purchases accrue to a store-specific hashed email identity. Only a verified account with that purchase email can link or redeem that balance. The checkout uses the signed-in account's server email, never a client-supplied replacement. Tapkin and Kosykin balances remain independent.

Admin → Store settings → **View points accounts & adjustments** shows store-scoped balances and history. Adjustments require a reason visible to the customer, an authenticated authorized actor and an idempotency key retained on retry. Negative adjustments cannot remove points reserved in another checkout or exceed spendable credits. Audit entries retain the actor, amount and reason. New payment notices use the editable **Points earned** template under Email templates and the order sender category; required earned amount, expiry and account instructions remain included independently of the design.

## Payment lifecycle

The order, inventory and points reservation are created atomically in a serializable transaction. Points are consumed from the earliest-expiring lots. The verified Stripe payment transition marks a reservation spent and awards credits once. Abandoned checkouts hold credits until cancellation is confirmed by the existing provider reconciliation; an unconfirmed timeout never releases potentially paid points. Confirmed cancellation restores credits once, keeping original expiry.

Confirmed cash refunds adjust both earned points and redeemed points cumulatively in proportion to cash refunded / original cash total. This deliberately includes the cash shipping component because existing partial refunds do not carry a merchandise line allocation. Integer rounding is down until a full refund reconciles the full amount. Pending/failed refunds change no points. Duplicate provider updates change no points twice.

Unused refunded awards are revoked first. Already expired unused awards do not create an adjustment owed. Previously used awards offset other available credits and then future credits; the customer never owes a cash payment. Returned redemption retains original expiry and offsets outstanding refund adjustments first. If its original award was revoked while held and another credit already offset that adjustment, a compensating lot preserves the original expiry without reopening the revoked award. Expired returns never revive spendable credit.

## Operations and validation

Migration `20261013000000_store_loyalty` is additive and includes nonnegative and allocation constraints. The existing authenticated order worker expires overdue balances independently of shipping/measurement/email queues. Account access also expires overdue credits, so redemption does not depend on worker timing. Pausing future earning/redemption retains history and expiry; already-created orders settle their saved terms.

Unit coverage exercises arithmetic, month ends, verification, store isolation, reservations, duplicate settlement/cancellation/refunds, cumulative partial refunds, used/expired award reversals and audited adjustment retries. Disposable PostgreSQL HTTP E2E covers guest claim, permissions, CMS validation, cross-store adjustment denial, concurrent checkout redemption, expiry and pause. A provider-normalized refund integration test uses only fake intent/refund identifiers and no external transactions. Production checkout retains its existing deployment setting; this phase does not open sales or seed test purchases into staging/production.
