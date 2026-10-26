import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ store: vi.fn(), origin: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: mocks.store }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: mocks.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: mocks.find } } }));
import { POST } from "@/app/api/favourites/products/route";
const request = (slugs: unknown) => new NextRequest("https://kosykin.com.au/api/favourites/products", { method: "POST", body: JSON.stringify({ slugs }) });
beforeEach(() => { vi.resetAllMocks(); mocks.store.mockResolvedValue({ id: "kosykin-store", status: "ACTIVE", accountConfig: { favouritesEnabled: true } }); mocks.origin.mockReturnValue(true); mocks.find.mockResolvedValue([]); });
it("resolves guest favourites using only public active products in the current store", async () => {
  const response = await POST(request(["wavy-stand"]));
  expect(response.status).toBe(200);
  expect(mocks.find.mock.calls[0][0].where).toEqual({ storeId: "kosykin-store", status: "ACTIVE", shopVisible: true, slug: { in: ["wavy-stand"] } });
  expect(mocks.find.mock.calls[0][0].select.variants.select).toMatchObject({ priceCents: true, optionSelection: true });
  expect(mocks.find.mock.calls[0][0].select.variants.take).toBeUndefined();
  expect(mocks.find.mock.calls[0][0].select.options.where).toEqual({ active: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects oversized, disabled and cross-origin lookups before querying the catalogue", async () => {
  expect((await POST(request(Array(101).fill("wavy")))).status).toBe(400);
  mocks.store.mockResolvedValue({ id: "kosykin-store", status: "ACTIVE", accountConfig: { favouritesEnabled: false } });
  expect((await POST(request(["wavy"]))).status).toBe(404);
  mocks.origin.mockReturnValue(false);
  expect((await POST(request(["wavy"]))).status).toBe(403);
  expect(mocks.find).not.toHaveBeenCalled();
});
