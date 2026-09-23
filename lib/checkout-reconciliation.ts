import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { attachCheckoutSession, cancelPendingOrder, CheckoutError, settleCheckoutEvent } from "@/lib/order-service";

// Session status must be retrieved from Stripe, never inferred from cancel_url or age.
export async function applyStripeSession(session: Stripe.Checkout.Session, eventId: string, eventType: string, failedEvent = false, actorId?: string) {
  const orderId = session.metadata?.orderId;
  const storeId = session.metadata?.storeId;
  if (!orderId || !storeId || session.mode !== "payment") throw new CheckoutError("Checkout metadata is incomplete", 409);
  const payment = await db.payment.findFirst({ where: { orderId, provider: "stripe", order: { storeId }, OR: [{ providerSessionId: session.id }, { providerSessionId: null }] } });
  if (!payment || session.amount_total !== payment.amountCents || session.currency?.toLowerCase() !== payment.currency.toLowerCase()) throw new CheckoutError("Stripe session does not match this payment", 409);
  if (payment.status === "FAILED" && session.payment_status === "paid") throw new CheckoutError("Payment received for a cancelled order; manual review required", 409);
  if (payment.status !== "PENDING") return "unchanged";
  if (!payment.providerSessionId) await attachCheckoutSession(orderId, payment.id, session.id);
  if (session.payment_status === "paid" || (session.payment_status === "no_payment_required" && payment.amountCents === 0 && session.status === "complete")) {
    await settleCheckoutEvent({ eventId, eventType, providerSessionId: session.id, orderId, storeId, amountCents: payment.amountCents, currency: payment.currency, paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id });
    return "paid";
  }
  if (session.status === "expired" || (failedEvent && session.status === "complete" && session.payment_status === "unpaid")) {
    const cancelled = await cancelPendingOrder(orderId, `Stripe confirmed ${session.status === "expired" ? "checkout expiry" : "payment failure"}`, actorId);
    return cancelled ? "cancelled" : "unchanged";
  }
  return "pending";
}

async function findSession(stripe: Stripe, payment: { providerSessionId: string | null; orderId: string; createdAt: Date }, storeId: string) {
  if (payment.providerSessionId) return stripe.checkout.sessions.retrieve(payment.providerSessionId);
  // Recover a crash between Stripe creation and saving the session ID. A bounded search
  // that finds nothing is inconclusive: never release stock on that basis.
  let startingAfter: string | undefined;
  let found: Stripe.Checkout.Session | undefined;
  for (let page = 0; page < 5; page++) {
    const sessions = await stripe.checkout.sessions.list({ limit: 100, created: { gte: Math.floor(payment.createdAt.getTime() / 1000) - 60, lte: Math.floor(payment.createdAt.getTime() / 1000) + 3600 }, starting_after: startingAfter });
    for (const session of sessions.data) {
      if (session.metadata?.orderId !== payment.orderId || session.metadata?.storeId !== storeId) continue;
      if (found && found.id !== session.id) throw new CheckoutError("Multiple sessions require manual review", 409);
      found = session;
    }
    if (!sessions.has_more) return found ? stripe.checkout.sessions.retrieve(found.id) : null;
    startingAfter = sessions.data.at(-1)?.id;
    if (!startingAfter) break;
  }
  return null;
}

export async function cancelStripeCheckout(orderId: string, storeId: string, actorId: string) {
  const stripe = getStripe();
  if (!stripe) throw new CheckoutError("Stripe is unavailable; stock remains reserved", 409);
  const payment = await db.payment.findFirst({ where: { orderId, status: "PENDING", provider: "stripe", order: { storeId, status: "PAYMENT_PENDING" } } });
  if (!payment) throw new CheckoutError("Order is no longer awaiting payment", 409);
  let session = await findSession(stripe, payment, storeId);
  if (!session) throw new CheckoutError("Payment session is uncertain. Reconcile before cancelling; stock remains reserved.", 409);
  if (session.metadata?.orderId !== orderId || session.metadata?.storeId !== storeId || session.amount_total !== payment.amountCents || session.currency?.toLowerCase() !== payment.currency.toLowerCase()) throw new CheckoutError("Session ownership or amount does not match this order", 409);
  if (session.status === "open") {
    try { session = await stripe.checkout.sessions.expire(session.id); }
    catch { session = await stripe.checkout.sessions.retrieve(session.id); }
  }
  const result = await applyStripeSession(session, `cancel-check:${session.id}`, "checkout.admin_check", false, actorId);
  if (result !== "cancelled") throw new CheckoutError("Payment changed or is processing. Refresh the order; it was not cancelled.", 409);
}

export async function reconcilePendingCheckouts(cursor?: string) {
  const stripe = getStripe();
  if (!stripe) throw new CheckoutError("Stripe is not configured", 503);
  const payments = await db.payment.findMany({
    where: { provider: "stripe", status: "PENDING", createdAt: { lt: new Date(Date.now() - 5 * 60_000) }, order: { status: "PAYMENT_PENDING" }, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" }, take: 10, include: { order: { select: { storeId: true } } },
  });
  const outcomes: Array<{ paymentId: string; status: string }> = [];
  for (const payment of payments) {
    try {
      const session = await findSession(stripe, payment, payment.order.storeId);
      if (!session) { outcomes.push({ paymentId: payment.id, status: "review_required" }); continue; }
      let failed = false;
      if (session.status === "complete" && session.payment_status === "unpaid" && typeof session.payment_intent === "string") {
        const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
        failed = intent.status === "canceled" || (intent.status === "requires_payment_method" && Boolean(intent.last_payment_error));
      }
      const status = await applyStripeSession(session, `reconcile:${session.id}:${session.payment_status}:${session.status}`, "checkout.reconciled", failed);
      outcomes.push({ paymentId: payment.id, status });
    } catch { outcomes.push({ paymentId: payment.id, status: "retry_required" }); }
  }
  return { outcomes, nextCursor: payments.length === 10 ? payments.at(-1)!.id : null };
}
