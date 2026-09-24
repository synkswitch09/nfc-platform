import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

export async function queueOrderNotice(tx: Prisma.TransactionClient, orderId: string, key: string, title: string, text: string, includeOperations = false) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { user: { select: { email: true } }, store: { select: { supportEmail: true } } } });
  if (!order) throw new Error("Order missing while queuing notice");
  const recipients = new Set([order.user?.email ?? order.guestEmail, ...(includeOperations ? [order.store.supportEmail] : [])].filter((email): email is string => Boolean(email)));
  await tx.orderNotification.createMany({ data: [...recipients].map(to => ({ orderId, dedupeKey: `${key}:${to}`, to, subject: `${order.storeDisplayName} ${order.orderNumber}: ${title}`, text })), skipDuplicates: true });
}

export async function queuePaidOrder(tx: Prisma.TransactionClient, orderId: string) {
  await queueOrderNotice(tx, orderId, `paid:${orderId}`, "Payment confirmed", "Payment has been received. We will let you know when your order progresses.", true);
}

export async function processOrderNotifications(orderId?: string) {
  const now = new Date();
  const due = { OR: [{ status: "PENDING", availableAt: { lte: now } }, { status: "PROCESSING", leaseUntil: { lt: now } }] };
  // Exhausted crashed attempts need a visible terminal state, not a permanently stuck lease.
  await db.orderNotification.updateMany({ where: { ...due, attempts: { gte: 5 }, ...(orderId ? { orderId } : {}) }, data: { status: "FAILED", leaseToken: null, leaseUntil: null, lastError: "Retry limit reached; inspect provider before retrying" } });
  const rows = await db.orderNotification.findMany({ where: { ...due, attempts: { lt: 5 }, ...(orderId ? { orderId } : {}) }, orderBy: { availableAt: "asc" }, take: 5 });
  for (const row of rows) {
    const token = randomUUID();
    const claimed = await db.orderNotification.updateMany({ where: { id: row.id, ...due, attempts: { lt: 5 } }, data: { status: "PROCESSING", attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(Date.now() + 120_000) } });
    if (!claimed.count) continue;
    try {
      const accepted = await sendTransactionalEmail({ to: row.to, subject: row.subject, text: row.text, idempotencyKey: row.id });
      await db.orderNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { status: accepted ? "ACCEPTED" : "MOCKED", leaseToken: null, leaseUntil: null, lastError: null } });
    } catch {
      await db.orderNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { status: row.attempts + 1 >= 5 ? "FAILED" : "PENDING", availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** row.attempts) * 1000), leaseToken: null, leaseUntil: null, lastError: "Provider request failed or its outcome is uncertain. Acceptance does not prove delivery." } });
    }
  }
  return { checked: rows.length };
}

// Best-effort immediate dispatch; durable rows were already committed with the payment.
export async function notifyPaidOrder(orderId: string) {
  await processOrderNotifications(orderId).catch(() => undefined);
}
