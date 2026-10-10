import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ store: vi.fn(), config: vi.fn(), limit: vi.fn(), product: vi.fn(), session: vi.fn(), delivery: vi.fn(), variant: vi.fn(), order: vi.fn(), user: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: m.store }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/db", () => ({ db: { product: { findFirst: m.product }, productVariant: { findMany: m.variant }, order: { findFirst: m.order }, measurementSession: { findFirst: m.session }, $transaction: (fn: (tx: unknown) => unknown) => fn({ measurementDelivery: { upsert: m.delivery, updateMany: m.claim } }) } }));
import { POST } from "@/app/api/analytics/route";
const productId = "edc19676-41d5-4f57-98f4-6a08d32714d3";
const variantId = "26d186ad-b40d-43ed-8052-cf9aa84e8f2a";
const request = (cookie = "", body: unknown = { event: "view_item", productId, eventId: productId }) => new NextRequest("https://kosykin.test/api/analytics", { method: "POST", headers: { origin: "https://kosykin.test", host: "kosykin.test", cookie }, body: JSON.stringify(body) });
const consent = (store: string, analytics = true, advertising = false) => `privacy-preferences-${store}=${encodeURIComponent(JSON.stringify({ version: 1, analytics, advertising, savedAt: Date.now() }))}; measurement-kosykin=${"a".repeat(64)}`;
beforeEach(() => {
  vi.resetAllMocks();
  m.store.mockResolvedValue({ id: "store-1", slug: "kosykin", origin: "https://kosykin.test", currency: "AUD", integrations: { analyticsEnabled: true, ga4MeasurementId: "G-CMS1234567", metaPixelEnabled: true, metaCapiEnabled: true, metaPixelId: "12345678" } });
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: { apiSecret: "private-server-secret", measurementId: "G-CMS1234567" } }, metaStores: { kosykin: { pixelId: "12345678", accessToken: "private-token" } } });
  m.limit.mockResolvedValue({ allowed: true }); m.delivery.mockResolvedValue({ id: "delivery" }); m.claim.mockResolvedValue({ count: 1 });
  m.product.mockResolvedValue({ id: productId, variants: [{ id: variantId, priceCents: 2495 }] });
  m.session.mockResolvedValue({ id: "session-1", storeId: "store-1", analytics: true, advertising: true });
});
it("does not query customer data without consent, after rejection or another store's consent", async () => {
  for (const cookie of ["", consent("tapkin"), consent("kosykin", false), "privacy-preferences-kosykin=yes"]) expect((await POST(request(cookie))).status).toBe(403);
  expect(m.product).not.toHaveBeenCalled(); expect(m.delivery).not.toHaveBeenCalled();
});
it("uses validated server prices, variant catalog IDs and only the consented provider", async () => {
  expect((await POST(request(consent("kosykin")))).status).toBe(200);
  expect(m.product.mock.calls[0][0].where.storeId).toBe("store-1");
  expect(m.delivery).toHaveBeenCalledTimes(1);
  expect(m.delivery.mock.calls[0][0].create).toMatchObject({ provider: "GA4", targetId: "G-CMS1234567", payload: { value: 24.95, items: [{ item_id: variantId, price: 24.95 }] } });
});
it("queues Meta with advertising consent even when analytics is denied and uses the same Pixel event ID", async () => {
  const result = await (await POST(request(consent("kosykin", false, true)))).json();
  expect(m.delivery).toHaveBeenCalledTimes(1);
  expect(m.delivery.mock.calls[0][0].create.provider).toBe("META");
  expect(result.pixel.eventId).toBe(m.delivery.mock.calls[0][0].create.eventKey);
  expect(result.pixel.data.content_ids).toEqual([variantId]);
});
it("never measures staging or a CMS-disabled store", async () => {
  m.config.mockReturnValue({ appEnv: "staging", analyticsStores: {}, metaStores: {} }); expect((await POST(request(consent("kosykin")))).status).toBe(404);
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: {}, metaStores: {} }); m.store.mockResolvedValue({ slug: "kosykin", integrations: {} });
  expect((await POST(request(consent("kosykin")))).status).toBe(404); expect(m.delivery).not.toHaveBeenCalled();
});
it("requires a store-bound session and excludes private paths and arbitrary personalizer values", async () => {
  m.session.mockResolvedValue(null); expect((await POST(request(consent("kosykin")))).status).toBe(403);
  expect(m.session.mock.calls[0][0].where.storeId).toBe("store-1");
  m.session.mockResolvedValue({ id: "session-1", analytics: true });
  expect((await POST(request(consent("kosykin"), { event: "page_view", eventId: productId, path: "/order/private?token=secret" }))).status).toBe(400);
  await POST(request(consent("kosykin"), { event: "personalizer_interaction", eventId: productId, productId, action: "change", field: "text", value: "Daniel", email: "private@example.com" }));
  expect(JSON.stringify(m.delivery.mock.calls)).not.toMatch(/Daniel|private@example|token=secret/);
});
it("requires confirmed ownership and the original checkout session for a purchase", async () => {
  m.order.mockResolvedValue({ id: productId, status: "PAID", measurementSessionId: "other", checkoutEnvironment: "PRODUCTION" });
  expect((await POST(request(consent("kosykin"), { event: "purchase", eventId: variantId, orderId: productId }))).status).toBe(404);
  m.order.mockResolvedValue({ id: productId, status: "PAYMENT_PENDING", measurementSessionId: "session-1", checkoutEnvironment: "PRODUCTION" });
  expect((await POST(request(consent("kosykin"), { event: "purchase", eventId: variantId, orderId: productId }))).status).toBe(409);
  m.order.mockResolvedValue({ id: productId, status: "PAID", measurementSessionId: "session-1", checkoutEnvironment: "PRODUCTION", createdAt: new Date(), currency: "AUD", subtotalCents: 5000, discountCents: 500, shippingCents: 900, items: [{ variantId, quantity: 2, unitPriceCents: 2500 }] });
  await POST(request(consent("kosykin", true, true), { event: "purchase", eventId: variantId, orderId: productId }));
  expect(m.delivery.mock.calls[0][0].create).toMatchObject({ eventKey: `purchase:${productId}`, payload: { value: 45, shipping: 9 } });
});

it("does not dispatch a purchase Pixel twice, or replay an old paid order", async () => {
  m.order.mockResolvedValue({ id: productId, status: "PAID", measurementSessionId: "session-1", checkoutEnvironment: "PRODUCTION", createdAt: new Date(), currency: "AUD", subtotalCents: 2000, discountCents: 0, shippingCents: 900, items: [{ variantId, quantity: 1, unitPriceCents: 2000 }] });
  const body = { event: "purchase", eventId: variantId, orderId: productId };
  expect((await (await POST(request(consent("kosykin", true, true), body))).json()).pixel.eventName).toBe("Purchase");
  m.claim.mockResolvedValue({ count: 0 });
  expect(await (await POST(request(consent("kosykin", true, true), body))).json()).not.toHaveProperty("pixel");
  m.delivery.mockClear();
  m.order.mockResolvedValue({ id: productId, status: "PAID", measurementSessionId: "session-1", checkoutEnvironment: "PRODUCTION", createdAt: new Date(0) });
  expect(await (await POST(request(consent("kosykin", true, true), body))).json()).toEqual({ ok: true });
  expect(m.delivery).not.toHaveBeenCalled();
});
