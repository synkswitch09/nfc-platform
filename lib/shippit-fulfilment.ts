import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { currentAppEnvironment } from "@/lib/config";
import { getStorageProvider } from "@/lib/storage";
import { createDocumentStorageKey } from "@/lib/storage/keys";
import { FulfilmentError } from "@/lib/fulfilment-service";
import { downloadShippitLabel, parseShippitLabel, parseShippitTracking, shippitOrderPayload, shippitRequest, type ParcelDimensions } from "@/lib/shippit";

// A separate Shippit order is created for each physical box. Shippit combines
// parcel_attributes by default, so a multi-parcel order cannot guarantee one label per box.
export async function createShippitParcel(orderId: string, storeId: string, actorId: string, parcel: ParcelDimensions, service: "standard" | "express", requestId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId }, include: { user: { select: { email: true } } } });
  if (!order || order.status !== "READY_TO_SHIP") throw new FulfilmentError("Order must be ready to ship", 409);
  if (order.shippingCountry !== "AU") throw new FulfilmentError("Shippit domestic labels currently require an Australian destination", 409);
  const origin = await db.shippingOrigin.findFirst({ where: { storeId, active: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  if (!origin || origin.country !== "AU") throw new FulfilmentError("Configure an Australian dispatch origin matching your Shippit location", 409);
  const key = `shippit:${order.id}:${requestId}`;
  const reference = `${order.orderNumber}-${requestId.slice(0, 8)}`;
  const payload = shippitOrderPayload(order, parcel, reference, service);
  const existing = await db.shipment.findUnique({ where: { idempotencyKey: key } });
  if (existing) return existing;
  let created = true;
  const shipment = await db.shipment.create({ data: { idempotencyKey: key, storeId, orderId, originId: origin.id, createdById: actorId, serviceCode: service, serviceName: `Shippit ${service}`, parcel: parcel as object, status: "DRAFT", externalRequestAt: new Date() } }).catch(async error => {
    const concurrent = await db.shipment.findUnique({ where: { idempotencyKey: key } });
    if (concurrent) { created = false; return concurrent; }
    throw error;
  });
  if (!created) return shipment;
  // Never retry an ambiguous POST: the remote order may have been created and billed.
  // The persisted retailer_invoice allows manual reconciliation in Shippit.
  try {
    const trackingNumber = parseShippitTracking(await shippitRequest("/orders", { method: "POST", body: JSON.stringify(payload) }));
    return await db.shipment.update({ where: { id: shipment.id }, data: { providerShipmentId: trackingNumber, trackingNumber, trackingUrl: `https://www.shippit.com/track/${encodeURIComponent(trackingNumber)}` } });
  } catch (error) {
    await db.auditLog.create({ data: { actorId, storeId, action: "SHIPPIT_CREATE_RECONCILE", entityType: "Shipment", entityId: shipment.id, metadata: { reference, reason: error instanceof Error ? error.message.slice(0, 180) : "Unknown error" } } });
    throw error;
  }
}

export async function refreshShippitLabel(shipmentId: string, storeId: string, actorId: string) {
  const shipment = await db.shipment.findFirst({ where: { id: shipmentId, storeId, idempotencyKey: { startsWith: "shippit:" } }, include: { order: true } });
  if (!shipment?.providerShipmentId) throw new FulfilmentError("Shippit order needs manual reconciliation before obtaining a label", 409);
  if (shipment.labelStorageKey) return shipment;
  if (shipment.order.status !== "READY_TO_SHIP") throw new FulfilmentError("Order must be ready to ship", 409);
  const parsed = parseShippitLabel(await shippitRequest(`/orders/${encodeURIComponent(shipment.providerShipmentId)}/label`));
  const bytes = await downloadShippitLabel(parsed.url);
  const storageKey = createDocumentStorageKey(currentAppEnvironment(), shipment.order.sourceDomain.includes("kosykin") ? "kosykin" : "tapkin", randomUUID(), "pdf");
  await getStorageProvider().put(storageKey, bytes, { contentType: "application/pdf", cacheControl: "private, no-store", metadata: { environment: currentAppEnvironment(), purpose: "shipping-label" } });
  const changed = await db.$transaction(async tx => {
    const updated = await tx.shipment.update({ where: { id: shipmentId }, data: { labelStorageKey: storageKey, labelMimeType: "application/pdf", labelCreatedAt: new Date(), serviceName: parsed.carrier, status: "LABEL_READY", trackingUrl: parsed.trackingUrl?.startsWith("https://") ? parsed.trackingUrl : shipment.trackingUrl } });
    await tx.printJob.create({ data: { storeId, shipmentId } });
    await tx.auditLog.create({ data: { actorId, storeId, action: "SHIPPIT_LABEL_CREATED", entityType: "Shipment", entityId: shipmentId } });
    return updated;
  }).catch(async error => { await getStorageProvider().delete(storageKey).catch(() => undefined); throw error; });
  return changed;
}

export async function bookShippitParcel(shipmentId: string, storeId: string, actorId: string) {
  const shipment = await db.shipment.findFirst({ where: { id: shipmentId, storeId, idempotencyKey: { startsWith: "shippit:" } }, include: { order: true } });
  if (!shipment?.trackingNumber || !shipment.labelStorageKey || shipment.order.status !== "READY_TO_SHIP") throw new FulfilmentError("A ready order with a label is required", 409);
  if (shipment.bookedAt) return shipment;
  // Lock the booking intent before the external call, including across concurrent requests.
  const locked = await db.shipment.updateMany({ where: { id: shipment.id, bookedAt: null, externalRequestAt: { not: null } }, data: { externalRequestAt: null } });
  if (!locked.count) throw new FulfilmentError("Booking is already in progress or requires manual reconciliation in Shippit", 409);
  const response = await shippitRequest("/book", { method: "POST", body: JSON.stringify({ orders: [shipment.trackingNumber] }) });
  if (!Array.isArray(response?.response) || !response.response.some((item: { success?: boolean }) => item.success === true) || response.response.some((item: { success?: boolean }) => item.success === false)) throw new FulfilmentError("Booking was not confirmed. Check Shippit before any retry.", 409);
  return db.$transaction(async tx => {
    const updated = await tx.shipment.update({ where: { id: shipment.id }, data: { bookedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, storeId, action: "SHIPPIT_PARCEL_BOOKED", entityType: "Shipment", entityId: shipment.id } });
    return updated;
  });
}
