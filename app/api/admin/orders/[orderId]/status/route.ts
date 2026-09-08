import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { cancelPendingOrder } from "@/lib/order-service";
import { canTransitionOrder } from "@/lib/order-status";

const schema = z.object({ status: z.enum(["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]), note: z.string().trim().max(500).optional() });

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
      const updated = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: parsed.data.status } });
      if (!updated.count) return false;
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: parsed.data.status, actorId: user.id, note: parsed.data.note || null } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ORDER_STATUS_CHANGED", entityType: "Order", entityId: orderId, metadata: { from: order.status, to: parsed.data.status } } });
      return true;
    });
    if (!changed) return jsonError("Order changed while updating. Refresh and try again.", 409);
  }
  return NextResponse.json({ ok: true });
}
