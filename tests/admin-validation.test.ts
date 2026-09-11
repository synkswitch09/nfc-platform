import { describe, expect, it } from "vitest";
import { activationRegenerationSchema, adminCategorySchema, adminProductSchema, inventoryAdjustmentSchema } from "@/lib/admin-validation";

const validProduct = {
  name: "Pet tag", slug: "pet-tag", description: "A durable NFC pet tag.", type: "PET", status: "DRAFT", featured: false, shopVisible: false, brand: "Tapkin", gstInclusive: true, indexable: true,
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
    expect(adminCategorySchema.safeParse({ name: "Pet Tags", slug: "Pet Tags", sortOrder: 0, status: "PUBLISHED" }).success).toBe(false);
    expect(inventoryAdjustmentSchema.safeParse({ variantId: crypto.randomUUID(), quantity: 3, reason: "" }).success).toBe(false);
  });
  it("accepts structured category content and rejects unsafe CTA paths", () => {
    const category = { name: "Pet", slug: "pet", sortOrder: 0, status: "PUBLISHED", visualTheme: "CORAL", landingLayout: "EDITORIAL", showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, indexable: true, benefits: [], useCases: [], howItWorks: [], contentSections: [], faq: [] };
    expect(adminCategorySchema.safeParse({ ...category, ctaHref: "/shop?category=pet" }).success).toBe(true);
    expect(adminCategorySchema.safeParse({ ...category, ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(adminCategorySchema.safeParse({ ...category, slug: "admin" }).success).toBe(false);
  });
  it("requires explicit identity verification before credential regeneration", () => {
    const request = { reason: "CUSTOMER_LOST_CODE", note: "Verified against the original order", confirmedIdentity: true };
    expect(activationRegenerationSchema.safeParse(request).success).toBe(true);
    expect(activationRegenerationSchema.safeParse({ ...request, confirmedIdentity: false }).success).toBe(false);
  });
  it("validates Store-configured swatches and variant option mappings", () => {
    const configured = { ...validProduct, personalisationMode: "NONE", options: [{ name: "Colour", code: "colour", type: "COLOUR", required: true, priceDeltaCents: 0, active: true, values: [{ label: "Ocean", value: "ocean", priceDeltaCents: 0, active: true, swatchHex: "#167d9a" }] }], variants: [{ ...validProduct.variants[0], optionSelection: { colour: "ocean" }, isDefault: true }] };
    expect(adminProductSchema.safeParse(configured).success).toBe(true);
    expect(adminProductSchema.safeParse({ ...configured, variants: [{ ...configured.variants[0], optionSelection: { colour: "missing" } }] }).success).toBe(false);
  });
});
