import { randomUUID } from "node:crypto";
import { Prisma, type MeasurementSession } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { parseIntegrationConfig, type IntegrationConfig } from "@/lib/integration-config";

export const measurementCookie = (slug: string) => `measurement-${slug}`;
import { safeShoppingPath } from "@/lib/measurement-paths";
export { safeShoppingPath } from "@/lib/measurement-paths";
export const browserMeasurementSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("page_view"), eventId: z.string().uuid(), path: z.string().max(200).refine(safeShoppingPath) }),
  z.object({ event: z.literal("view_item"), eventId: z.string().uuid(), productId: z.string().uuid(), variantId: z.string().uuid().optional() }),
  ...(["add_to_cart", "begin_checkout"] as const).map(event => z.object({ event: z.literal(event), eventId: z.string().uuid(), items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(30) })),
  z.object({ event: z.literal("personalizer_interaction"), eventId: z.string().uuid(), productId: z.string().uuid(), action: z.enum(["open", "change", "preview"]), field: z.enum(["size", "font", "colour", "shape", "finish", "attachment", "text", "preview"]).optional() }),
  z.object({ event: z.literal("purchase"), eventId: z.string().uuid(), orderId: z.string().uuid(), claimToken: z.string().min(20).max(200).optional() }),
]);
export type BrowserMeasurement = z.infer<typeof browserMeasurementSchema>;

export function measurementAvailability(slug: string, c: IntegrationConfig) {
  const runtime = getRuntimeConfig();
  const production = runtime.appEnv === "production";
  const ga = runtime.analyticsStores[slug];
  const meta = runtime.metaStores?.[slug];
  return {
    ga4: production && c.analyticsEnabled && Boolean(c.ga4MeasurementId && ga?.measurementId === c.ga4MeasurementId && ga.apiSecret),
    clarity: production && c.clarityEnabled && Boolean(c.clarityProjectId),
    pixel: production && c.metaPixelEnabled && Boolean(c.metaPixelId),
    capi: production && c.metaCapiEnabled && Boolean(c.metaPixelId && meta?.pixelId === c.metaPixelId && meta.accessToken),
    catalog: production && c.metaCatalogEnabled && Boolean(c.metaCatalogId),
  };
}
export async function currentMeasurementSession(request: NextRequest, store: { id: string; slug: string }) {
  const token = request.cookies.get(measurementCookie(store.slug))?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.measurementSession.findFirst({ where: { tokenHash: sha256(token), storeId: store.id, expiresAt: { gt: new Date() } } });
}
export const metaEventName = (name: string) => ({ page_view: "PageView", view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase", personalizer_interaction: "PersonalizerInteraction" })[name as "purchase"] ?? null;
export function metaCustomData(params: Record<string, unknown>) {
  const items = params.items as { item_id: string; quantity?: number; price?: number }[] | undefined;
  return {
    ...(params.currency ? { currency: params.currency } : {}),
    ...(typeof params.value === "number" ? { value: params.value + (typeof params.shipping === "number" ? params.shipping : 0) } : {}),
    ...(items ? { content_type: "product", content_ids: items.map(i => i.item_id), contents: items.map(i => ({ id: i.item_id, quantity: i.quantity ?? 1, ...(typeof i.price === "number" ? { item_price: i.price } : {}) })) } : {}),
  };
}

export async function queueMeasurement(tx: Prisma.TransactionClient, input: { storeId: string; slug: string; config: IntegrationConfig; session: MeasurementSession; eventKey: string; name: string; params: Record<string, unknown>; eventTime?: Date }) {
  const ready = measurementAvailability(input.slug, input.config);
  const providers = [ready.ga4 && input.session.analytics ? "GA4" : null, ready.capi && input.session.advertising && metaEventName(input.name) ? "META" : null].filter(Boolean) as string[];
  for (const provider of providers) {
    // Unique store + provider + event key makes browser retries and webhook replays safe.
    await tx.measurementDelivery.upsert({ where: { storeId_provider_eventKey: { storeId: input.storeId, provider, eventKey: input.eventKey } }, create: {
      storeId: input.storeId, sessionId: input.session.id, provider,
      targetId: provider === "GA4" ? input.config.ga4MeasurementId : input.config.metaPixelId,
      eventKey: input.eventKey, eventName: input.name, payload: { ...input.params, ...(provider === "GA4" ? { session_id: input.session.sessionId } : {}) } as Prisma.InputJsonValue, eventTime: input.eventTime ?? new Date(),
    }, update: {} });
  }
}

export async function queueOrderMeasurement(tx: Prisma.TransactionClient, orderId: string, refund?: { id: string; amountCents: number }) {
  const runtime = getRuntimeConfig();
  if (runtime.appEnv !== "production" || (!Object.keys(runtime.analyticsStores).length && !Object.keys(runtime.metaStores ?? {}).length)) return;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { store: true, measurementSession: true, items: true } });
  if (!order?.measurementSession || order.checkoutEnvironment !== "PRODUCTION") return;
  const session = order.measurementSession;
  if (session.storeId !== order.storeId || session.expiresAt <= new Date()) return;
  const config = parseIntegrationConfig((order.store.accountConfig as Record<string, unknown>)?.integrations);
  const params = refund ? { transaction_id: order.id, currency: order.currency, value: refund.amountCents / 100 } : {
    transaction_id: order.id, currency: order.currency, value: (order.subtotalCents - order.discountCents) / 100,
    shipping: order.shippingCents / 100,
    items: order.items.map(item => ({ item_id: item.variantId, quantity: item.quantity, price: item.unitPriceCents / 100 })),
  };
  await queueMeasurement(tx, { storeId: order.storeId, slug: order.store.slug, config, session, eventKey: refund ? `refund:${refund.id}` : `purchase:${order.id}`, name: refund ? "refund" : "purchase", params });
}

