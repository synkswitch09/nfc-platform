import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ config: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), cleanup: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/db", () => ({ db: { measurementDelivery: { findMany: m.findMany, updateMany: m.updateMany, findUnique: m.findUnique }, measurementSession: { deleteMany: m.cleanup } } }));
import { measurementAvailability, queueMeasurement, processMeasurementDeliveries, queueOrderMeasurement, safeShoppingPath, browserMeasurementSchema } from "@/lib/measurement";
import { parseIntegrationConfig } from "@/lib/integration-config";
import type { Prisma, MeasurementSession } from "@prisma/client";
const config = parseIntegrationConfig({ analyticsEnabled: true, ga4MeasurementId: "G-ABCDEF1234", metaPixelId: "12345678", metaCapiEnabled: true, metaPixelEnabled: true });
const session = { id: "session", storeId: "store", clientId: "123.456", sessionId: "1700000000", analytics: true, advertising: true, expiresAt: new Date(Date.now() + 3600_000), clientUserAgent: "Mozilla/5.0 TestBrowser", fbp: null, fbc: null } as MeasurementSession;
const row = (provider = "GA4") => ({ id: "delivery", storeId: "store", sessionId: "session", provider, eventKey: "purchase:order", eventName: "purchase", targetId: provider === "GA4" ? config.ga4MeasurementId : config.metaPixelId, eventTime: new Date(), status: "PENDING", attempts: 1, payload: { transaction_id: "order", value: 20, shipping: 9, currency: "AUD", items: [{ item_id: "variant", quantity: 1, price: 20 }] }, session, store: { slug: "kosykin", accountConfig: { integrations: config }, domains: [{ hostname: "kosykin.com.au" }] } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", m.fetch);
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: { measurementId: config.ga4MeasurementId, apiSecret: "secret-private" } }, metaStores: { kosykin: { pixelId: config.metaPixelId, accessToken: "token-private" } } });
  m.findMany.mockResolvedValue([{ id: "delivery" }]); m.updateMany.mockResolvedValue({ count: 1 }); m.findUnique.mockResolvedValue(row()); m.fetch.mockResolvedValue(new Response(null, { status: 204 }));
});
describe("measurement delivery privacy and idempotency", () => {
  it("does not send staging or mismatched store credentials", async () => {
    m.config.mockReturnValue({ appEnv: "staging", analyticsStores: {}, metaStores: {} });
    expect(await processMeasurementDeliveries()).toEqual({ checked: 0 }); expect(m.findMany).not.toHaveBeenCalled();
    m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: { measurementId: "G-OTHER12345", apiSecret: "secret" } }, metaStores: { kosykin: { pixelId: "99999999", accessToken: "token" } } });
    expect(measurementAvailability("kosykin", config)).toMatchObject({ ga4: false, capi: false, pixel: true });
  });
  it("uses a persistent unique key for both provider queues", async () => {
    const upsert = vi.fn(); const tx = { measurementDelivery: { upsert } } as unknown as Prisma.TransactionClient;
    await queueMeasurement(tx, { storeId: "store", slug: "kosykin", config, session, name: "purchase", eventKey: "purchase:order", params: { value: 20 } });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(c => c[0].where.storeId_provider_eventKey)).toEqual([{ storeId: "store", provider: "GA4", eventKey: "purchase:order" }, { storeId: "store", provider: "META", eventKey: "purchase:order" }]);
    expect(upsert.mock.calls.every(c => Object.keys(c[0].update).length === 0)).toBe(true);
  });
  it("records one purchase or refund from stored payment facts without personal data", async () => {
    const order = { id: "order", storeId: "store", subtotalCents: 2000, discountCents: 200, shippingCents: 900, currency: "AUD", checkoutEnvironment: "PRODUCTION", measurementSession: session, store: { slug: "kosykin", accountConfig: { integrations: config } }, items: [{ variantId: "variant", quantity: 1, unitPriceCents: 2000, personalisation: { name: "Daniel" } }], customerName: "Private person" };
    const upsert = vi.fn(); const tx = { order: { findUnique: vi.fn().mockResolvedValue(order) }, measurementDelivery: { upsert } } as unknown as Prisma.TransactionClient;
    await queueOrderMeasurement(tx, "order"); await queueOrderMeasurement(tx, "order", { id: "refund1", amountCents: 1200 });
    expect(upsert).toHaveBeenCalledTimes(3); // GA4 + Meta purchase, GA4 refund only.
    expect(upsert.mock.calls[2][0].create).toMatchObject({ provider: "GA4", eventName: "refund", eventKey: "refund:refund1", payload: { transaction_id: "order", value: 12 } });
    expect(JSON.stringify(upsert.mock.calls)).not.toMatch(/Daniel|Private person|personalisation/);
  });
  it("does not send revoked, expired or retargeted queued events", async () => {
    for (const altered of [{ ...row(), session: { ...session, analytics: false } }, { ...row(), session: { ...session, expiresAt: new Date(0) } }, { ...row(), targetId: "G-OTHER12345" }]) {
      m.findUnique.mockResolvedValue(altered); await processMeasurementDeliveries();
    }
    expect(m.fetch).not.toHaveBeenCalled(); expect(m.updateMany.mock.calls.some(c => c[0].data.status === "SKIPPED")).toBe(true);
  });
  it("sends GA4 with anonymous session parameters and refuses ambiguous retries", async () => {
    await processMeasurementDeliveries();
    const payload = JSON.parse(m.fetch.mock.calls[0][1].body);
    expect(payload.events[0].params).toMatchObject({ session_id: session.sessionId, engagement_time_msec: 1, transaction_id: "order" });
    expect(JSON.stringify(payload)).not.toMatch(/client_user_agent|email|token-private|secret-private/);
    m.fetch.mockRejectedValue(new Error("secret-bearing-url")); await processMeasurementDeliveries();
    expect(m.updateMany.mock.calls.at(-1)![0].data).toMatchObject({ status: "REVIEW_REQUIRED", lastError: "Submission outcome uncertain" });
  });
  it("sends Meta's shared event ID and public source, without contact details or checkout tokens", async () => {
    m.findUnique.mockResolvedValue(row("META")); await processMeasurementDeliveries();
    const payload = JSON.parse(m.fetch.mock.calls[0][1].body).data[0];
    expect(payload).toMatchObject({ event_id: "purchase:order", event_name: "Purchase", event_source_url: "https://kosykin.com.au/checkout", custom_data: { value: 29, content_ids: ["variant"] } });
    expect(payload.user_data.external_id[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(payload)).not.toMatch(/claimToken|guestEmail|phone|client_ip_address|token-private/);
  });
  it("does not submit without an acquired lease, and marks permanent provider rejection", async () => {
    m.updateMany.mockResolvedValue({ count: 0 }); await processMeasurementDeliveries(); expect(m.fetch).not.toHaveBeenCalled();
    m.updateMany.mockResolvedValue({ count: 1 }); m.fetch.mockResolvedValue(new Response("secret-response", { status: 400 })); await processMeasurementDeliveries();
    expect(m.updateMany.mock.calls.at(-1)![0].data).toMatchObject({ status: "FAILED", lastError: "Provider HTTP 400" });
  });
  it("excludes private URLs and accepts only allowlisted personalizer metadata", () => {
    for (const p of ["/admin", "/support", "/dashboard", "/order/123/success", "/p/ABC", "/shop?email=private", "//foreign.test"]) expect(safeShoppingPath(p)).toBe(false);
    expect(safeShoppingPath("/products/custom-name-keychain")).toBe(true);
    const data = browserMeasurementSchema.parse({ event: "personalizer_interaction", eventId: "edc19676-41d5-4f57-98f4-6a08d32714d3", productId: "edc19676-41d5-4f57-98f4-6a08d32714d3", action: "change", field: "text", value: "secret" });
    expect(data).not.toHaveProperty("value");
  });
});
