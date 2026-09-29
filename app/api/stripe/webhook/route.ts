import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { applyStripeRefund } from "@/lib/refunds";
import { applyStripeSession } from "@/lib/checkout-reconciliation";
import { CheckoutError, settleCheckoutEvent } from "@/lib/order-service";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = getRuntimeConfig().stripe.webhookSecret;
  const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) { logEvent("warn", "stripe.webhook_rejected", { requestId: request.headers.get("x-request-id"), reason: "unavailable_or_unsigned" }); return NextResponse.json({ error: "Webhook unavailable" }, { status: 400 }); }

  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
  catch { logEvent("warn", "stripe.webhook_rejected", { requestId: request.headers.get("x-request-id"), reason: "invalid_signature" }); return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }

  if (["refund.created", "refund.updated", "refund.failed"].includes(event.type)) {
    try {
      const refund = event.data.object as Stripe.Refund;
      await applyStripeRefund(await stripe.refunds.retrieve(refund.id));
      return NextResponse.json({ received: true });
    } catch {
      logEvent("error", "stripe.refund_webhook_failed", { eventId: event.id });
      return NextResponse.json({ error: "Refund reconciliation failed" }, { status: 500 });
    }
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId;
  const storeId = session.metadata?.storeId;
  if (!orderId || !storeId) {
    return NextResponse.json({ error: "Incomplete checkout event" }, { status: 400 });
  }

  try {
    const existing = await db.payment.findUnique({ where: { providerSessionId: session.id }, select: { status: true } });
    // A previously settled payment needs no provider lookup. Still validate the
    // signed event's order/amount and persist its ID through the settlement service.
    if (existing?.status === "SUCCEEDED" && session.payment_status === "paid" && session.amount_total != null && session.currency) {
      await settleCheckoutEvent({ eventId: event.id, eventType: event.type, providerSessionId: session.id, orderId, storeId, amountCents: session.amount_total, currency: session.currency });
      return NextResponse.json({ received: true, duplicate: true });
    }
    const current = await stripe.checkout.sessions.retrieve(session.id);
    const result = await applyStripeSession(current, event.id, event.type, event.type === "checkout.session.async_payment_failed");
    logEvent("info", "stripe.webhook_processed", { requestId: request.headers.get("x-request-id"), eventId: event.id, orderId, storeId, outcome: result });
  } catch (error) {
    logEvent("error", "stripe.webhook_failed", { requestId: request.headers.get("x-request-id"), eventId: event.id, orderId, reason: error instanceof CheckoutError ? "checkout_conflict" : "internal_error" });
    const status = error instanceof CheckoutError ? error.status : 500;
    return NextResponse.json({ error: "Webhook processing failed" }, { status });
  }
  return NextResponse.json({ received: true });
}
