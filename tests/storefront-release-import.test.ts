import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const model = () => ({ update: vi.fn(), create: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() });
  const tx = { store: model(), categoryImage: model(), productImage: model(), product: model(), productVariant: model(), contentPage: model(), landingPageSection: model(), landingPageSectionTranslation: model(), contentPageTranslation: model(), auditLog: model() };
  const reads = { store: { findUniqueOrThrow: vi.fn() }, productCategory: { findMany: vi.fn() }, contentPage: { findMany: vi.fn() }, product: { findMany: vi.fn() }, categoryImage: { findMany: vi.fn() } };
  return { tx, reads, transaction: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() };
});
vi.mock("@/lib/db", () => ({ db: { ...mocks.reads, $transaction: mocks.transaction } }));
vi.mock("@/lib/storage", () => ({ getStorageProvider: () => ({ get: mocks.get, put: mocks.put, delete: mocks.delete }) }));
import { createStorefrontRelease, importStorefrontRelease } from "@/lib/storefront-release";

const base = () => ({ kind: "tapkin-storefront-release", version: 1, generatedAt: "2026-09-22T00:00:00.000Z", source: { storeSlug: "source" }, store: {}, categories: [], pages: [], products: [], categoryImages: [], assets: [] });
const run = (releaseInput: unknown) => importStorefrontRelease({ releaseInput, storeId: "target", storeSlug: "target", actorId: "admin" });
const product = { slug: "pet-tag", name: "Pet tag", description: "Personalised pet tag", type: "PET", brand: "Tapkin", variants: [{ sku: "PET-1", name: "Mint", priceCents: 2495, inventory: 900, reservedInventory: 800 }] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.product.findUnique.mockResolvedValue({ id: "product" });
  mocks.tx.product.update.mockResolvedValue({ id: "product" });
  mocks.tx.product.count.mockResolvedValue(0);
  mocks.tx.contentPage.count.mockResolvedValue(0);
  mocks.tx.contentPage.create.mockResolvedValue({ id: "page" });
  mocks.tx.landingPageSection.create.mockResolvedValue({ id: "section" });
});

describe("release import operational boundaries", () => {
  it("does not transfer a source domain canonical to another storefront", async () => {
    await importStorefrontRelease({ releaseInput: { ...base(), products: [{ ...product, canonicalUrl: "https://source.example/products/pet-tag" }] }, storeId: "target", storeSlug: "target", actorId: "admin", targetOrigin: "https://target.example" });
    expect(mocks.tx.product.update.mock.calls[0][0].data.canonicalUrl).toBeNull();
  });
  it("does not write source quantities over existing destination stock", async () => {
    mocks.tx.productVariant.findUnique.mockResolvedValue({ id: "variant", productId: "product", product: { storeId: "target" } });
    await run({ ...base(), products: [product] });
    const data = mocks.tx.productVariant.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("inventory");
    expect(data).not.toHaveProperty("reservedInventory");
    expect(data.priceCents).toBe(2495);
    expect(data).not.toHaveProperty("defaultPackagingId");
    expect(mocks.tx.product.update.mock.calls[0][0].data).not.toHaveProperty("defaultPackagingId");
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
    await run({ ...base(), pages: [{ slug: "faq", name: "FAQ", kind: "CAMPAIGN", sections: [{ type: "FAQ", name: "Questions", content: { items: [] }, translations: [{ locale: "es", content: { headline: "Preguntas" } }] }] }] });
    expect(mocks.tx.landingPageSection.create.mock.calls[0][0].data).not.toHaveProperty("translations");
    expect(mocks.tx.landingPageSectionTranslation.createMany).toHaveBeenCalledWith({ data: [{ sectionId: "section", locale: "es", content: { headline: "Preguntas" } }] });
  });
});

