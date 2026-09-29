import { describe, expect, it } from "vitest";
import { calculateOrderTotals, calculateQuotedOrderTotals } from "@/lib/commerce";

describe("checkout totals", () => {
  it("calculates totals server-side with standard shipping", () => { expect(calculateOrderTotals([{unitPriceCents:2495,quantity:2}])).toEqual({subtotalCents:4990,shippingCents:900,totalCents:5890}); });
  it("applies free shipping at $60 AUD", () => { expect(calculateOrderTotals([{unitPriceCents:3000,quantity:2}])).toEqual({subtotalCents:6000,shippingCents:0,totalCents:6000}); });
  it("uses administrator-configured shipping without trusting the browser", () => { expect(calculateOrderTotals([{unitPriceCents:3000,quantity:2}], { flatRateCents: 1200, freeOverCents: 10000 })).toEqual({subtotalCents:6000,shippingCents:1200,totalCents:7200}); });
  it("uses the server-approved quote amount in the final total", () => { expect(calculateQuotedOrderTotals([{ unitPriceCents: 2495, quantity: 2 }], 1200)).toEqual({ subtotalCents: 4990, shippingCents: 1200, totalCents: 6190 }); });
});
