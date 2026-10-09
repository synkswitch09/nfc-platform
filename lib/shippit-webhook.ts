import { checkoutShippitParcels } from "@/lib/shippit-preparation";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentAppEnvironment } from "@/lib/config";
import { releaseProduction } from "@/lib/production-capacity";
import { queueOrderNotice, notifyPaidOrder } from "@/lib/order-notifications";

const trackingEvent = z.object({
  tracking_number: z.string().trim().min(5).max(100),
  current_state: z.string().trim().min(1).max(80),
  tracking_url: z.string().url().optional(),
  courier_name: z.string().trim().max(100).optional(),
  status_history: z.array(z.object({ status: z.string(), time: z.string() })).optional(),
});

const deliveredStates = new Set(["completed", "parcel_completed"]);
const movingStates = new Set(["in_transit", "with_driver", "delivery_attempted", "awaiting_collection", "await_collection", "partially_completed", "completed", "parcel_completed"]);

export function shippitOrderProgress(status: string, state: string, parcels: { bookedAt: Date | null; trackingNumber: string | null; status: string }[], expectedParcels = parcels.length) {
  return {
    ship: status === "READY_TO_SHIP" && movingStates.has(state) && parcels.length > 0 && parcels.length === expectedParcels && parcels.every(item => item.bookedAt && item.trackingNumber && ["IN_TRANSIT", "DELIVERED"].includes(item.status)),
    deliver: parcels.length > 0 && parcels.length === expectedParcels && parcels.every(item => item.status === "DELIVERED"),
  };
}

export function parseShippitWebhook(value: unknown, receivedAt = new Date()) {
  const event = trackingEvent.parse(value);
  const state = event.current_state.toLowerCase();
  // Shippit supplies newest events first, but find the timestamp for this state
  // explicitly so that a delayed webhook cannot rewind a more recent update.
  const times = (event.status_history ?? []).filter(item => item.status.toLowerCase() === state).map(item => new Date(item.time)).filter(date => Number.isFinite(date.valueOf()));
  const eventAt = times.length ? new Date(Math.max(...times.map(date => date.valueOf()))) : receivedAt;
  return { trackingNumber: event.tracking_number, state, eventAt, trackingUrl: event.tracking_url?.startsWith("https://") ? event.tracking_url : undefined, courier: event.courier_name };
}

export function validShippitWebhookToken(actual: string | null, expected: string | undefined) {
  if (!expected || expected.length < 32 || !actual) return false;
  const a = createHash("sha256").update(actual).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function applyShippitWebhook(payload: unknown, rawBody: string) {
  const environment = currentAppEnvironment();
  if (environment === "development") throw new Error("Shippit webhooks are disabled in development");
  const event = parseShippitWebhook(payload);
  const matched = await db.shipment.findMany({ where: { providerShipmentId: event.trackingNumber, idempotencyKey: { startsWith: "shippit:" }, order: { checkoutEnvironment: environment.toUpperCase() as "STAGING" | "PRODUCTION" } }, select: { id: true, storeId: true, orderId: true }, take: 2 });
  if (matched.length !== 1) return { outcome: matched.length ? "ambiguous" : "unknown" };
  const target = matched[0];
  const eventId = createHash("sha256").update(`${environment}:shippit:${rawBody}`).digest("hex");
  const outcome = await db.$transaction(async tx => {
    if (await tx.webhookEvent.findUnique({ where: { id: eventId } })) return "duplicate";
    const shipment = await tx.shipment.findUnique({ where: { id: target.id }, include: { order: { select: { status: true } } } });
    if (!shipment || shipment.storeId !== target.storeId || shipment.orderId !== target.orderId) return "unknown";
    await tx.webhookEvent.create({ data: { id: eventId, provider: "shippit", eventType: event.state } });
    if (shipment.trackingEventAt && shipment.trackingEventAt >= event.eventAt) return "stale";
    if (shipment.status === "DELIVERED" && !deliveredStates.has(event.state)) return "stale";
    const delivered = deliveredStates.has(event.state);
    const moving = movingStates.has(event.state);
    const nextStatus = delivered ? "DELIVERED" : moving && shipment.status === "LABEL_READY" ? "IN_TRANSIT" : shipment.status;
    await tx.shipment.update({ where: { id: shipment.id }, data: {
      status: nextStatus, trackingState: event.state, trackingEventAt: event.eventAt,
      ...(delivered && !shipment.deliveredAt ? { deliveredAt: event.eventAt } : {}),
      ...(moving && !shipment.shippedAt ? { shippedAt: event.eventAt } : {}),
      ...(event.trackingUrl ? { trackingUrl: event.trackingUrl } : {}),
    } });
    await tx.auditLog.create({ data: { storeId: shipment.storeId, action: "SHIPPIT_TRACKING_UPDATED", entityType: "Shipment", entityId: shipment.id, metadata: { state: event.state, at: event.eventAt.toISOString() } } });
    const order = await tx.order.findUnique({ where: { id: shipment.orderId }, select: { status: true, packagingSnapshot: true, shippitPreparation: { select: { status: true } } } });
    if (!order) return "updated";
    const parcels = await tx.shipment.findMany({ where: { orderId: shipment.orderId, idempotencyKey: { startsWith: "shippit:" } }, select: { bookedAt: true, status: true, trackingNumber: true, serviceName: true, trackingState: true } });
    const expectedParcels = order.shippitPreparation ? checkoutShippitParcels(order.packagingSnapshot).length : parcels.length;
    if (shippitOrderProgress(order.status, event.state, parcels, expectedParcels).ship) {
      const updated = await tx.order.updateMany({ where: { id: shipment.orderId, status: "READY_TO_SHIP" }, data: { status: "SHIPPED", shippedAt: event.eventAt, shippingCarrier: parcels[0].serviceName, trackingNumber: parcels[0].trackingNumber } });
      if (updated.count) {
        await releaseProduction(tx, shipment.orderId);
        const history = await tx.orderStatusHistory.create({ data: { orderId: shipment.orderId, fromStatus: "READY_TO_SHIP", toStatus: "SHIPPED", note: "Shippit tracking: parcel in transit" } });
        await queueOrderNotice(tx, shipment.orderId, `status:${history.id}`, "Your order has shipped", `Your order has shipped. Parcels: ${parcels.map(item => `${item.serviceName}: ${item.trackingNumber}`).join("; ")}.`);
      }
    }
    const current = await tx.order.findUnique({ where: { id: shipment.orderId }, select: { status: true } });
    if (current?.status === "SHIPPED" && shippitOrderProgress(current.status, event.state, parcels, expectedParcels).deliver) {
      const updated = await tx.order.updateMany({ where: { id: shipment.orderId, status: "SHIPPED" }, data: { status: "DELIVERED" } });
      if (updated.count) {
        const history = await tx.orderStatusHistory.create({ data: { orderId: shipment.orderId, fromStatus: "SHIPPED", toStatus: "DELIVERED", note: "All Shippit parcels delivered" } });
        await queueOrderNotice(tx, shipment.orderId, `delivered:${history.id}`, "Your order has been delivered", "All parcels in your order have been marked as delivered by the carrier. If you need help, open a ticket under Help & requests in your account.");
      }
    }
    return "updated";
  }, { isolationLevel: "Serializable" });
  if (outcome === "updated") await notifyPaidOrder(target.orderId);
  return { outcome };
}
