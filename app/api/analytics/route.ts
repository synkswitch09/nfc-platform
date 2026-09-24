import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { commerceEventSchema, commercePayload, purchaseEligible, purchaseParams } from "@/lib/commerce-analytics";
import { getCurrentStorefront } from "@/lib/storefront";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const config = getRuntimeConfig();
  const store = await getCurrentStorefront();
  const stream = config.appEnv === "production" ? config.analyticsStores[store.slug] : undefined;
  if (!stream) return jsonError("Analytics unavailable", 404);
  const limited = await rateLimit("analytics", getClientIp(request), 120, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many events", 429);
  const body = await request.text();
  if (body.length > 4_096) return jsonError("Event too large", 413);
  const parsed = commerceEventSchema.safeParse((() => { try { return JSON.parse(body); } catch { return null; } })());
  if (!parsed.success) return jsonError("Invalid event", 400);
  const event = parsed.data;
  let params: Record<string, unknown>;
  if (event.event === "view_item") {
    const product = await db.product.findFirst({ where: { id: event.productId, storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } }, select: { id: true } });
    if (!product) return jsonError("Product not found", 404);
    params = { items: [{ item_id: product.id }] };
  } else if (event.event === "begin_checkout") {
    const ids = [...new Set(event.items.map(item => item.variantId))];
    const variants = await db.productVariant.findMany({ where: { id: { in: ids }, active: true, product: { storeId: store.id, status: "ACTIVE", shopVisible: true } }, select: { id: true } });
    if (variants.length !== ids.length) return jsonError("Product variant not found", 404);
    params = { items: event.items.map(item => ({ item_id: item.variantId, quantity: item.quantity })) };
  } else {
    const user = await getCurrentUser();
    const tokenHash = event.claimToken ? sha256(event.claimToken) : undefined;
    const order = await db.order.findFirst({
      where: { id: event.orderId, storeId: store.id, OR: [
        user ? { userId: user.id } : { id: "00000000-0000-0000-0000-000000000000" },
        tokenHash ? { claimTokenHash: tokenHash, claimExpiresAt: { gt: new Date() } } : { id: "00000000-0000-0000-0000-000000000000" },
      ] },
      select: { id: true, status: true, totalCents: true, currency: true, items: { select: { variantId: true, quantity: true, unitPriceCents: true } } },
    });
    if (!order) return jsonError("Order not found", 404);
    if (!purchaseEligible(order.status)) return jsonError("Purchase not confirmed", 409);
    params = purchaseParams(order);
  }

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(stream.measurementId)}&api_secret=${encodeURIComponent(stream.apiSecret)}`;
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(commercePayload(event.event, params, event.clientId)), cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return jsonError("Measurement temporarily unavailable", 503);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Measurement temporarily unavailable", 503);
  }
}
