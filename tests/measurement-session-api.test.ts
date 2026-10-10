import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ store: vi.fn(), config: vi.fn(), limit: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: m.store }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/db", () => ({ db: { measurementSession: { findFirst: m.find, create: m.create, update: m.update } } }));
import { POST } from "@/app/api/analytics/session/route";
const preferences = (analytics: boolean, advertising: boolean) => `privacy-preferences-kosykin=${encodeURIComponent(JSON.stringify({ version: 1, analytics, advertising, savedAt: Date.now() }))}`;
const token = `measurement-kosykin=${"a".repeat(64)}`;
const request = (cookie = "", body: unknown = { clientId: "123.456" }, origin = "https://kosykin.test") => new NextRequest("https://kosykin.test/api/analytics/session", { method: "POST", headers: { origin, host: "kosykin.test", cookie, "user-agent": "Mozilla/5.0 TestBrowser" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); m.store.mockResolvedValue({ id: "s", slug: "kosykin", integrations: { analyticsEnabled: true, ga4MeasurementId: "G-ABCDEF1234", metaPixelEnabled: true, metaPixelId: "12345678" } });
  m.config.mockReturnValue({ appEnv: "production", analyticsStores: { kosykin: { measurementId: "G-ABCDEF1234", apiSecret: "private-secret" } }, metaStores: {} });
  m.limit.mockResolvedValue({ allowed: true }); m.find.mockResolvedValue(null);
});
it("does not create identifiers without consent or in staging", async () => {
  expect((await POST(request())).status).toBe(200); expect(m.create).not.toHaveBeenCalled();
  m.config.mockReturnValue({ appEnv: "staging" }); expect((await POST(request(preferences(true, true)))).status).toBe(404); expect(m.create).not.toHaveBeenCalled();
});
it("stores only an opaque hash and issues a bounded secure HttpOnly cookie", async () => {
  const response = await POST(request(preferences(true, false), { clientId: "123.456", email: "private@example.com", name: "Daniel" }));
  expect(response.status).toBe(200); const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=lax");
  const data = m.create.mock.calls[0][0].data;
  expect(data).toMatchObject({ storeId: "s", clientId: "123.456", analytics: true, advertising: false, fbp: null, fbc: null, clientUserAgent: null });
  expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/); expect(cookie).not.toContain(data.tokenHash);
  expect(JSON.stringify(data)).not.toMatch(/Daniel|private@example/); expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(90 * 86400_000);
});
it("revokes the existing session and Meta identifiers for pending server deliveries", async () => {
  m.find.mockResolvedValue({ id: "session", advertising: true, analytics: true });
  await POST(request(`${preferences(false, false)}; ${token}`));
  expect(m.update).toHaveBeenCalledWith({ where: { id: "session" }, data: { analytics: false, advertising: false, fbp: null, fbc: null, clientUserAgent: null } });
  expect(m.create).not.toHaveBeenCalled(); expect(m.find.mock.calls[0][0].where.storeId).toBe("s");
});
it("does not accept contact details as analytics or Meta identifiers and rejects cross-origin requests", async () => {
  expect((await POST(request(preferences(true, true), { clientId: "email@example.com" }))).status).toBe(400);
  expect((await POST(request(preferences(true, true), { clientId: "123.456", fbp: "private@example.com" }))).status).toBe(400);
  expect((await POST(request(preferences(true, true), {}, "https://foreign.test"))).status).toBe(403); expect(m.create).not.toHaveBeenCalled();
});
it("keeps the anonymous client stable and renews the GA4 session after inactivity", async () => {
  m.find.mockResolvedValue({ id: "session", clientId: "old", updatedAt: new Date(Date.now() - 31 * 60_000), fbp: null, fbc: null });
  await POST(request(`${preferences(true, true)}; ${token}`));
  expect(m.update.mock.calls[0][0].data.sessionId).toMatch(/^\d+$/);
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("clientId");
  expect(m.update.mock.calls[0][0].data.clientUserAgent).toBe("Mozilla/5.0 TestBrowser");
});

it("never extends an anonymous record beyond 90 days from creation", async () => {
  const createdAt = new Date(Date.now() - 60 * 86400_000);
  m.find.mockResolvedValue({ id: "session", createdAt, updatedAt: new Date(), fbp: null, fbc: null });
  await POST(request(`${preferences(true, false)}; ${token}`));
  expect(m.update.mock.calls[0][0].data.expiresAt.getTime()).toBe(createdAt.getTime() + 90 * 86400_000);
});
