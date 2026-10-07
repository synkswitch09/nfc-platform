import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentAppEnvironment } from "@/lib/config";
import { createShippitParcel, refreshShippitLabel } from "@/lib/shippit-fulfilment";

const packedParcel = z.object({
  quantity: z.number().int().min(1).max(30),
  weightGrams: z.number().int().min(1).max(30000),
  lengthMm: z.number().int().min(1).max(1000),
  widthMm: z.number().int().min(1).max(1000),
  heightMm: z.number().int().min(1).max(1000),
});

export function checkoutShippitParcels(snapshot: unknown) {
  const saved = z.object({ parcels: z.array(packedParcel).min(1).max(30) }).parse(snapshot);
  const parcels = saved.parcels.flatMap(({ quantity, ...dimensions }) => Array.from({ length: quantity }, () => dimensions));
  if (parcels.length > 30) throw new Error("Too many shipping parcels");
  return parcels;
}

export function automaticShippitService(provider: string | null, service: string | null) {
  if (provider !== "shippit" && provider !== "manual") return null;
  const level = service?.toLowerCase();
  return level === "standard" || level === "express" ? level : null;
}

export async function queueShippitPreparation(tx: Prisma.TransactionClient, order: { id: string; shippingProviderKey: string | null; shippingServiceCode: string | null }) {
  if (currentAppEnvironment() === "development" || !automaticShippitService(order.shippingProviderKey, order.shippingServiceCode)) return;
  await tx.shippitPreparation.upsert({ where: { orderId: order.id }, create: { orderId: order.id }, update: {} });
}

// Durable queue serviced by the existing authenticated order-operations worker.
// Each turn prepares one box, so a large order cannot monopolise a HTTP request.
export async function processShippitPreparations(orderId?: string) {
  const environment = currentAppEnvironment();
  if (environment === "development") return { checked: 0 };
  const now = new Date();
  const due = { OR: [{ status: "PENDING", availableAt: { lte: now } }, { status: "PROCESSING", leaseUntil: { lt: now } }] };
  const jobs = await db.shippitPreparation.findMany({ where: { ...due, ...(orderId ? { orderId } : {}) }, orderBy: { availableAt: "asc" }, take: orderId ? 1 : 3 });
  for (const job of jobs) {
    const leaseToken = randomUUID();
    const claim = await db.shippitPreparation.updateMany({ where: { orderId: job.orderId, ...due }, data: { status: "PROCESSING", leaseToken, leaseUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } } });
    if (!claim.count) continue;
    const lease = { orderId: job.orderId, leaseToken };
    try {
      const order = await db.order.findUnique({ where: { id: job.orderId }, include: { payments: { select: { status: true, refundedAmountCents: true } }, shipments: true, items: { select: { shippingSnapshot: true } } } });
      if (!order || order.checkoutEnvironment !== environment.toUpperCase() || !["PAID", "PROCESSING", "READY_TO_SHIP"].includes(order.status) || !order.payments.some(payment => payment.status === "SUCCEEDED") || order.payments.some(payment => payment.status === "REFUNDED" || payment.refundedAmountCents > 0)) {
        await db.shippitPreparation.updateMany({ where: lease, data: { status: "STOPPED", leaseToken: null, leaseUntil: null } });
        continue;
      }
      const service = automaticShippitService(order.shippingProviderKey, order.shippingServiceCode);
      if (!service) throw new Error("REVIEW:Checkout shipping service is not supported by Shippit");
      const measurements = z.object({ weightGrams: z.number().positive(), heightMm: z.number().positive(), shippingPackageType: z.enum(["BOX", "MAILER"]), lengthMm: z.number().positive().nullable(), widthMm: z.number().positive().nullable() });
      const verified = order.items.length > 0 && order.items.every(item => {
        const parsed = measurements.safeParse(item.shippingSnapshot);
        return parsed.success && (parsed.data.shippingPackageType === "BOX" || Boolean(parsed.data.lengthMm && parsed.data.widthMm));
      });
      if (!verified) throw new Error("REVIEW:Product shipping measurements were incomplete at checkout; configure the product and reconcile this order");
      let parcels;
      try { parcels = checkoutShippitParcels(order.packagingSnapshot); }
      catch { throw new Error("REVIEW:Checkout package measurements are missing or invalid"); }
      if (order.shipments.some(shipment => !shipment.idempotencyKey.startsWith(`shippit:${order.id}:auto-`))) throw new Error("REVIEW:Existing manually created shipment must be reconciled before automatic preparation");
      const missingIndex = parcels.findIndex((_, index) => !order.shipments.some(shipment => shipment.idempotencyKey === `shippit:${order.id}:auto-${String(index + 1).padStart(3, "0")}` && shipment.labelStorageKey));
      if (missingIndex === -1) {
        await db.shippitPreparation.updateMany({ where: lease, data: { status: "COMPLETE", leaseToken: null, leaseUntil: null, lastError: null } });
        continue;
      }
      const shipment = await createShippitParcel(order.id, order.storeId, undefined, parcels[missingIndex], service, `auto-${String(missingIndex + 1).padStart(3, "0")}`);
      // A persisted intent without a remote ID may have succeeded remotely. Never POST it again.
      if (!shipment.providerShipmentId) throw new Error("REVIEW:Shippit creation is uncertain; reconcile the parcel reference before retrying");
      await refreshShippitLabel(shipment.id, order.storeId, undefined);
      await db.shippitPreparation.updateMany({ where: lease, data: { status: order.shipments.filter(shipment => shipment.labelStorageKey).length + 1 === parcels.length ? "COMPLETE" : "PENDING", availableAt: new Date(), attempts: 0, leaseToken: null, leaseUntil: null, lastError: null } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shippit preparation failed";
      const review = message.startsWith("REVIEW:");
      await db.shippitPreparation.updateMany({ where: lease, data: { status: review ? "REVIEW" : job.attempts + 1 >= 10 ? "FAILED" : "PENDING", leaseToken: null, leaseUntil: null, availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000), lastError: message.replace(/^REVIEW:/, "").slice(0, 300) } });
    }
  }
  return { checked: jobs.length };
}
