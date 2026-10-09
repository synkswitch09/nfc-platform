import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { preparedEmailSchema } from "@/lib/email-templates";

export async function queueSupportNotice(tx: Prisma.TransactionClient, ticketId: string, key: string, to: string, subject: string, text: string) {
  await tx.supportNotification.createMany({ data: [{ ticketId, dedupeKey: `${key}:${to}`, to, subject, text }], skipDuplicates: true });
}
export async function processSupportNotifications(ticketId?: string) {
  const due = { OR: [{ status: "PENDING", availableAt: { lte: new Date() } }, { status: "PROCESSING", leaseUntil: { lt: new Date() } }] };
  await db.supportNotification.updateMany({ where: { ...due, attempts: { gte: 5 }, ...(ticketId ? { ticketId } : {}) }, data: { status: "FAILED", leaseToken: null, leaseUntil: null, lastError: "Retry limit reached; inspect provider before retrying" } });
  const rows = await db.supportNotification.findMany({ where: { ...due, attempts: { lt: 5 }, ...(ticketId ? { ticketId } : {}) }, include: { ticket: { select: { customerName: true, order: { select: { orderNumber: true } }, store: { select: { slug: true } } } } }, orderBy: { availableAt: "asc" }, take: 5 });
  for (const row of rows) {
    const token = randomUUID();
    const claim = await db.supportNotification.updateMany({ where: { id: row.id, ...due, attempts: { lt: 5 } }, data: { status: "PROCESSING", attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(Date.now() + 120000) } });
    if (!claim.count) continue;
    try {
      const accepted = await sendTransactionalEmail({ to: row.to, subject: row.subject, text: row.text, storeSlug: row.ticket.store.slug, category: "support", templateKey: "support", customerName: row.ticket.customerName, templateFields: row.ticket.order ? { "order.number": row.ticket.order.orderNumber } : {}, idempotencyKey: row.id, prepared: row.emailSnapshot ? preparedEmailSchema.parse(row.emailSnapshot) : undefined, onPrepared: async message => {
        const saved = await db.supportNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { emailSnapshot: message } });
        if (!saved.count) throw new Error("Notification lease lost");
      } });
      await db.supportNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { status: accepted ? "ACCEPTED" : "MOCKED", leaseToken: null, leaseUntil: null, lastError: null } });
    } catch {
      await db.supportNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { status: row.attempts + 1 >= 5 ? "FAILED" : "PENDING", availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** row.attempts) * 1000), leaseToken: null, leaseUntil: null, lastError: "Provider outcome uncertain; durable retry scheduled" } });
    }
  }
  return { checked: rows.length };
}
export async function dispatchSupportNotices(ticketId: string) {
  await processSupportNotifications(ticketId).catch(() => undefined);
}
