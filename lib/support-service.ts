import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { attachmentSchema, validSupportPhoto } from "@/lib/support-attachments";
import { parseAccountConfig } from "@/lib/account-config";
import { canPauseBeforePreparation, parseSupportConfig, responseDeadline, supportTopics } from "@/lib/support-config";
import { lockSupportOrder, supportOrderOwner, type SupportIdentity } from "@/lib/support-access";
import { queueSupportNotice } from "@/lib/support-notifications";
import type { Storefront } from "@/lib/storefront";

export const newTicketSchema = z.object({
  kind: z.enum(supportTopics), message: z.string().trim().min(10).max(4000),
  orderNumber: z.string().trim().max(80).optional(),
  attachments: z.array(attachmentSchema).max(3).default([]),
});
export const followupSchema = z.object({ message: z.string().trim().min(2).max(4000) });
export class SupportError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
export async function internalSupportAlert(tx: Prisma.TransactionClient, store: Storefront, ticketId: string, key: string, held: boolean) {
  for (const email of new Set(parseSupportConfig(store.accountConfig).notificationEmails)) {
    await queueSupportNotice(tx, ticketId, `internal:${key}`, email, `${store.displayName}: ${held ? "order paused · " : ""}support ticket`, `A verified support ticket requires review${held ? "; preparation is paused" : ""}. Open the CMS support inbox: ${store.origin}/admin/support. Ticket ${ticketId}.`);
  }
}
export async function createSupportTicket(store: Storefront, identity: SupportIdentity, data: z.infer<typeof newTicketSchema>, orderId?: string) {
  const account = parseAccountConfig(store.accountConfig), config = parseSupportConfig(store.accountConfig);
  if (!account.helpEnabled || !account.requestTopics.includes(data.kind)) throw new SupportError("This request topic is unavailable", 403);
  if (!data.attachments.every(validSupportPhoto)) throw new SupportError("Use JPG, PNG or WebP photos up to 500 KB.");
  const requiresOrder = ["ORDER_CHANGE", "ADDRESS_CHANGE", "CANCELLATION_REQUEST", "DELIVERY", "QUALITY"].includes(data.kind);
  const order = orderId || data.orderNumber ? await db.order.findFirst({ where: { storeId: store.id, ...supportOrderOwner(identity), ...(orderId ? { id: orderId } : { orderNumber: data.orderNumber }), status: { notIn: ["PENDING", "PAYMENT_PENDING"] } }, select: { id: true } }) : null;
  if ((requiresOrder || orderId || data.orderNumber) && !order) throw new SupportError("Order not found for your verified email", 404);
  return db.$transaction(async tx => {
    let held = false;
    if (order) {
      await lockSupportOrder(tx, order.id, store.id);
      const current = await tx.order.findFirstOrThrow({ where: { id: order.id, storeId: store.id, ...supportOrderOwner(identity) }, select: { status: true, preparationStartedAt: true, items: { select: { packedQuantity: true, manufacturingJobs: { select: { status: true, startedAt: true } } } } } });
      if (["PENDING", "PAYMENT_PENDING"].includes(current.status)) throw new SupportError("Order is not available for support", 409);
      held = config.autoPause && ["ORDER_CHANGE", "ADDRESS_CHANGE", "CANCELLATION_REQUEST"].includes(data.kind) && canPauseBeforePreparation(current);
    }
    const now = new Date(), due = responseDeadline(now, config.firstResponseBusinessDays, store.timezone, config.holidays);
    const ticket = await tx.orderSupportRequest.create({ data: { orderId: order?.id, storeId: store.id, customerUserId: identity.userId, customerEmail: identity.email, customerName: identity.name, verifiedAt: now, responseDueAt: due, priority: held ? "HIGH" : "NORMAL", holdActive: held, kind: data.kind, message: data.message, attachments: data.attachments } });
    await tx.auditLog.create({ data: { actorId: identity.userId, storeId: store.id, action: held ? "SUPPORT_TICKET_CREATED_ORDER_PAUSED" : "SUPPORT_TICKET_CREATED", entityType: "OrderSupportRequest", entityId: ticket.id, metadata: { orderId: order?.id ?? null, kind: data.kind, held } } });
    await queueSupportNotice(tx, ticket.id, `created:${ticket.id}`, identity.email, `${store.displayName}: support request received`, `We received your ticket ${ticket.id}. Our first-response target is ${config.firstResponseBusinessDays} business days (weekends and configured holidays excluded). Target date: ${due.toLocaleDateString("en-AU", { timeZone: store.timezone })}. ${held ? "Preparation has been paused while we review your verified request. This is not a cancellation or refund approval." : "Submitting a request does not cancel or change your order."}\nView and follow up through ${store.origin}/support. Email replies are not monitored; please use the ticket.`);
    await internalSupportAlert(tx, store, ticket.id, ticket.id, held);
    return { id: ticket.id, held, responseDueAt: due.toISOString() };
  });
}
export function publicSupportTicket(ticket: { id: string; orderId: string | null; kind: string; message: string; status: string; replies: Prisma.JsonValue; priority: string; holdActive: boolean; responseDueAt: Date | null; createdAt: Date; order?: { orderNumber: string } | null; attachments: Prisma.JsonValue }) {
  return { id: ticket.id, orderId: ticket.orderId, orderNumber: ticket.order?.orderNumber ?? null, kind: ticket.kind, message: ticket.message, status: ticket.status, replies: ticket.replies, holdActive: ticket.holdActive, responseDueAt: ticket.responseDueAt?.toISOString() ?? null, createdAt: ticket.createdAt.toISOString(), photoCount: Array.isArray(ticket.attachments) ? ticket.attachments.length : 0 };
}
