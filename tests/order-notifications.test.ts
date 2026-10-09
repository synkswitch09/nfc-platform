import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), send: vi.fn(), order: vi.fn(), createMany: vi.fn(), model: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { orderNotification: { findMany: m.findMany, updateMany: m.updateMany } } }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: m.send }));
vi.mock("@/lib/keychain-files", () => ({ keychain3mf: m.model }));
import { processOrderNotifications, queuePaidOrder } from "@/lib/order-notifications";
beforeEach(() => {
  vi.resetAllMocks();
  m.updateMany.mockResolvedValue({ count: 1 });
  m.findMany.mockResolvedValue([{ id: "n", to: "test@example.com", subject: "Paid", text: "Payment received", attempts: 0, order: { store: { slug: "kosykin" } } }]);
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
  expect(m.send.mock.calls[0][0].storeSlug).toBe("kosykin");
  const claim = m.updateMany.mock.calls[1][0];
  expect(m.updateMany.mock.calls[2][0]).toMatchObject({ where: { id: "n", leaseToken: claim.data.leaseToken }, data: { status: "ACCEPTED" } });
});
it("keeps a failed attempt pending for retry", async () => {
  m.send.mockRejectedValue(new Error("network"));
  await processOrderNotifications();
  expect(m.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "PENDING", lastError: expect.any(String) });
});
it("stops after the fifth attempt and exposes failure", async () => {
  m.findMany.mockResolvedValue([{ id: "n", attempts: 4, order: { store: { slug: "kosykin" } } }]);
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
it("attaches the paid Kosykin print file only to the operations recipient", async () => {
  const order = { orderNumber: "KOSY-123", store: { slug: "kosykin", supportEmail: "seller@example.com" }, items: [{ id: "abcdef12345", personalisation: { "keychain-name": "Daniel" }, selectedOptions: { "keychain-font": "rounded", "keychain-size": "regular", "base-colour": "peach", "letter-colour": "white", "base-shape": "rectangle" } }] };
  m.model.mockReturnValue(Buffer.from("3mf-data"));
  m.send.mockResolvedValue(true);
  m.findMany.mockResolvedValue([
    { id: "customer", dedupeKey: "paid:o:customer@example.com", to: "customer@example.com", subject: "Paid", text: "Payment received", attempts: 0, order },
    { id: "seller", dedupeKey: "paid:o:seller@example.com", to: "seller@example.com", subject: "Paid", text: "Payment received", attempts: 0, order },
  ]);
  await processOrderNotifications();
  expect(m.send.mock.calls[0][0]).not.toHaveProperty("attachments");
  expect(m.send.mock.calls[1][0]).toMatchObject({ attachments: [{ filename: "kosykin-KOSY-123-abcdef12.3mf", content: Buffer.from("3mf-data") }] });
  expect(m.model).toHaveBeenCalledWith(expect.objectContaining({ name: "Daniel", baseShape: "rectangle" }));
});
it("delivers an admin fallback instruction if the model cannot be attached", async () => {
  m.model.mockImplementation(() => { throw new Error("Generation failed"); });
  m.send.mockResolvedValue(true);
  m.findMany.mockResolvedValue([{ id: "seller", dedupeKey: "paid:o:seller@example.com", to: "seller@example.com", subject: "Paid", text: "Payment received", attempts: 0, order: { orderNumber: "KOSY-123", store: { slug: "kosykin", supportEmail: "seller@example.com" }, items: [{ id: "item", personalisation: {}, selectedOptions: {} }] } }]);
  await processOrderNotifications();
  expect(m.send.mock.calls[0][0]).not.toHaveProperty("attachments");
  expect(m.send.mock.calls[0][0].text).toContain("could not be attached");
});

it("saves a prepared body under its lease before provider submission", async () => {
  const snapshot = { subject: "Paid", text: "Payment received", html: "<p>Payment</p>", sender: { address: "orders@kosykin.com.au", name: "Kosykin Orders", from: "Kosykin Orders <orders@kosykin.com.au>" } };
  m.send.mockImplementation(async input => { await input.onPrepared(snapshot); return true; });
  await processOrderNotifications();
  expect(m.updateMany.mock.calls[2][0]).toMatchObject({ where: { id: "n", leaseToken: expect.any(String) }, data: { emailSnapshot: snapshot } });
  expect(m.updateMany.mock.calls[3][0].data.status).toBe("ACCEPTED");
});
it("passes persisted snapshots to retries and refuses a lost snapshot lease", async () => {
  const snapshot = { subject: "Original", text: "Original payment", html: "<p>Original</p>", sender: { address: "orders@kosykin.com.au", name: "Kosykin Orders", from: "Kosykin Orders <orders@kosykin.com.au>" } };
  m.findMany.mockResolvedValue([{ id: "n", to: "test@example.com", subject: "Paid", text: "Payment", attempts: 1, emailSnapshot: snapshot, order: { store: { slug: "kosykin" } } }]);
  m.send.mockResolvedValue(true); await processOrderNotifications();
  expect(m.send.mock.calls[0][0].prepared).toEqual(snapshot);
  m.updateMany.mockClear(); m.send.mockClear();
  m.findMany.mockResolvedValue([{ id: "n", to: "test@example.com", subject: "Paid", text: "Payment", attempts: 1, order: { store: { slug: "kosykin" } } }]);
  m.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
  m.send.mockImplementation(async input => { await input.onPrepared(snapshot); return true; });
  await processOrderNotifications();
  expect(m.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("PENDING");
});
