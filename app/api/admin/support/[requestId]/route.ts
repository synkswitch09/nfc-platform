import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { lockSupportOrder } from "@/lib/support-access";
import { dispatchSupportNotices, queueSupportNotice } from "@/lib/support-notifications";
const schema = z.object({ status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]), priority: z.enum(["NORMAL", "HIGH", "URGENT"]).optional(), note: z.string().trim().max(4000).optional(), response: z.string().trim().max(4000).optional(), notifyCustomer: z.boolean().default(false), releaseHold: z.boolean().default(false), releaseReason: z.string().trim().max(500).optional(), expectedUpdatedAt: z.string().datetime() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("support.write");
  if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid support update. Refresh the ticket and try again.", 400);
  const data = parsed.data;
  if (data.notifyCustomer && !data.response) return jsonError("Write a customer response before emailing it", 400);
  if (data.releaseHold && (data.releaseReason?.length ?? 0) < 10) return jsonError("Explain why preparation can resume (at least 10 characters)", 400);
  const { requestId } = await params;
  const existing = await db.orderSupportRequest.findFirst({ where: { id: requestId, storeId: context.store.id }, select: { orderId: true } });
  if (!existing) return jsonError("Ticket not found", 404);
  const result = await db.$transaction(async tx => {
    // Order then ticket: same lock order as ticket admission and production guards.
    if (existing.orderId) await lockSupportOrder(tx, existing.orderId, context.store.id);
    const locked = await tx.orderSupportRequest.updateMany({ where: { id: requestId, storeId: context.store.id, updatedAt: new Date(data.expectedUpdatedAt) }, data: { updatedAt: new Date() } });
    if (!locked.count) return "conflict";
    const ticket = await tx.orderSupportRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (ticket.holdActive && data.status === "RESOLVED" && !data.releaseHold) throw new Error("HELD_RESOLUTION");
    const responseId = randomUUID(), now = new Date();
    await tx.orderSupportRequest.update({ where: { id: requestId }, data: {
      status: data.status, ...(data.priority ? { priority: data.priority } : {}), ...(data.note !== undefined ? { adminNote: data.note || null } : {}),
      ...(data.response ? { firstRespondedAt: ticket.firstRespondedAt ?? now, replies: [...(Array.isArray(ticket.replies) ? ticket.replies : []), { id: responseId, author: "team", message: data.response, at: now.toISOString() }] } : {}),
      ...(data.releaseHold && ticket.holdActive ? { holdActive: false, holdReleasedAt: now, holdReleaseReason: data.releaseReason! } : {}),
    } });
    if (data.response && data.notifyCustomer && ticket.customerEmail) await queueSupportNotice(tx, requestId, `reply:${responseId}`, ticket.customerEmail, `${context.store.displayName}: support ticket update`, `${data.response}\n\nTicket ${requestId}. View and reply through ${context.store.origin}/support. Email replies are not monitored; please use the ticket.`);
    if (data.releaseHold && ticket.holdActive && ticket.customerEmail) await queueSupportNotice(tx, requestId, `released:${responseId}`, ticket.customerEmail, `${context.store.displayName}: preparation pause reviewed`, `The pause for ticket ${requestId} has been released by our team after review. Any cancellation or refund decision is recorded separately in your ticket. View the update at ${context.store.origin}/support.`);
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: data.releaseHold && ticket.holdActive ? "SUPPORT_HOLD_RELEASED" : "ORDER_SUPPORT_UPDATED", entityType: "OrderSupportRequest", entityId: requestId, metadata: { status: data.status, priority: data.priority ?? ticket.priority, notified: data.notifyCustomer, publicResponse: Boolean(data.response), releaseReason: data.releaseHold ? data.releaseReason : null } } });
    return "saved";
  }).catch(error => { if (error instanceof Error && error.message === "HELD_RESOLUTION") return "held"; throw error; });
  if (result !== "saved") return jsonError(result === "held" ? "Release the preparation pause with a reason before resolving this ticket." : "Ticket changed while you were editing. Refresh and try again.", 409);
  await dispatchSupportNotices(requestId);
  return NextResponse.json({ ok: true });
}
