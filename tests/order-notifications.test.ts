import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), send: vi.fn(), order: vi.fn(), createMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { orderNotification: { findMany: m.findMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: m.send }));
import { processOrderNotifications, queuePaidOrder } from "@/lib/order-notifications";
beforeEach(() => {
  vi.resetAllMocks();
  m.updateMany.mockResolvedValue({ count: 1 });
  m.findMany.mockResolvedValue([{ id: "n", to: "test@example.com", subject: "Paid", text: "Payment received", attempts: 0 }]);
});
it("deduplicates customer/operations recipients and uses a stable event key", async () => {
  m.order.mockResolvedValue({ user: { email: "test@example.com" }, store: { supportEmail: "test@example.com" }, orderNumber: "T1", storeDisplayName: "Tapkin" });
  const tx = { order: { findUnique: m.order }, orderNotification: { createMany: m.createMany } } as unknown as Prisma.TransactionClient;
  await queuePaidOrder(tx, "o");
  expect(m.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true, data: [{ dedupeKey: "paid:o:test@example.com", orderId: "o" }] });
  expect(m.createMany.mock.calls[0][0].data).toHaveLength(1);
});
it("records acceptance without claiming delivery and fences completion by lease token", async () => {
  m.send.mockResolvedValue(true);
  await processOrderNotifications();
  expect(m.send.mock.calls[0][0].idempotencyKey).toBe("n");
  const claim = m.updateMany.mock.calls[1][0];
  expect(m.updateMany.mock.calls[2][0]).toMatchObject({ where: { id: "n", leaseToken: claim.data.leaseToken }, data: { status: "ACCEPTED" } });
});
it("keeps a failed attempt pending for retry", async () => {
  m.send.mockRejectedValue(new Error("network"));
  await processOrderNotifications();
  expect(m.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "PENDING", lastError: expect.any(String) });
});
it("stops after the fifth attempt and exposes failure", async () => {
  m.findMany.mockResolvedValue([{ id: "n", attempts: 4 }]);
  m.send.mockRejectedValue(new Error("network"));
  await processOrderNotifications();
  expect(m.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("FAILED");
});
it("a lost claim does not send mail", async () => {
  m.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
  await processOrderNotifications();
  expect(m.send).not.toHaveBeenCalled();
});
it("mock delivery remains distinguishable from provider acceptance", async () => {
  m.send.mockResolvedValue(false);
  await processOrderNotifications();
  expect(m.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("MOCKED");
});
