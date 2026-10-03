import { describe, expect, it } from "vitest";
import type { Promotion } from "@prisma/client";
import { calculatePromotion } from "@/lib/promotions";
const base = { kind: "FREE_SHIPPING", minimumSubtotalCents: 0, maxShippingDiscountCents: null, maxShippingWeightGrams: null, productId: null, percent: null, amountCents: null } as Promotion;
const lines = [{ productId: "eligible", unitPriceCents: 2000, quantity: 1, weightGrams: 100 }, { productId: "other", unitPriceCents: 1000, quantity: 1, weightGrams: 300 }];
describe("promotion discounts", () => {
  it("limits a product shipping offer to its share of the package", () => {
    expect(calculatePromotion({ ...base, productId: "eligible", maxShippingDiscountCents: 500 }, lines, 1200, "AU")).toBe(300);
    expect(calculatePromotion({ ...base, productId: "eligible", maxShippingWeightGrams: 350 }, lines, 1200, "AU")).toBe(0);
  });
  it("does not give overseas shipping away", () => expect(calculatePromotion(base, lines, 1200, "NZ")).toBe(0));
  it("caps a fixed discount at eligible item value", () => expect(calculatePromotion({ ...base, kind: "FIXED", amountCents: 10000, productId: "eligible" }, lines, 1200, "AU")).toBe(2000));
});
