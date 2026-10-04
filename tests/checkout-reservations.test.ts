import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn(), createMany: vi.fn(), count: vi.fn() });
  return { tx: { order: model(), payment: model(), productVariant: model(), productionBooking: model(), inventoryMovement: model(), orderStatusHistory: model(), auditLog: model(), webhookEvent: model(), manufacturingJob: model(), store: model(), user: model(), promotion: model() }, transaction: vi.fn(), notify: vi.fn(), notice: vi.fn() };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/etsy", () => ({ queueEtsyInventorySync: vi.fn() }));
vi.mock("@/lib/order-notifications", () => ({ notifyPaidOrder: mocks.notify, queuePaidOrder: vi.fn(), queueOrderNotice: mocks.notice }));
import { cancelPendingOrder, settleCheckoutEvent } from "@/lib/order-service";

const variant = { id: "v", productId: "p", trackInventory: false, backorderPolicy: "ALLOW", inventory: 10, reservedInventory: 4 };
const order = { id: "o", storeId: "s", status: "PAYMENT_PENDING", store: { capabilities: [] }, items: [{ id: "i", variantId: "v", quantity: 2, variant, shippingSnapshot: { inventoryPolicy: { trackInventory: true, backorderPolicy: "DENY" } } }] };
const event = { eventId: "evt", eventType: "checkout.session.completed", providerSessionId: "cs", orderId: "o", storeId: "s", amountCents: 100, currency: "AUD" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(callback => callback(mocks.tx));
  mocks.tx.order.findUnique.mockResolvedValue(order);
  mocks.tx.store.findUnique.mockResolvedValue({ secondPurchaseRewardEnabled: false });
  mocks.tx.order.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.inventoryMovement.groupBy.mockResolvedValue([{ variantId: "v", _sum: { quantity: 2 } }]);
  mocks.tx.payment.findUnique.mockResolvedValue({ id: "pay", orderId: "o", status: "PENDING", amountCents: 100, currency: "AUD", order });
});

describe("order transition guards", () => {
  it("releases the original reservation even if today's variant no longer tracks stock", async () => {
    expect(await cancelPendingOrder("o", "Expired")).toBe(true);
    expect(mocks.tx.productVariant.updateMany.mock.calls[0][0].data).toEqual({ reservedInventory: { increment: -2 } });
    expect(mocks.tx.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({ type: "RELEASE", quantity: -2, orderId: "o" });
  });
  it("two competing cancellations can release only once", async () => {
    mocks.tx.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const results = await Promise.all([cancelPendingOrder("o", "Expired"), cancelPendingOrder("o", "Expired")]);
    expect(results.sort()).toEqual([false, true]);
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
  });
  it("a cancellation that loses to payment never releases stock", async () => {
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await cancelPendingOrder("o", "Expired")).toBe(false);
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });
  it("a payment that loses the pending-state transition cannot consume stock", async () => {
    mocks.tx.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(settleCheckoutEvent(event)).rejects.toThrow("Order changed");
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });
  it("settles using the reservation despite a later policy edit", async () => {
    await settleCheckoutEvent(event);
    expect(mocks.tx.productVariant.updateMany.mock.calls[0][0].data).toEqual({ inventory: { decrement: 2 }, reservedInventory: { decrement: 2 } });
    expect(mocks.notify).toHaveBeenCalledWith("o");
  });
  it("issues the configured reward to a guest after their first paid order", async () => {
    const firstOrder = { ...order, guestEmail: "FIRST@example.com", storeDisplayName: "Kosykin" };
    mocks.tx.payment.findUnique.mockResolvedValue({ id: "pay", orderId: "o", status: "PENDING", amountCents: 100, currency: "AUD", order: firstOrder });
    mocks.tx.store.findUnique.mockResolvedValue({ secondPurchaseRewardEnabled: true, secondPurchaseRewardAmountCents: 1500, secondPurchaseRewardValidityDays: 30, secondPurchaseRewardMinimumCents: 5000 });
    mocks.tx.order.count.mockResolvedValue(1);
    await settleCheckoutEvent(event);
    const promotion = mocks.tx.promotion.create.mock.calls[0][0].data;
    expect(promotion).toMatchObject({ storeId: "s", kind: "FIXED", amountCents: 1500, minimumSubtotalCents: 5000, usageLimit: 1 });
    expect(promotion.code).toMatch(/^WELCOME-[A-Z0-9]{12}$/);
    expect(promotion.endsAt.getTime() - promotion.startsAt.getTime()).toBe(30 * 86400000);
    expect(mocks.notice.mock.calls[0][3]).toContain("A$15.00 off your next purchase");
    expect(mocks.notice.mock.calls[0][4]).toContain("at least A$50.00");
  });
  it("does not issue a second reward for repeat orders", async () => {
    const repeatOrder = { ...order, guestEmail: "first@example.com" };
    mocks.tx.payment.findUnique.mockResolvedValue({ id: "pay", orderId: "o", status: "PENDING", amountCents: 100, currency: "AUD", order: repeatOrder });
    mocks.tx.store.findUnique.mockResolvedValue({ secondPurchaseRewardEnabled: true, secondPurchaseRewardAmountCents: 1000, secondPurchaseRewardValidityDays: 90, secondPurchaseRewardMinimumCents: 0 });
    mocks.tx.order.count.mockResolvedValue(2);
    await settleCheckoutEvent(event);
    expect(mocks.tx.promotion.create).not.toHaveBeenCalled();
  });
  it("deduplicates an already processed webhook before touching stock", async () => {
    mocks.tx.webhookEvent.findUnique.mockResolvedValue({ id: "evt" });
    expect(await settleCheckoutEvent(event)).toEqual({ duplicate: true });
    expect(mocks.tx.order.updateMany).not.toHaveBeenCalled();
  });
  it("fails instead of claiming a nonexistent reservation was released", async () => {
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelPendingOrder("o", "Expired")).rejects.toThrow("Reserved stock changed");
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });
});
