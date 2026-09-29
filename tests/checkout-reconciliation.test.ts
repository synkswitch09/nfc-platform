import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
const mocks = vi.hoisted(() => ({ payment: { findFirst: vi.fn(), findMany: vi.fn() }, sessions: { retrieve: vi.fn(), expire: vi.fn(), list: vi.fn() }, intents: { retrieve: vi.fn() }, attach: vi.fn(), cancel: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { payment: mocks.payment } }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: mocks.sessions }, paymentIntents: mocks.intents }) }));
vi.mock("@/lib/order-service", () => ({ attachCheckoutSession: mocks.attach, cancelPendingOrder: mocks.cancel, settleCheckoutEvent: mocks.settle, CheckoutError: class extends Error {} }));
import { applyStripeSession, cancelStripeCheckout, reconcilePendingCheckouts } from "@/lib/checkout-reconciliation";

const payment = { id: "pay", orderId: "o", providerSessionId: "cs", amountCents: 200, currency: "AUD", status: "PENDING", createdAt: new Date("2026-01-01"), order: { storeId: "s" } };
function session(overrides = {}) { return { id: "cs", mode: "payment", metadata: { orderId: "o", storeId: "s" }, amount_total: 200, currency: "aud", status: "open", payment_status: "unpaid", ...overrides } as unknown as Stripe.Checkout.Session; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.payment.findFirst.mockResolvedValue(payment);
  mocks.payment.findMany.mockResolvedValue([payment]);
  mocks.sessions.retrieve.mockResolvedValue(session());
  mocks.cancel.mockResolvedValue(true);
});

describe("provider-confirmed reconciliation", () => {
  it("flags a paid session attached to a historically failed payment for review", async () => {
    mocks.payment.findFirst.mockResolvedValue({ ...payment, status: "FAILED" });
    await expect(applyStripeSession(session({ status: "complete", payment_status: "paid" }), "e", "complete")).rejects.toThrow("manual review");
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("retains stock for an open or delayed unpaid checkout", async () => {
    expect(await applyStripeSession(session(), "e", "check")).toBe("pending");
    expect(await applyStripeSession(session({ status: "complete" }), "e", "check")).toBe("pending");
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("settles a confirmed payment even when processing an older failure event", async () => {
    expect(await applyStripeSession(session({ status: "complete", payment_status: "paid" }), "e", "failed", true)).toBe("paid");
    expect(mocks.settle).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("releases on provider expiry or confirmed delayed failure", async () => {
    expect(await applyStripeSession(session({ status: "expired" }), "e", "expired")).toBe("cancelled");
    expect(await applyStripeSession(session({ status: "complete" }), "e", "failed", true)).toBe("cancelled");
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });
  it("refuses mismatched amounts before attaching or cancelling", async () => {
    await expect(applyStripeSession(session({ amount_total: 1, status: "expired" }), "e", "expired")).rejects.toThrow("does not match");
    expect(mocks.attach).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("recovers a lost session attachment through matching provider metadata", async () => {
    mocks.payment.findFirst.mockResolvedValue({ ...payment, providerSessionId: null });
    expect(await applyStripeSession(session({ status: "complete", payment_status: "paid" }), "e", "complete")).toBe("paid");
    expect(mocks.attach).toHaveBeenCalledWith("o", "pay", "cs");
  });
  it("does not cancel unknown sessions or release on an API outage", async () => {
    mocks.sessions.retrieve.mockRejectedValue(new Error("network"));
    expect((await reconcilePendingCheckouts()).outcomes[0].status).toBe("retry_required");
    mocks.payment.findMany.mockResolvedValue([{ ...payment, providerSessionId: null }]);
    mocks.sessions.list.mockResolvedValue({ data: [], has_more: false });
    expect((await reconcilePendingCheckouts()).outcomes[0].status).toBe("review_required");
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("recovers a missed expiry webhook", async () => {
    mocks.sessions.retrieve.mockResolvedValue(session({ status: "expired" }));
    expect((await reconcilePendingCheckouts()).outcomes[0].status).toBe("cancelled");
  });
  it("checks the PaymentIntent before releasing a missed delayed failure", async () => {
    mocks.sessions.retrieve.mockResolvedValue(session({ status: "complete", payment_intent: "pi" }));
    mocks.intents.retrieve.mockResolvedValue({ status: "processing" });
    expect((await reconcilePendingCheckouts()).outcomes[0].status).toBe("pending");
    mocks.intents.retrieve.mockResolvedValue({ status: "requires_payment_method", last_payment_error: { code: "declined" } });
    expect((await reconcilePendingCheckouts()).outcomes[0].status).toBe("cancelled");
  });
  it("expires a payable session before an admin cancellation", async () => {
    mocks.sessions.expire.mockResolvedValue(session({ status: "expired" }));
    await cancelStripeCheckout("o", "s", "admin");
    expect(mocks.sessions.expire).toHaveBeenCalledWith("cs");
    expect(mocks.cancel).toHaveBeenCalledWith("o", "Stripe confirmed checkout expiry", "admin");
  });
  it("a payment that wins the admin-expiry race is settled, not cancelled", async () => {
    mocks.sessions.retrieve.mockResolvedValueOnce(session()).mockResolvedValueOnce(session({ status: "complete", payment_status: "paid" }));
    mocks.sessions.expire.mockRejectedValue(new Error("not open"));
    await expect(cancelStripeCheckout("o", "s", "admin")).rejects.toThrow("not cancelled");
    expect(mocks.settle).toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("never expires a session belonging to a different store", async () => {
    mocks.sessions.retrieve.mockResolvedValue(session({ metadata: { orderId: "o", storeId: "other" } }));
    await expect(cancelStripeCheckout("o", "s", "admin")).rejects.toThrow("ownership");
    expect(mocks.sessions.expire).not.toHaveBeenCalled();
  });
  it("paginates unresolved orders instead of starving later payments", async () => {
    mocks.payment.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ ...payment, id: `p${i}` })));
    const result = await reconcilePendingCheckouts("previous");
    expect(result.nextCursor).toBe("p9");
    expect(mocks.payment.findMany.mock.calls[0][0].where.id).toEqual({ gt: "previous" });
  });
});
