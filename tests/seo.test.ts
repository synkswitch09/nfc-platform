import { describe, expect, it } from "vitest";
import { canonicalForStore, nonEmpty, productOffers, validCanonicalOverride, variantOfferPrice } from "@/lib/seo";

const variant = (sku: string, priceCents: number, inventory: number, selection: Record<string, string> = {}) => ({ sku, priceCents, inventory, reservedInventory: 0, trackInventory: true, backorderPolicy: "DENY", optionSelection: selection });

describe("store SEO", () => {
  it("never publishes a canonical from another site or one with tracking parameters", () => {
    expect(validCanonicalOverride("https://other.example/product", "https://tapkin.example")).toBe(false);
    expect(validCanonicalOverride("https://tapkin.example/product?token=123", "https://tapkin.example")).toBe(false);
    expect(canonicalForStore("https://tapkin.example", "/products/one", "https://other.example/product")).toBe("https://tapkin.example/products/one");
    expect(canonicalForStore("https://tapkin.example", "/products/one", "https://tapkin.example/products/two")).toBe("https://tapkin.example/products/two");
    expect(nonEmpty("  ", "Fallback")).toBe("Fallback");
  });

  it("keeps variant price, SKU and stock state together", () => {
    const options = [{ code: "colour", type: "COLOUR", active: true, required: true, priceDeltaCents: 100, values: [{ value: "blue", active: true, priceDeltaCents: 50 }, { value: "red", active: true, priceDeltaCents: 0 }] }];
    const blue = variant("BLUE", 2000, 0, { colour: "blue" });
    const red = { ...variant("RED", 3000, 5, { colour: "red" }), reservedInventory: 5, backorderPolicy: "ALLOW" };
    const offers = productOffers([blue, red], options, "NONE", "AUD", "https://tapkin.example/products/tag");
    expect(offers).toMatchObject([{ sku: "BLUE", price: "21.50", availability: "https://schema.org/OutOfStock" }, { sku: "RED", price: "31.00", availability: "https://schema.org/BackOrder" }]);
    expect(variantOfferPrice(variant("NEW", 1000, 2, { colour: "unknown" }), options, "NONE")).toBeNull();
  });
});