const sourceKey = "development-source-00000000-0000-0000-0000-000000000001.png";
const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDAAAAABJRU5ErkJggg==", "base64");
const asset = { storageKey: sourceKey, mimeType: "image/png", byteSize: imageBytes.length, width: 1, height: 1, bytesBase64: imageBytes.toString("base64") };
const withMedia = () => ({ ...base(), assets: [asset], categoryImages: [{ ...asset, url: `/api/media/${sourceKey}` }], store: { homepage: { images: [`https://source.test/api/media/${sourceKey}`, `/api/media/${sourceKey} /api/media/${sourceKey}`] } } });

describe("release media safety", () => {
  it("exports images attached to a category's CMS page and excludes operational settings", async () => {
    mocks.reads.store.findUniqueOrThrow.mockResolvedValue({ slug: "source", displayName: "Tapkin", currency: "AUD", shippingConfig: { enabled: true } });
    mocks.reads.productCategory.findMany.mockResolvedValue([{ slug: "pets", name: "Pets", images: [], contentPage: { slug: "pets", name: "Pets", kind: "CATEGORY", sections: [], translations: [], images: [{ ...asset, url: `/api/media/${sourceKey}` }] } }]);
    mocks.reads.contentPage.findMany.mockResolvedValue([]);
    mocks.reads.product.findMany.mockResolvedValue([]);
    mocks.reads.categoryImage.findMany.mockResolvedValue([]);
    mocks.get.mockResolvedValue(imageBytes);
    const release = await createStorefrontRelease("source");
    expect(release.assets).toHaveLength(1);
    expect(release.categoryImages[0]).toMatchObject({ pageSlug: "pets", categorySlug: null });
    expect(release.store).toEqual({ displayName: "Tapkin" });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("validates every embedded image before the first storage or database write", async () => {
    const second = { ...asset, storageKey: sourceKey.replace("000001", "000002"), bytesBase64: "AAAA" };
    const release = withMedia();
    await expect(run({ ...release, assets: [asset, second], categoryImages: [...release.categoryImages, { ...second, url: `/api/media/${second.storageKey}` }] })).rejects.toThrow("assets[1]");
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rewrites absolute and repeated source URLs and reuses verified assets on retry", async () => {
    const files = new Map<string, Buffer>();
    mocks.get.mockImplementation((key) => files.get(key));
    mocks.put.mockImplementation((key, bytes) => { files.set(key, bytes); });
    await run(withMedia());
    await run(withMedia());
    expect(mocks.put).toHaveBeenCalledTimes(1);
    const target = mocks.put.mock.calls[0][0];
    expect(target).toContain("-target-");
    expect(mocks.tx.store.update.mock.calls[0][0].data.homepage.images).toEqual([`/api/media/${target}`, `/api/media/${target} /api/media/${target}`]);
    expect(mocks.tx.categoryImage.upsert.mock.calls[1][0].where.storageKey).toBe(target);
  });
  it("does not overwrite different bytes at an existing destination key", async () => {
    mocks.get.mockResolvedValue(Buffer.from("different"));
    await expect(run(withMedia())).rejects.toThrow("RELEASE_MEDIA_COLLISION");
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps immutable assets after database failure so concurrent imports cannot lose their images", async () => {
    mocks.transaction.mockRejectedValue(new Error("DB failure"));
    await expect(run(withMedia())).rejects.toThrow("DB failure");
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("cannot reassign an image registered to another store", async () => {
    mocks.tx.categoryImage.findUnique.mockResolvedValue({ storeId: "other" });
    await expect(run(withMedia())).rejects.toThrow("RELEASE_MEDIA_OWNER_CONFLICT");
    expect(mocks.tx.categoryImage.upsert).not.toHaveBeenCalled();
  });
  it("cannot detach an existing category page through a standalone page import", async () => {
    mocks.tx.contentPage.findUnique.mockResolvedValue({ id: "page", categoryId: "category" });
    await expect(run({ ...base(), pages: [{ slug: "pets", name: "Pets", kind: "CAMPAIGN" }] })).rejects.toThrow("RELEASE_PAGE_OWNER_CONFLICT");
    expect(mocks.tx.contentPage.update).not.toHaveBeenCalled();
  });
});
