import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { orderNoticeTemplate, preparedEmailSchema } from "@/lib/email-templates";
import { orderEmailCategory } from "@/lib/email-senders";
import { sendTransactionalEmail } from "@/lib/email";
import { keychainInputFromOptions } from "@/lib/keychain-order";
import { keychain3mf } from "@/lib/keychain-files";

const MAX_PRINT_ATTACHMENTS_BYTES = 15 * 1024 * 1024;

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
  const rows = await db.orderNotification.findMany({ where: { ...due, attempts: { lt: 5 }, ...(orderId ? { orderId } : {}) }, include: { order: { select: { orderNumber: true, customerName: true, shippingName: true, user: { select: { name: true } }, store: { select: { slug: true, supportEmail: true } }, items: { where: { variant: { product: { slug: "custom-name-keychain" } } }, select: { id: true, personalisation: true, selectedOptions: true } } } } }, orderBy: { availableAt: "asc" }, take: 5 });
  for (const row of rows) {
    const token = randomUUID();
    const claimed = await db.orderNotification.updateMany({ where: { id: row.id, ...due, attempts: { lt: 5 } }, data: { status: "PROCESSING", attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(Date.now() + 120_000) } });
    if (!claimed.count) continue;
    try {
      const printNotice = row.dedupeKey?.startsWith("paid:") && row.order.store.slug === "kosykin" && row.to === row.order.store.supportEmail;
      const attachments: { filename: string; content: Buffer }[] = [];
      let printInstructions = "";
      if (printNotice && row.order.items.length) {
        try {
          let total = 0;
          for (const item of row.order.items) {
            const input = keychainInputFromOptions(item.personalisation, item.selectedOptions);
            const content = keychain3mf(input);
            total += content.length;
            if (total > MAX_PRINT_ATTACHMENTS_BYTES) throw new Error("Print attachments exceed email limit");
            attachments.push({ filename: `kosykin-${row.order.orderNumber}-${item.id.slice(0, 8)}.3mf`, content });
          }
          printInstructions = "\n\n3MF files for printing are attached. Confirm colours and slice settings in Bambu Studio. You can also download each file in Kosykin Admin → Orders.";
        } catch {
          attachments.length = 0;
          printInstructions = "\n\nThe 3MF files could not be attached. Open Kosykin Admin → Orders and download them from this order before printing.";
        }
      }
      const prepared = row.emailSnapshot ? preparedEmailSchema.parse(row.emailSnapshot) : undefined;
      const accepted = await sendTransactionalEmail({ prepared, onPrepared: async message => {
        const saved = await db.orderNotification.updateMany({ where: { id: row.id, leaseToken: token }, data: { emailSnapshot: message } });
        if (!saved.count) throw new Error("Notification lease lost before sending");
      }, to: row.to, subject: row.subject, text: row.text + printInstructions, idempotencyKey: row.id, storeSlug: row.order.store.slug, category: orderEmailCategory(row.dedupeKey), templateKey: orderNoticeTemplate(row.dedupeKey, row.subject, Boolean(row.dedupeKey?.startsWith("paid:") && row.to === row.order.store.supportEmail)), customerName: row.order.customerName ?? row.order.user?.name ?? row.order.shippingName, templateFields: { "order.number": row.order.orderNumber }, ...(attachments.length ? { attachments } : {}) });
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
