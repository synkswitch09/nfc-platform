import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { purchaseEligible } from "@/lib/commerce-analytics";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { parsePrivacyPreferences, privacyCookieName } from "@/lib/privacy-preferences";
import { browserMeasurementSchema, currentMeasurementSession, measurementAvailability, metaCustomData, metaEventName, queueMeasurement } from "@/lib/measurement";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront();
  const config = parseIntegrationConfig(store.integrations);
  const ready = measurementAvailability(store.slug, config);
  if (getRuntimeConfig().appEnv !== "production" || !(ready.ga4 || ready.capi || ready.pixel)) return jsonError("Measurement unavailable", 404);
  const preferences = parsePrivacyPreferences(request.cookies.get(privacyCookieName(store.slug))?.value);
  if (!preferences?.analytics && !preferences?.advertising) return jsonError("Consent required", 403);
  const session = await currentMeasurementSession(request, store);
  if (!session) return jsonError("Measurement session required", 403);
  if (!(await rateLimit("analytics", getClientIp(request), 120, 3600_000)).allowed) return jsonError("Too many events", 429);
  const text = await request.text();
  if (text.length > 4096) return jsonError("Event too large", 413);
  const parsed = browserMeasurementSchema.safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
  if (!parsed.success) return jsonError("Invalid event", 400);
  const event = parsed.data;
  let params: Record<string, unknown>;
  let eventKey = event.eventId;
  let purchaseTime: Date | undefined;
  if (event.event === "page_view") params = { page_location: `${store.origin}${event.path}` };
  else if (event.event === "view_item" || event.event === "personalizer_interaction") {
    const product = await db.product.findFirst({ where: { id: event.productId, storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } }, select: { id: true, variants: { where: { active: true, ...(event.event === "view_item" && event.variantId ? { id: event.variantId } : {}) }, orderBy: [{ isDefault: "desc" }, { id: "asc" }], take: 1, select: { id: true, priceCents: true } } } });
    if (!product || !product.variants.length) return jsonError("Product not found", 404);
    params = event.event === "personalizer_interaction" ? { product_id: product.id, action: event.action, ...(event.field ? { field: event.field } : {}) } : { currency: store.currency, value: product.variants[0].priceCents / 100, items: [{ item_id: product.variants[0].id, price: product.variants[0].priceCents / 100, quantity: 1 }] };
  } else if (event.event === "add_to_cart" || event.event === "begin_checkout") {
    const ids = [...new Set(event.items.map(item => item.variantId))];
    const variants = await db.productVariant.findMany({ where: { id: { in: ids }, active: true, product: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } } }, select: { id: true, priceCents: true } });
    if (variants.length !== ids.length) return jsonError("Variant not found", 404);
    const prices = new Map(variants.map(v => [v.id, v.priceCents / 100]));
    params = { currency: store.currency, value: event.items.reduce((sum, i) => sum + prices.get(i.variantId)! * i.quantity, 0), items: event.items.map(i => ({ item_id: i.variantId, quantity: i.quantity, price: prices.get(i.variantId) })) };
  } else if (event.event === "purchase") {
    const user = await getCurrentUser();
    const tokenHash = event.claimToken ? sha256(event.claimToken) : undefined;
    const order = await db.order.findFirst({ where: { id: event.orderId, storeId: store.id, OR: [user ? { userId: user.id } : { id: "00000000-0000-0000-0000-000000000000" }, tokenHash ? { claimTokenHash: tokenHash, claimExpiresAt: { gt: new Date() } } : { id: "00000000-0000-0000-0000-000000000000" }] }, select: { id: true, status: true, measurementSessionId: true, currency: true, subtotalCents: true, discountCents: true, shippingCents: true, checkoutEnvironment: true, createdAt: true, statusHistory: { where: { toStatus: "PAID" }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } }, items: { select: { variantId: true, quantity: true, unitPriceCents: true } } } });
    if (!order || order.measurementSessionId !== session.id || order.checkoutEnvironment !== "PRODUCTION") return jsonError("Order not found", 404);
    if (!purchaseEligible(order.status)) return jsonError("Purchase not confirmed", 409);
    purchaseTime = order.statusHistory?.[0]?.createdAt ?? order.createdAt;
    if (Date.now() - purchaseTime.getTime() > 46 * 3600_000) return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    eventKey = `purchase:${order.id}`;
    params = { transaction_id: order.id, currency: order.currency, value: (order.subtotalCents - order.discountCents) / 100, shipping: order.shippingCents / 100, items: order.items.map(i => ({ item_id: i.variantId, quantity: i.quantity, price: i.unitPriceCents / 100 })) };
  }
  else return jsonError("Invalid event", 400);
  const consentSession = { ...session, analytics: session.analytics && Boolean(preferences?.analytics), advertising: session.advertising && Boolean(preferences?.advertising) };
  let pixelAllowed = ready.pixel && consentSession.advertising;
  await db.$transaction(async tx => {
    await queueMeasurement(tx, { storeId: store.id, slug: store.slug, config, session: consentSession, eventKey, name: event.event, params, eventTime: purchaseTime });
    if (event.event === "purchase" && pixelAllowed) {
      const row = await tx.measurementDelivery.upsert({ where: { storeId_provider_eventKey: { storeId: store.id, provider: "PIXEL", eventKey } }, create: { storeId: store.id, sessionId: session.id, provider: "PIXEL", targetId: config.metaPixelId, eventKey, eventName: "purchase", payload: {}, eventTime: purchaseTime }, update: {} });
      const claimed = await tx.measurementDelivery.updateMany({ where: { id: row.id, status: "PENDING", targetId: config.metaPixelId }, data: { status: "DISPATCHED", sentAt: new Date() } });
      pixelAllowed = claimed.count === 1;
    }
  });
  const name = metaEventName(event.event);
  return NextResponse.json({ ok: true, ...(pixelAllowed && name ? { pixel: { eventName: name, eventId: eventKey, data: metaCustomData(params) } } : {}) }, { headers: { "cache-control": "no-store" } });
}
