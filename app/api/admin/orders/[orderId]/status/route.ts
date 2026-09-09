import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { cancelPendingOrder } from "@/lib/order-service";
import { canTransitionOrder } from "@/lib/order-status";
import { sendTransactionalEmail } from "@/lib/email";

const schema = z.object({ status: z.enum(["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]), note: z.string().trim().max(500).optional(), carrier: z.string().trim().max(80).optional(), trackingNumber: z.string().trim().max(100).regex(/^[A-Za-z0-9 ._\/-]*$/).optional() }).superRefine((value, context) => { if (value.status === "SHIPPED" && (!value.carrier || !value.trackingNumber)) context.addIssue({ code: "custom", message: "Carrier and tracking number are required when shipping" }); });

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid order update");
  const { orderId } = await params;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return jsonError("Order not found", 404);
  if (!canTransitionOrder(order.status, parsed.data.status)) return jsonError(`Cannot change ${order.status} to ${parsed.data.status}`, 409);
  if (parsed.data.status === "CANCELLED" && order.status === "PAYMENT_PENDING") {
    await cancelPendingOrder(orderId, parsed.data.note || "Cancelled by operations", user.id);
  } else {
    const changed = await db.$transaction(async tx => {
      const updated = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: parsed.data.status, ...(parsed.data.status === "SHIPPED" ? { shippingCarrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber, shippedAt: new Date() } : {}) } });
      if (!updated.count) return false;
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: parsed.data.status, actorId: user.id, note: parsed.data.note || null } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ORDER_STATUS_CHANGED", entityType: "Order", entityId: orderId, metadata: { from: order.status, to: parsed.data.status } } });
      return true;
    });
    if (!changed) return jsonError("Order changed while updating. Refresh and try again.", 409);
  }
  const updatedOrder = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, status: true, trackingNumber: true, shippingCarrier: true, guestEmail: true, user: { select: { email: true } } } });
  const email = updatedOrder?.user?.email ?? updatedOrder?.guestEmail;
  if (email && updatedOrder && ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(updatedOrder.status)) {
    const tracking = updatedOrder.status === "SHIPPED" ? ` Carrier: ${updatedOrder.shippingCarrier}. Tracking: ${updatedOrder.trackingNumber}.` : "";
    await sendTransactionalEmail({ to: email, subject: `Order ${updatedOrder.orderNumber}: ${updatedOrder.status.replaceAll("_", " ")}`, text: `Your Tapkin order is now ${updatedOrder.status.replaceAll("_", " ").toLowerCase()}.${tracking}` }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
