import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ store: vi.fn(), config: vi.fn(), limit: vi.fn(), product: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: m.store }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { product: { findFirst: m.product } } }));
import { POST } from "@/app/api/analytics/route";
const request = (cookie = "") => new NextRequest("https://kosykin.test/api/analytics", { method: "POST", headers: { origin: "https://kosykin.test", host: "kosykin.test", cookie }, body: JSON.stringify({ event: "view_item", productId: "edc19676-41d5-4f57-98f4-6a08d32714d3", clientId: "123.456" }) });
const consent = (store: string, analytics = true) => `privacy-preferences-${store}=${encodeURIComponent(JSON.stringify({ version: 1, analytics, advertising: false, savedAt: Date.now() }))}`;
beforeEach(() => {
  vi.resetAllMocks(); m.store.mockResolvedValue({ id: "store-1", slug: "kosykin", integrations: { analyticsEnabled: true, ga4MeasurementId: "G-CMS1234567" } });
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: { apiSecret: "private-server-secret", measurementId: "G-OLD1234567" } } });
  m.limit.mockResolvedValue({ allowed: true }); m.product.mockResolvedValue({ id: "product-1" }); m.fetch.mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal("fetch", m.fetch);
});
it("does not send without consent, after rejection, or with another store's consent", async () => {
  for (const cookie of ["", consent("tapkin"), consent("kosykin", false), "privacy-preferences-kosykin=yes"]) expect((await POST(request(cookie))).status).toBe(403);
  expect(m.product).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled();
});
it("uses the CMS identifier only with explicit consent and the matching store credential", async () => {
  expect((await POST(request(consent("kosykin")))).status).toBe(200);
  expect(m.fetch.mock.calls[0][0]).toContain("measurement_id=G-CMS1234567");
  expect(m.product.mock.calls[0][0].where.storeId).toBe("store-1");
});
it("never measures staging or a CMS-disabled store", async () => {
  m.config.mockReturnValue({ appEnv: "staging", analyticsStores: { kosykin: {} } }); expect((await POST(request(consent("kosykin")))).status).toBe(404);
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: {} } }); m.store.mockResolvedValue({ slug: "kosykin", integrations: { analyticsEnabled: false } });
  expect((await POST(request(consent("kosykin")))).status).toBe(404); expect(m.fetch).not.toHaveBeenCalled();
});
