import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ checkoutEnabled: false, previewMode: false }) }));
vi.mock("@/lib/order-service", () => ({ createPendingOrder: vi.fn(), attachCheckoutSession: vi.fn(), cancelPendingOrder: vi.fn(), settleCheckoutEvent: vi.fn(), CheckoutError: class extends Error {} }));

import { POST } from "@/app/api/checkout/route";
import { createPendingOrder } from "@/lib/order-service";

describe("production checkout gate", () => {
  it("rejects checkout before an order can be created", async () => {
    const response = await POST(new NextRequest("https://tapkin.com.au/api/checkout", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });
});
