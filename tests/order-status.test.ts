import { describe, expect, it } from "vitest";
import { canTransitionOrder, orderTransitions } from "@/lib/order-status";

describe("order status transitions", () => {
  it("supports the production and delivery lifecycle", () => {
    expect(canTransitionOrder("PAID", "PROCESSING")).toBe(true);
    expect(canTransitionOrder("PROCESSING", "READY_TO_SHIP")).toBe(true);
    expect(canTransitionOrder("SHIPPED", "DELIVERED")).toBe(true);
  });
  it("does not let operations manufacture an unpaid order", () => {
    expect(canTransitionOrder("PAYMENT_PENDING", "PROCESSING")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PAID")).toBe(false);
    expect(orderTransitions.REFUNDED).toBeUndefined();
  });
});
