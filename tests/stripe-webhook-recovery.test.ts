import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), retrieve: vi.fn(), find: vi.fn(), settle: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ webhooks: { constructEvent: mocks.verify }, checkout: { sessions: { retrieve: mocks.retrieve } } }) }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ stripe: { webhookSecret: "test" } }) }));
vi.mock("@/lib/db", () => ({ db: { payment: { findUnique: mocks.find } } }));
vi.mock("@/lib/order-service", () => ({ settleCheckoutEvent: mocks.settle, CheckoutError: class extends Error {} }));
vi.mock("@/lib/checkout-reconciliation", () => ({ applyStripeSession: mocks.apply }));
vi.mock("@/lib/logger", () => ({ logEvent: vi.fn() }));
import { POST } from "@/app/api/stripe/webhook/route";
const request = () => new NextRequest("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "test" }, body: "signed-payload" });
const session = { id: "cs", metadata: { orderId: "o", storeId: "s" }, amount_total: 100, currency: "aud", payment_status: "paid" };
beforeEach(() => { vi.resetAllMocks(); mocks.verify.mockReturnValue({ id: "evt", type: "checkout.session.completed", data: { object: session } }); });
it("deduplicates settled events without requiring an external Stripe connection", async () => {
  mocks.find.mockResolvedValue({ status: "SUCCEEDED" });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.retrieve).not.toHaveBeenCalled();
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ eventId: "evt", orderId: "o", storeId: "s", amountCents: 100 }));
});
it("retrieves the current provider state for pending orders", async () => {
  mocks.find.mockResolvedValue({ status: "PENDING" });
  mocks.retrieve.mockResolvedValue(session);
  expect((await POST(request())).status).toBe(200);
  expect(mocks.apply).toHaveBeenCalledWith(session, "evt", "checkout.session.completed", false);
});
it("rejects invalid signatures before any DB or Stripe retrieval", async () => {
  mocks.verify.mockImplementation(() => { throw new Error("invalid"); });
  expect((await POST(request())).status).toBe(400);
  expect(mocks.find).not.toHaveBeenCalled();
  expect(mocks.retrieve).not.toHaveBeenCalled();
});
