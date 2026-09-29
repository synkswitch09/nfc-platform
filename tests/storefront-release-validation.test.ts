import { describe, expect, it } from "vitest";
import { storefrontReleaseSchema } from "@/lib/storefront-release-schema";
import { validateReleaseAssets, validateReleaseReferences } from "@/lib/storefront-release-validation";
import { readReleaseRequest, releaseErrorResponse } from "@/lib/storefront-release-request";

const base = () => ({ kind: "tapkin-storefront-release", version: 1, generatedAt: "2026-09-22T00:00:00.000Z", source: { storeSlug: "source" }, store: {}, categories: [], pages: [], products: [], categoryImages: [], assets: [] });
const product = { slug: "pet", name: "Pet", description: "NFC pet tag", type: "PET", brand: "Tapkin" };
const key = "development-source-00000000-0000-0000-0000-000000000001.png";
const bytesBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDAAAAABJRU5ErkJggg==";
const asset = { storageKey: key, mimeType: "image/png", byteSize: Buffer.from(bytesBase64, "base64").length, width: 1, height: 1, bytesBase64 };
const media = { ...asset, url: `/api/media/${key}` };

describe("release field and reference validation", () => {
  it("strips operational data and nested Prisma writes from older or edited packages", () => {
    const parsed = storefrontReleaseSchema.parse({ ...base(), store: { displayName: "Changed", currency: "USD", shippingConfig: {}, domains: { deleteMany: {} }, orders: { deleteMany: {} } }, products: [{ ...product, storeId: "foreign", variants: [{ sku: "PET", name: "Mint", priceCents: 2000, inventory: 500, reservedInventory: 20, defaultPackagingId: "foreign", product: { connect: { id: "foreign" } } }] }] });
    expect(parsed.store).toEqual({ displayName: "Changed" });
    expect(parsed.products[0]).not.toHaveProperty("storeId");
    expect(parsed.products[0].variants[0]).toEqual({ sku: "PET", name: "Mint", priceCents: 2000 });
  });
  it("identifies the actual invalid product field", () => {
    const result = storefrontReleaseSchema.safeParse({ ...base(), products: [{ ...product, variants: [{ sku: "PET", name: "Mint", priceCents: -1 }] }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(releaseErrorResponse(result.error).message).toContain("products.0.variants.0.priceCents");
  });
  it("rejects missing category and image references before import", () => {
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), products: [{ ...product, categorySlug: "absent" }] }))).toThrow("categorySlug");
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), store: { logoUrl: `/api/media/${key}` } }))).toThrow("store.logoUrl");
  });
  it("rejects duplicate SKUs and ambiguous page routes", () => {
    const variants = [{ sku: "PET", name: "Mint", priceCents: 2000 }];
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), products: [{ ...product, variants }, { ...product, slug: "other", variants }] }))).toThrow("variants.sku");
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), categories: [{ name: "Pets", slug: "pets" }], pages: [{ kind: "CAMPAIGN", name: "Pets", slug: "pets" }] }))).toThrow("cannot share a slug");
  });
  it("rejects an image attached to an option belonging to another product", () => {
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), products: [{ ...product, images: [{ ...media, altText: "Tag", optionValue: { code: "colour", value: "mint" } }] }], assets: [asset] }))).toThrow("Option value does not belong");
  });
  it("validates embedded bytes against metadata", () => {
    const parsed = storefrontReleaseSchema.parse({ ...base(), assets: [asset], categoryImages: [media] });
    expect(() => validateReleaseReferences(parsed)).not.toThrow();
    expect(validateReleaseAssets(parsed).get(key)).toEqual(Buffer.from(bytesBase64, "base64"));
    for (const change of [{ width: 2 }, { byteSize: 1 }, { mimeType: "image/jpeg" }, { bytesBase64: bytesBase64 + "!" }]) {
      expect(() => validateReleaseAssets(storefrontReleaseSchema.parse({ ...base(), assets: [{ ...asset, ...change }] }))).toThrow("assets[0]");
    }
  });
  it("rejects unregistered and duplicate embedded images", () => {
    expect(() => validateReleaseReferences(storefrontReleaseSchema.parse({ ...base(), assets: [asset] }))).toThrow("no media record");
    expect(() => validateReleaseAssets(storefrontReleaseSchema.parse({ ...base(), assets: [asset, asset] }))).toThrow("Duplicate value");
  });
});

describe("bounded release request parsing", () => {
  it("parses JSON and reports malformed input clearly", async () => {
    expect(await readReleaseRequest(new Request("https://example.test", { method: "POST", body: '{"version":1}' }))).toEqual({ version: 1 });
    await expect(readReleaseRequest(new Request("https://example.test", { method: "POST", body: "{" }))).rejects.toThrow("valid JSON");
  });
  it.each([null, "1"])("enforces actual streamed size when content-length is %s", async (length) => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024)); }, cancel() { cancelled = true; } });
    const request = { headers: new Headers(length ? { "content-length": length } : {}), body } as Request;
    await expect(readReleaseRequest(request)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
});
