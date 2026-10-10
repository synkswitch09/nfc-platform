import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ config: vi.fn(), products: vi.fn(), pool: vi.fn(), booked: vi.fn() }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: m.products }, productionPool: { findUnique: m.pool }, productionBooking: { aggregate: m.booked } } }));
import { buildMetaCatalog, csvCell, publicCatalogImage } from "@/lib/meta-catalog";
import type { Storefront } from "@/lib/storefront";
const store = { id: "store1", slug: "kosykin", origin: "https://kosykin.com.au", environment: "PRODUCTION", status: "ACTIVE", currency: "AUD", displayName: "Kosykin", integrations: { metaCatalogEnabled: true, metaCatalogId: "12345" } } as Storefront;
const product = { id: "product1", name: 'Stand, "cosy"', slug: "stand", description: "Public description", brand: "Kosykin", personalisationMode: "NONE", options: [], images: [{ url: "/images/product.jpg" }], variants: [{ id: "variant1", name: "Blue", priceCents: 2495, inventory: 5, reservedInventory: 0, trackInventory: true, backorderPolicy: "DENY", productionMinutes: 30, optionSelection: {}, image: null }] };
beforeEach(() => { vi.resetAllMocks(); m.config.mockReturnValue({ appEnv: "production", checkoutEnabled: true }); m.products.mockResolvedValue([product]); m.pool.mockResolvedValue({ paused: false, weeklyCapacityMinutes: 360, maxBusinessDays: 10 }); m.booked.mockResolvedValue({ _sum: { minutes: 0 } }); });
it("exports only current store variants with prices, escaped public text, images and matching links", async () => {
  const feed = await buildMetaCatalog(store);
  expect(feed?.count).toBe(1); expect(feed?.csv).toContain('"variant1","product1","Stand, ""cosy"""');
  expect(feed?.csv).toContain('"24.95 AUD"'); expect(feed?.csv).toContain("https://kosykin.com.au/products/stand?variant=variant1");
  expect(m.products.mock.calls[0][0].where).toMatchObject({ storeId: "store1", status: "ACTIVE", shopVisible: true, category: { storeId: "store1", status: "PUBLISHED" } });
});
it("does not serve staging catalogs and omits variants without usable public images", async () => {
  m.config.mockReturnValue({ appEnv: "staging" }); expect(await buildMetaCatalog(store)).toBeNull(); expect(m.products).not.toHaveBeenCalled();
  m.config.mockReturnValue({ appEnv: "production", checkoutEnabled: true }); m.products.mockResolvedValue([{ ...product, images: [{ url: "https://blob.test/image?sig=private" }] }]);
  expect(await buildMetaCatalog(store)).toMatchObject({ count: 0, skipped: 1 });
});
it("respects stock, made-to-order capacity and paused manufacturing", async () => {
  m.products.mockResolvedValue([{ ...product, variants: [{ ...product.variants[0], inventory: 0, trackInventory: false }] }]);
  expect((await buildMetaCatalog(store))?.csv).toContain('"available for order"');
  m.pool.mockResolvedValue({ paused: true, weeklyCapacityMinutes: 360, maxBusinessDays: 10 }); expect((await buildMetaCatalog(store))?.csv).toContain('"out of stock"');
});
it("rejects private, credential-bearing and non-HTTPS images, and neutralises CSV formulas", () => {
  for (const path of ["/api/support/ticket/photos/0", "data:image/png,private", "https://user:pass@example.com/image.jpg", "https://blob.test/image?sig=private", "http://example.com/image.jpg"]) expect(publicCatalogImage(path, store.origin)).toBeNull();
  expect(csvCell("=HYPERLINK(secret)")).toBe('"\'=HYPERLINK(secret)"');
});
