import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { CheckoutError } from "@/lib/order-service";
import { cancelStripeCheckout } from "@/lib/checkout-reconciliation";
import { canTransitionOrder } from "@/lib/order-status";
import { queueOrderNotice, notifyPaidOrder } from "@/lib/order-notifications";

const schema = z.object({ status: z.enum(["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]), note: z.string().trim().max(500).optional(), carrier: z.string().trim().max(80).optional(), trackingNumber: z.string().trim().max(100).regex(/^[A-Za-z0-9 ._/-]*$/).optional() }).superRefine((value, context) => { if (value.status === "SHIPPED" && (!value.carrier || !value.trackingNumber)) context.addIssue({ code: "custom", message: "Carrier and tracking number are required when shipping" }); });

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid order update");
  const { orderId } = await params;
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id }, select: { status: true, payments: { select: { status: true } } } });
  if (!order) return jsonError("Order not found", 404);
  if (order.payments.some(payment => payment.status === "REFUNDED")) return jsonError("This order is refunded. Review fulfilment before proceeding.", 409);
  if (!canTransitionOrder(order.status, parsed.data.status)) return jsonError(`Cannot change ${order.status} to ${parsed.data.status}`, 409);
  if (parsed.data.status === "CANCELLED" && order.status === "PAYMENT_PENDING") {
    try { await cancelStripeCheckout(orderId, store.id, user.id); }
    catch (error) { return jsonError(error instanceof CheckoutError ? error.message : "Payment could not be verified. Stock remains reserved; retry later.", 409); }
  } else {
    const changed = await db.$transaction(async tx => {
      const changedAt = new Date();
      if (await tx.payment.count({ where: { orderId, status: "REFUNDED" } })) throw new Error("REFUNDED_ORDER");
      const updated = await tx.order.updateMany({ where: { id: orderId, storeId: store.id, status: order.status }, data: { status: parsed.data.status, ...(parsed.data.status === "SHIPPED" ? { shippingCarrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber, shippedAt: changedAt } : {}) } });
      if (!updated.count) return false;
      if (parsed.data.status === "SHIPPED") {
        await tx.shipment.updateMany({
          where: { orderId, storeId: store.id, status: "LABEL_READY" },
          data: { status: "IN_TRANSIT", trackingNumber: parsed.data.trackingNumber, shippedAt: changedAt },
        });
      } else if (parsed.data.status === "DELIVERED") {
        await tx.shipment.updateMany({
          where: { orderId, storeId: store.id, status: "IN_TRANSIT" },
          data: { status: "DELIVERED", deliveredAt: changedAt },
        });
      }
      const history = await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: parsed.data.status, actorId: user.id, note: parsed.data.note || null } });
      await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "ORDER_STATUS_CHANGED", entityType: "Order", entityId: orderId, metadata: { from: order.status, to: parsed.data.status } } });
      await queueOrderNotice(tx, orderId, `status:${history.id}`, parsed.data.status.replaceAll("_", " "), `Your order is now ${parsed.data.status.replaceAll("_", " ").toLowerCase()}.${parsed.data.status === "SHIPPED" ? ` Carrier: ${parsed.data.carrier}. Tracking: ${parsed.data.trackingNumber}.` : ""}`);
      return true;
    }, { isolationLevel: "Serializable" }).catch(() => false);
    if (!changed) return jsonError("Order changed while updating. Refresh and try again.", 409);
  }
  await notifyPaidOrder(orderId);
  return NextResponse.json({ ok: true });
}
