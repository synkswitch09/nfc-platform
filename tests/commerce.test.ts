import { describe, expect, it } from "vitest";
import { calculateOrderTotals } from "@/lib/commerce";

describe("checkout totals", () => {
  it("calculates totals server-side with standard shipping", () => { expect(calculateOrderTotals([{unitPriceCents:2495,quantity:2}])).toEqual({subtotalCents:4990,shippingCents:900,totalCents:5890}); });
  it("applies free shipping at $60 AUD", () => { expect(calculateOrderTotals([{unitPriceCents:3000,quantity:2}])).toEqual({subtotalCents:6000,shippingCents:0,totalCents:6000}); });
});
