import { describe, expect, it } from "vitest";
import { adminCategorySchema, adminProductSchema, inventoryAdjustmentSchema } from "@/lib/admin-validation";

const validProduct = {
  name: "Pet tag", slug: "pet-tag", description: "A durable NFC pet tag.", type: "PET", status: "DRAFT", featured: false, brand: "TapKind", gstInclusive: true, indexable: true,
  variants: [{ sku: "PET-001", name: "Standard", priceCents: 2495, inventory: 10, trackInventory: true, lowStockThreshold: 5, backorderPolicy: "DENY", active: true }],
  options: [],
};

describe("admin validation", () => {
  it("normalises product slugs and SKUs", () => {
    const result = adminProductSchema.parse({ ...validProduct, slug: "pet-tag", variants: [{ ...validProduct.variants[0], sku: "pet-001" }] });
    expect(result.variants[0].sku).toBe("PET-001");
  });
  it("rejects duplicate SKUs and unsafe URLs", () => {
    expect(adminProductSchema.safeParse({ ...validProduct, variants: [validProduct.variants[0], validProduct.variants[0]] }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...validProduct, canonicalUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("requires stable category slugs and stock-adjustment reasons", () => {
    expect(adminCategorySchema.safeParse({ name: "Pet Tags", slug: "Pet Tags", sortOrder: 0, active: true }).success).toBe(false);
    expect(inventoryAdjustmentSchema.safeParse({ variantId: crypto.randomUUID(), quantity: 3, reason: "" }).success).toBe(false);
  });
});
