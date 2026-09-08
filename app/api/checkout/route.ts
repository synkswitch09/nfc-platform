import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";
import { calculateOrderTotals } from "@/lib/commerce";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Sign in to check out", 401);
  const stripe = getStripe(); if (!stripe) return jsonError("Payments are not configured yet", 503);
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid cart");
  const ids = [...new Set(parsed.data.items.map(item => item.variantId))];
  const variants = await db.productVariant.findMany({ where: { id: { in: ids }, active: true, product: { active: true } }, include: { product: true } });
  if (variants.length !== ids.length) return jsonError("One or more products are unavailable", 409);
  const byId = new Map(variants.map(v => [v.id, v]));
  const { subtotalCents, shippingCents, totalCents } = calculateOrderTotals(parsed.data.items.map(item => ({ unitPriceCents: byId.get(item.variantId)!.priceCents, quantity: item.quantity })));
  const order = await db.order.create({ data: {
    orderNumber: `TK-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
    userId: user.id, subtotalCents, shippingCents, totalCents,
    items: { create: parsed.data.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, unitPriceCents: byId.get(item.variantId)!.priceCents, personalisation: item.personalisation ?? undefined })) },
    payments: { create: { amountCents: totalCents, currency: "AUD" } },
  }, include: { payments: true } });
  const origin = process.env.APP_URL ?? request.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer_email: user.email, client_reference_id: order.id, metadata: { orderId: order.id, userId: user.id },
      line_items: [
        ...parsed.data.items.map(item => { const variant = byId.get(item.variantId)!; return { quantity: item.quantity, price_data: { currency: "aud", unit_amount: variant.priceCents, product_data: { name: `${variant.product.name} — ${variant.name}`, metadata: { variantId: variant.id } } } }; }),
        ...(shippingCents ? [{ quantity: 1, price_data: { currency: "aud", unit_amount: shippingCents, product_data: { name: "Standard shipping" } } }] : []),
      ],
      shipping_address_collection: { allowed_countries: ["AU"] },
      success_url: `${origin}/dashboard/orders/${order.id}?checkout=success`, cancel_url: `${origin}/shop?checkout=cancelled`,
    });
    await db.payment.update({ where: { id: order.payments[0].id }, data: { providerSessionId: session.id } });
    return NextResponse.json({ url: session.url });
  } catch {
    await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return jsonError("Checkout could not be started", 502);
  }
}
