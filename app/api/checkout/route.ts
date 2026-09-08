import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { attachCheckoutSession, cancelPendingOrder, CheckoutError, createPendingOrder, settleCheckoutEvent } from "@/lib/order-service";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("checkout", getClientIp(request), 20, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many checkout attempts. Try again later.", 429);
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid checkout details");

  const user = await getCurrentUser();
  if (!parsed.data.customer) return jsonError("Contact and shipping details are required");
  const customer = parsed.data.customer;

  let checkout;
  try {
    checkout = await createPendingOrder(parsed.data.items, { ...customer, userId: user?.id });
  } catch (error) {
    if (error instanceof CheckoutError) return jsonError(error.message, error.status);
    return jsonError("Checkout could not be prepared", 500);
  }

  const origin = process.env.APP_URL ?? request.nextUrl.origin;
  const successPath = user
    ? `/dashboard/orders/${checkout.order.id}?checkout=success`
    : `/order/${checkout.order.orderNumber}/success?token=${encodeURIComponent(checkout.claimToken!)}`;
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_TEST_CHECKOUT === "true") {
    const sessionId = `test_${randomUUID()}`;
    await attachCheckoutSession(checkout.order.id, checkout.order.payments[0].id, sessionId);
    await settleCheckoutEvent({ eventId: `test-event-${randomUUID()}`, eventType: "checkout.session.completed.test", providerSessionId: sessionId, orderId: checkout.order.id, amountCents: checkout.order.totalCents, currency: "AUD" });
    return NextResponse.json({ url: `${origin}${successPath}`, testMode: true });
  }
  const stripe = getStripe();
  if (!stripe) {
    await cancelPendingOrder(checkout.order.id, "Payments are not configured");
    return jsonError("Payments are not configured yet", 503);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      client_reference_id: checkout.order.id,
      metadata: { orderId: checkout.order.id },
      line_items: [
        ...checkout.lines.map(({ item, variant, unitPriceCents }) => ({ quantity: item.quantity, price_data: { currency: "aud", unit_amount: unitPriceCents, product_data: { name: `${variant.product.name} — ${variant.name}`, metadata: { variantId: variant.id } } } })),
        ...(checkout.order.shippingCents ? [{ quantity: 1, price_data: { currency: "aud", unit_amount: checkout.order.shippingCents, product_data: { name: "Standard shipping" } } }] : []),
      ],
      shipping_address_collection: { allowed_countries: ["AU"] },
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
    });
    await attachCheckoutSession(checkout.order.id, checkout.order.payments[0].id, session.id);
    return NextResponse.json({ url: session.url });
  } catch {
    await cancelPendingOrder(checkout.order.id, "Stripe Checkout Session creation failed");
    return jsonError("Checkout could not be started", 502);
  }
}
