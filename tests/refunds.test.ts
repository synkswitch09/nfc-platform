import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() });
  const tx = { order: model(), payment: model(), paymentRefund: model(), auditLog: model(), inventoryMovement: model(), productVariant: model() };
  return { tx, transaction: vi.fn(), queue: vi.fn(), etsy: vi.fn(), stripe: { refunds: { list: vi.fn(), create: vi.fn(), retrieve: vi.fn() } } };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction, paymentRefund: m.tx.paymentRefund } }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => m.stripe }));
vi.mock("@/lib/order-notifications", () => ({ queueOrderNotice: m.queue }));
vi.mock("@/lib/etsy", () => ({ queueEtsyInventorySync: m.etsy }));
import { applyStripeRefund, processRefund, requestFullRefund, restockRefundedOrder } from "@/lib/refunds";
import type Stripe from "stripe";

const payment = { id: "p", orderId: "o", provider: "stripe", providerPaymentIntentId: "pi", status: "SUCCEEDED", amountCents: 1000, refundedAmountCents: 0, currency: "AUD", order: { storeId: "s" } };
const request = { orderId: "o", storeId: "s", actorId: "a", orderNumber: "T1", amountCents: 1000, reason: "Customer request" };
const remote = (amount = 1000, status = "succeeded") => ({ id: "re", payment_intent: "pi", amount, currency: "aud", status, metadata: {} }) as Stripe.Refund;
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn(m.tx));
  m.tx.order.findFirst.mockResolvedValue({ id: "o", orderNumber: "T1", totalCents: 1000, payments: [payment] });
  m.tx.payment.findUnique.mockResolvedValue(payment);
  m.tx.paymentRefund.create.mockImplementation(({ data }) => Promise.resolve({ id: "r", ...data }));
  m.tx.paymentRefund.update.mockResolvedValue({ id: "r" });
  m.tx.paymentRefund.aggregate.mockResolvedValue({ _sum: { amountCents: 1000 } });
  m.tx.paymentRefund.updateMany.mockResolvedValue({ count: 1 });
  m.tx.paymentRefund.findUniqueOrThrow.mockResolvedValue({ id: "r", amountCents: 1000, createdAt: new Date(), payment });
  m.stripe.refunds.list.mockResolvedValue({ data: [], has_more: false });
});

it("scopes requests to a store and rejects mismatched confirmation before creation", async () => {
  await expect(requestFullRefund({ ...request, amountCents: 999 })).rejects.toThrow("does not match");
  expect(m.tx.order.findFirst.mock.calls[0][0].where).toEqual({ id: "o", storeId: "s" });
  expect(m.tx.paymentRefund.create).not.toHaveBeenCalled();
});
it("reuses the persisted full-refund request", async () => {
  m.tx.paymentRefund.findUnique.mockResolvedValue({ id: "existing" });
  expect(await requestFullRefund(request)).toEqual({ id: "existing" });
  expect(m.tx.paymentRefund.create).not.toHaveBeenCalled();
  expect(m.stripe.refunds.create).not.toHaveBeenCalled();
});
it("refuses another refund when a partial refund exists", async () => {
  m.tx.paymentRefund.count.mockResolvedValue(1);
  await expect(requestFullRefund(request)).rejects.toThrow("already exists");
});
it("records intent and audit before any provider operation", async () => {
  await requestFullRefund(request);
  expect(m.tx.auditLog.create).toHaveBeenCalledOnce();
  expect(m.stripe.refunds.create).not.toHaveBeenCalled();
});
it("only successful full amounts mark the payment refunded and queue notice", async () => {
  await applyStripeRefund(remote());
  expect(m.tx.payment.update.mock.calls[0][0].data).toEqual({ refundedAmountCents: 1000, status: "REFUNDED" });
  expect(m.queue).toHaveBeenCalledOnce();
  expect(m.tx.productVariant.update).not.toHaveBeenCalled();
});
it("records external partial refunds without marking the whole payment refunded", async () => {
  m.tx.paymentRefund.aggregate.mockResolvedValue({ _sum: { amountCents: 200 } });
  await applyStripeRefund(remote(200));
  expect(m.tx.payment.update.mock.calls[0][0].data).toEqual({ refundedAmountCents: 200 });
});
it("pending provider results neither refund the payment nor notify success", async () => {
  m.tx.paymentRefund.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
  await applyStripeRefund(remote(1000, "pending"));
  expect(m.tx.payment.update.mock.calls[0][0].data).toEqual({ refundedAmountCents: 0 });
  expect(m.queue).not.toHaveBeenCalled();
});
it("rejects a refund reference belonging to another payment", async () => {
  m.tx.paymentRefund.findFirst.mockResolvedValue({ paymentId: "other", amountCents: 1000 });
  await expect(applyStripeRefund(remote())).rejects.toThrow("ownership");
  expect(m.tx.payment.update).not.toHaveBeenCalled();
});
it("an uncertain provider request retries with the same key", async () => {
  m.stripe.refunds.create.mockRejectedValue(new Error("timeout"));
  await processRefund("r");
  await processRefund("r");
  expect(m.stripe.refunds.create.mock.calls.map(call => call[1].idempotencyKey)).toEqual(["r", "r"]);
  expect(m.tx.payment.update).not.toHaveBeenCalled();
});
it("does not send a new refund beyond the safe idempotency window", async () => {
  m.tx.paymentRefund.findUniqueOrThrow.mockResolvedValue({ id: "r", createdAt: new Date(Date.now() - 21 * 3600_000), payment });
  await processRefund("r");
  expect(m.stripe.refunds.create).not.toHaveBeenCalled();
  expect(m.tx.paymentRefund.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("REVIEW_REQUIRED");
});
it("a worker that loses its lease claim never contacts Stripe", async () => {
  m.tx.paymentRefund.updateMany.mockResolvedValue({ count: 0 });
  await processRefund("r");
  expect(m.stripe.refunds.list).not.toHaveBeenCalled();
});
it("restocks only consumed physical stock and only once", async () => {
  m.tx.payment.findFirst.mockResolvedValue({ ...payment, status: "REFUNDED", refundedAmountCents: 1000 });
  m.tx.payment.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  m.tx.inventoryMovement.groupBy.mockResolvedValue([{ variantId: "v", _sum: { quantity: -2 } }]);
  m.tx.productVariant.update.mockResolvedValue({ id: "v", productId: "product" });
  await restockRefundedOrder("o", "s", "a", "Goods inspected");
  expect(await restockRefundedOrder("o", "s", "a", "Retry")).toEqual({ duplicate: true });
  expect(m.tx.productVariant.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "v" }, data: { inventory: { increment: 2 } } });
  expect(m.etsy).toHaveBeenCalledOnce();
});
