import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ products: vi.fn(), categories: vi.fn(), pages: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: mocks.products }, productCategory: { findMany: mocks.categories }, contentPage: { findMany: mocks.pages } } }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ appEnv: "production" }), searchEnginePolicy: () => ({ index: true }) }));
vi.mock("@/lib/storefront", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/storefront")>();
  return { ...actual, getCurrentStorefront: () => ({ id: "shop", status: "ACTIVE", origin: "https://tapkin.example", capabilities: ["COMMERCE"], defaultLocale: "en-AU", enabledLocales: ["en-AU", "es-CO"] }) };
});
import sitemap from "@/app/sitemap";

const before = process.env.DATABASE_URL;
afterEach(() => { process.env.DATABASE_URL = before; vi.resetAllMocks(); });

describe("published sitemap", () => {
  it("includes reachable CMS content, real translations, and excludes external canonicals", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    mocks.products.mockResolvedValue([{ slug: "pet-tag", canonicalUrl: null, updatedAt: new Date("2026-09-22") }, { slug: "duplicate", canonicalUrl: "https://tapkin.example/products/pet-tag", updatedAt: new Date() }]);
    mocks.categories.mockResolvedValue([]);
    mocks.pages.mockResolvedValue([{ slug: "materials", canonicalUrl: null, updatedAt: new Date("2026-09-22"), translations: [{ locale: "es-CO" }], sections: [{ translations: [{ locale: "es-CO" }] }] }]);
    const urls = await sitemap();
    expect(urls.map(item => item.url)).toEqual(["https://tapkin.example/", "https://tapkin.example/shop", "https://tapkin.example/products/pet-tag", "https://tapkin.example/materials", "https://tapkin.example/materials?locale=es-CO"]);
    expect(urls.at(-1)?.alternates?.languages?.["en-AU"]).toBe("https://tapkin.example/materials");
    expect(mocks.pages.mock.calls[0][0].where).toMatchObject({ status: "PUBLISHED", indexable: true });
  });

  it("surfaces database failures instead of returning a misleading partial index", async () => {
    process.env.DATABASE_URL = "postgresql://test";
    mocks.products.mockRejectedValue(new Error("DB unavailable"));
    mocks.categories.mockResolvedValue([]);
    mocks.pages.mockResolvedValue([]);
    await expect(sitemap()).rejects.toThrow("DB unavailable");
  });
});
