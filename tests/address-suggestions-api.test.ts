import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ store: vi.fn(), config: vi.fn(), limit: vi.fn(), suggest: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: m.store }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/geoapify", () => ({ suggestAustralianAddresses: m.suggest }));
import { POST } from "@/app/api/address-suggestions/route";
const request = (body: unknown, origin = "https://kosykin.test") => new NextRequest("https://kosykin.test/api/address-suggestions", { method: "POST", headers: { origin, host: "kosykin.test" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); m.store.mockResolvedValue({ id: "store-1", slug: "kosykin", integrations: { geoapifyEnabled: true } });
  m.config.mockReturnValue({ trustProxy: false, geoapifyStores: { kosykin: { apiKey: "private-key" } } }); m.limit.mockResolvedValue({ allowed: true }); m.suggest.mockResolvedValue([]);
});
it("uses host-resolved store credentials and never accepts a caller country or store override", async () => {
  const result = await POST(request({ text: "12 Example" })); expect(result.status).toBe(200);
  expect(m.suggest).toHaveBeenCalledWith("12 Example", "private-key"); expect(await result.text()).not.toContain("private-key");
  for (const body of [{ text: "12 Example", country: "US" }, { text: "12 Example", store: "tapkin" }, { text: "123" }]) expect((await POST(request(body))).status).toBe(400);
  expect(m.suggest).toHaveBeenCalledTimes(1);
});
it("does not use provider credits without same origin, enabled settings, credentials and allowance", async () => {
  expect((await POST(request({ text: "12 Example" }, "https://other.test"))).status).toBe(403);
  m.limit.mockResolvedValue({ allowed: false }); expect((await POST(request({ text: "12 Example" }))).status).toBe(429);
  m.config.mockReturnValue({ geoapifyStores: {} }); expect((await POST(request({ text: "12 Example" }))).status).toBe(503);
  m.config.mockReturnValue({ geoapifyStores: { kosykin: { apiKey: "private-key" } } }); m.store.mockResolvedValue({ slug: "kosykin", integrations: { geoapifyEnabled: false } });
  expect((await POST(request({ text: "12 Example" }))).status).toBe(503); expect(m.suggest).not.toHaveBeenCalled();
});
it("preserves manual entry and returns no upstream keys or address details on provider errors", async () => {
  m.suggest.mockRejectedValue(new Error("https://example?apiKey=private-key")); const result = await POST(request({ text: "12 Example" }));
  expect(result.status).toBe(503); expect(await result.text()).not.toContain("private-key");
});
