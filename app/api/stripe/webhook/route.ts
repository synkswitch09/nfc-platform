import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CheckoutError, settleCheckoutEvent } from "@/lib/order-service";
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: true });
  }
  const session = event.data.object;
  const orderId = session.metadata?.orderId;
  if (!orderId || session.payment_status !== "paid" || !session.amount_total || !session.currency) {
    return NextResponse.json({ error: "Incomplete checkout event" }, { status: 400 });
  }

  try {
    const result = await settleCheckoutEvent({
      eventId: event.id,
      eventType: event.type,
      providerSessionId: session.id,
      orderId,
      amountCents: session.amount_total,
      currency: session.currency,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    logEvent("info", "stripe.webhook_processed", { requestId: request.headers.get("x-request-id"), eventId: event.id, orderId, duplicate: result.duplicate });
  } catch (error) {
    logEvent("error", "stripe.webhook_failed", { requestId: request.headers.get("x-request-id"), eventId: event.id, orderId, reason: error instanceof CheckoutError ? "checkout_conflict" : "internal_error" });
    const status = error instanceof CheckoutError ? error.status : 500;
    return NextResponse.json({ error: "Webhook processing failed" }, { status });
  }
  return NextResponse.json({ received: true });
}
