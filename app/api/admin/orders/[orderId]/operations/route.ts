import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext, canManageStore } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { db } from "@/lib/db";
import { requestFullRefund, restockRefundedOrder, processRefund, RefundError } from "@/lib/refunds";
import { notifyPaidOrder } from "@/lib/order-notifications";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refund"), confirmed: z.literal(true), orderNumber: z.string(), amountCents: z.number().int().positive(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("restock"), confirmed: z.literal(true), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("reconcile"), refundId: z.string().uuid() }),
  z.object({ action: z.literal("resend"), confirmed: z.literal(true), notificationId: z.string().uuid(), requestId: z.string().uuid() }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) return jsonError("Store administrator required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Confirm the action and provide a reason of at least 3 characters", 400);
  const { orderId } = await params;
  if (!await db.order.findFirst({ where: { id: orderId, storeId: context.store.id }, select: { id: true } })) return jsonError("Order not found", 404);
  const input = parsed.data;
  try {
    if (input.action === "refund") {
      const refund = await requestFullRefund({ ...input, orderId, storeId: context.store.id, actorId: context.user.id });
      await processRefund(refund.id);
    } else if (input.action === "restock") {
      await restockRefundedOrder(orderId, context.store.id, context.user.id, input.reason);
    } else if (input.action === "reconcile") {
      const refund = await db.paymentRefund.findFirst({ where: { id: input.refundId, payment: { orderId, order: { storeId: context.store.id } } } });
      if (!refund) return jsonError("Refund not found", 404);
      await processRefund(refund.id);
    } else {
      const notice = await db.orderNotification.findFirst({ where: { id: input.notificationId, orderId, order: { storeId: context.store.id } } });
      if (!notice) return jsonError("Notification not found", 404);
      await db.$transaction(async tx => {
        await tx.orderNotification.createMany({ data: [{ orderId, dedupeKey: `resend:${notice.id}:${input.requestId}`, to: notice.to, subject: notice.subject, text: notice.text }], skipDuplicates: true });
        await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ORDER_NOTICE_RESEND_REQUESTED", entityType: "OrderNotification", entityId: notice.id } });
      });
    }
    await notifyPaidOrder(orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof RefundError ? error.message : "The operation could not be confirmed. Refresh before retrying.", 409);
  }
}
