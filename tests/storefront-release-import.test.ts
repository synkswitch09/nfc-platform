import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const model = () => ({ update: vi.fn(), create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() });
  const tx = { store: model(), product: model(), productVariant: model(), contentPage: model(), landingPageSection: model(), landingPageSectionTranslation: model(), contentPageTranslation: model(), auditLog: model() };
  return { tx, transaction: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/storage", () => ({ getStorageProvider: () => ({ get: mocks.get, put: mocks.put, delete: mocks.delete }) }));
import { importStorefrontRelease } from "@/lib/storefront-release";

const base = () => ({ kind: "tapkin-storefront-release", version: 1, generatedAt: "2026-09-22T00:00:00.000Z", source: { storeSlug: "source" }, store: {}, categories: [], pages: [], products: [], categoryImages: [], assets: [] });
const run = (releaseInput: unknown) => importStorefrontRelease({ releaseInput, storeId: "target", storeSlug: "target", actorId: "admin" });
const product = { slug: "pet-tag", name: "Pet tag", variants: [{ sku: "PET-1", name: "Mint", priceCents: 2495, inventory: 900, reservedInventory: 800 }] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.product.findUnique.mockResolvedValue({ id: "product" });
  mocks.tx.product.update.mockResolvedValue({ id: "product" });
  mocks.tx.contentPage.create.mockResolvedValue({ id: "page" });
  mocks.tx.landingPageSection.create.mockResolvedValue({ id: "section" });
});

describe("release import operational boundaries", () => {
  it("does not write source quantities over existing destination stock", async () => {
    mocks.tx.productVariant.findUnique.mockResolvedValue({ id: "variant", productId: "product", product: { storeId: "target" } });
    await run({ ...base(), products: [product] });
    const data = mocks.tx.productVariant.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("inventory");
    expect(data).not.toHaveProperty("reservedInventory");
    expect(data.priceCents).toBe(2495);
  });
  it("starts a new variant with zero stock and reservations even for an older release", async () => {
    mocks.tx.productVariant.findUnique.mockResolvedValue(null);
    await run({ ...base(), products: [product] });
    expect(mocks.tx.productVariant.create.mock.calls[0][0].data).toMatchObject({ inventory: 0, reservedInventory: 0 });
  });
  it.each([
    [{ id: "variant", productId: "other", product: { storeId: "other-store" } }, "RELEASE_SKU_BELONGS_TO_ANOTHER_STORE"],
    [{ id: "variant", productId: "other", product: { storeId: "target" } }, "RELEASE_SKU_BELONGS_TO_ANOTHER_PRODUCT"],
  ])("never moves an existing SKU to a different product or store", async (variant, error) => {
    mocks.tx.productVariant.findUnique.mockResolvedValue(variant);
    await expect(run({ ...base(), products: [product] })).rejects.toThrow(error as string);
    expect(mocks.tx.productVariant.update).not.toHaveBeenCalled();
  });
  it("persists section translations separately using the destination section ID", async () => {
    await run({ ...base(), pages: [{ slug: "faq", name: "FAQ", kind: "CUSTOM", sections: [{ type: "FAQ", name: "Questions", content: { items: [] }, translations: [{ locale: "es", content: { headline: "Preguntas" } }] }] }] });
    expect(mocks.tx.landingPageSection.create.mock.calls[0][0].data).not.toHaveProperty("translations");
    expect(mocks.tx.landingPageSectionTranslation.createMany).toHaveBeenCalledWith({ data: [{ sectionId: "section", locale: "es", content: { headline: "Preguntas" } }] });
  });
});
