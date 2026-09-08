import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe(); const secret = process.env.STRIPE_WEBHOOK_SECRET; const signature = request.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) return NextResponse.json({ error: "Webhook unavailable" }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  try {
    await db.$transaction(async tx => {
      const seen = await tx.webhookEvent.findUnique({ where: { id: event.id } }); if (seen) return;
      if (event.type === "checkout.session.completed") {
        const session = event.data.object; const orderId = session.metadata?.orderId;
        if (orderId && session.payment_status === "paid") {
          await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });
          await tx.payment.updateMany({ where: { orderId }, data: { status: "SUCCEEDED", providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null } });
        }
      }
      await tx.webhookEvent.create({ data: { id: event.id, provider: "stripe", eventType: event.type } });
    });
  } catch { return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 }); }
  return NextResponse.json({ received: true });
}
