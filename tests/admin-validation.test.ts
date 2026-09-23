import { describe, expect, it } from "vitest";
import { activationRegenerationSchema, adminCategorySchema, adminProductSchema, inventoryAdjustmentSchema } from "@/lib/admin-validation";
import { productValidationFeedback } from "@/lib/product-validation-feedback";

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
  it("accepts carrier-ready customs data and rejects malformed HS codes", () => {
    expect(adminProductSchema.safeParse({ ...validProduct, countryOfOrigin: "au", customsDescription: "Personalised plastic pet tag", hsCode: "392690", customsValueCents: 2495, dutiesHandling: "RECIPIENT_PAYS", restrictedItem: false }).success).toBe(true);
    expect(adminProductSchema.safeParse({ ...validProduct, hsCode: "not-a-code" }).success).toBe(false);
  });
  it("rejects duplicate SKUs and unsafe URLs", () => {
    expect(adminProductSchema.safeParse({ ...validProduct, variants: [validProduct.variants[0], validProduct.variants[0]] }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...validProduct, canonicalUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("requires stable category slugs and stock-adjustment reasons", () => {
    expect(adminCategorySchema.safeParse({ name: "Pet Tags", slug: "Pet Tags", sortOrder: 0, status: "PUBLISHED" }).success).toBe(false);
    expect(inventoryAdjustmentSchema.safeParse({ variantId: crypto.randomUUID(), expectedInventory: 4, quantity: 3, reason: "" }).success).toBe(false);
  });
  it("accepts structured category content and rejects unsafe CTA paths", () => {
    const category = { name: "Pet", slug: "pet", sortOrder: 0, status: "PUBLISHED", visualTheme: "CORAL", landingLayout: "EDITORIAL", showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, indexable: true, benefits: [], useCases: [], howItWorks: [], contentSections: [], faq: [] };
    expect(adminCategorySchema.safeParse({ ...category, ctaHref: "/shop?category=pet" }).success).toBe(true);
    expect(adminCategorySchema.safeParse({ ...category, ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(adminCategorySchema.safeParse({ ...category, slug: "admin" }).success).toBe(false);
  });
  it("accepts uploaded category media and rejects arbitrary internal paths", () => {
    const category = { name: "Pet", slug: "pet", sortOrder: 0, status: "PUBLISHED", visualTheme: "CORAL", landingLayout: "EDITORIAL", showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, indexable: true, benefits: [], useCases: [], howItWorks: [], contentSections: [], faq: [] };
    const cardImageUrl = "/api/media/development-tapkin-550e8400-e29b-41d4-a716-446655440000.webp";
    expect(adminCategorySchema.safeParse({ ...category, cardImageUrl, ogImageUrl: cardImageUrl }).success).toBe(true);
    expect(adminCategorySchema.safeParse({ ...category, cardImageUrl: "/api/admin/users" }).success).toBe(false);
    expect(adminCategorySchema.safeParse({ ...category, cardImageUrl: "http://insecure.example/image.jpg" }).success).toBe(false);
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
  it("accepts a colour, style and size variant when all choices are configured", () => {
    const configured = {
      ...validProduct,
      personalisationMode: "NONE",
      options: [
        { name: "Colour", code: "colour", type: "COLOUR", required: true, priceDeltaCents: 0, active: true, values: [{ label: "Mint", value: "mint", priceDeltaCents: 0, active: true, swatchHex: "#9fd8c3" }] },
        { name: "Style / shape", code: "shape", type: "SELECT", required: true, priceDeltaCents: 0, active: true, values: [{ label: "Bone", value: "bone", priceDeltaCents: 0, active: true }] },
        { name: "Size", code: "size", type: "SELECT", required: true, priceDeltaCents: 0, active: true, values: [{ label: "Medium", value: "medium", priceDeltaCents: 0, active: true }] },
      ],
      variants: [{ ...validProduct.variants[0], optionSelection: { colour: "mint", shape: "bone", size: "medium" }, isDefault: true }],
    };
    expect(adminProductSchema.safeParse(configured).success).toBe(true);
  });
  it("turns technical validation paths into actionable product field messages", () => {
    const invalid = adminProductSchema.safeParse({ ...validProduct, description: "short", variants: [{ ...validProduct.variants[0], sku: "x" }] });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const feedback = productValidationFeedback(invalid.error.issues);
      expect(feedback).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "description", field: "Short description", section: "product-details" }),
        expect.objectContaining({ path: "variants.0.sku", field: "Variant 1 — SKU", section: "variants" }),
      ]));
      expect(feedback.find((item) => item.path === "description")?.message).toMatch(/Short description.*10/i);
    }
  });
});