export async function processMeasurementDeliveries() {
  if (getRuntimeConfig().appEnv !== "production") return { checked: 0 };
  const rows = await db.measurementDelivery.findMany({ where: { provider: { in: ["GA4", "META"] }, status: "PENDING", nextAttemptAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { nextAttemptAt: "asc" }, take: 5 });
  for (const candidate of rows) {
    const leaseToken = randomUUID();
    const claimed = await db.measurementDelivery.updateMany({ where: { id: candidate.id, status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: { leaseToken, leaseUntil: new Date(Date.now() + 60_000), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const row = await db.measurementDelivery.findUnique({ where: { id: candidate.id }, include: { session: true, store: { include: { domains: { where: { environment: "PRODUCTION", isPrimary: true }, orderBy: { hostname: "asc" }, take: 1 } } } } });
    if (!row) continue;
    const config = parseIntegrationConfig((row.store.accountConfig as Record<string, unknown>)?.integrations);
    const ready = measurementAvailability(row.store.slug, config);
    const ga4 = row.provider === "GA4";
    const consent = ga4 ? row.session.analytics : row.session.advertising;
    const targetId = ga4 ? config.ga4MeasurementId : config.metaPixelId;
    const finish = (data: Prisma.MeasurementDeliveryUpdateManyMutationInput) => db.measurementDelivery.updateMany({ where: { id: row.id, leaseToken, status: "PENDING" }, data: { ...data, leaseToken: null, leaseUntil: null } });
    // Recheck current consent, store configuration and provider retention on every attempt.
    if (!consent || row.session.expiresAt <= new Date() || row.session.storeId !== row.storeId || !(ga4 ? ready.ga4 : ready.capi) || row.targetId !== targetId || Date.now() - row.eventTime.getTime() > (ga4 ? 70 : 46) * 3600_000) {
      await finish({ status: "SKIPPED", lastError: "Consent, configuration or delivery window changed" }); continue;
    }
    const params = row.payload as Record<string, unknown>;
    if (!ga4 && (!row.session.clientUserAgent || !row.store.domains.length)) { await finish({ status: "SKIPPED", lastError: "Browser agent or production domain missing" }); continue; }
    const runtime = getRuntimeConfig();
    try {
      let response: Response;
      if (ga4) {
        const credential = runtime.analyticsStores[row.store.slug];
        const payload = { client_id: row.session.clientId, timestamp_micros: row.eventTime.getTime() * 1000, non_personalized_ads: true,
          consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
          events: [{ name: row.eventName, params: { ...params, session_id: params.session_id ?? row.session.sessionId, engagement_time_msec: 1 } }] };
        response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(targetId)}&api_secret=${encodeURIComponent(credential.apiSecret)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000) });
      } else {
        const credential = runtime.metaStores[row.store.slug];
        const payload = { data: [{ event_name: metaEventName(row.eventName), event_id: row.eventKey, event_time: Math.floor(row.eventTime.getTime() / 1000), action_source: "website", event_source_url: params.page_location ?? `https://${row.store.domains[0].hostname}/${row.eventName === "purchase" || row.eventName === "begin_checkout" ? "checkout" : "shop"}`,
          user_data: { client_user_agent: row.session.clientUserAgent, external_id: [sha256(`${row.storeId}:${row.session.clientId}`)], ...(row.session.fbp ? { fbp: row.session.fbp } : {}), ...(row.session.fbc ? { fbc: row.session.fbc } : {}) }, custom_data: metaCustomData(params) }] };
        response = await fetch(`https://graph.facebook.com/v24.0/${targetId}/events`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential.accessToken}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000) });
      }
      if (!response.ok) {
        // No response bodies or credential-bearing URLs enter logs/CMS.
        await finish({ status: ga4 && response.status >= 500 ? "REVIEW_REQUIRED" : row.attempts >= 5 || (response.status >= 400 && response.status < 500 && response.status !== 429) ? "FAILED" : "PENDING", lastError: `Provider HTTP ${response.status}`, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** row.attempts)) });
      } else await finish({ status: "SENT", sentAt: new Date(), lastError: null });
    } catch {
      // GA4 offers no general idempotency key. Do not blindly retry an ambiguous submission.
      // Meta event_id deduplicates a retry within the bounded 46-hour window.
      await finish({ status: ga4 ? "REVIEW_REQUIRED" : row.attempts >= 5 ? "FAILED" : "PENDING", lastError: "Submission outcome uncertain", nextAttemptAt: new Date(Date.now() + 300_000) });
    }
  }
  // Limit retained anonymous data. Order pointers become null; deliveries cascade.
  await db.measurementSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { checked: rows.length };
}
