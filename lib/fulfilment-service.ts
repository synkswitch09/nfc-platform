import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { currentAppEnvironment } from "@/lib/config";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createShippingLabelPdf } from "@/lib/pdf-label";
import { getStorageProvider } from "@/lib/storage";
import { createDocumentStorageKey } from "@/lib/storage/keys";
import type { Storefront } from "@/lib/storefront";

const LEASE_MS = 2 * 60 * 1000;

export class FulfilmentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function createShipmentLabel(orderId: string, store: Storefront, actorId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { shipments: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } } } });
  if (!order) throw new FulfilmentError("Order not found", 404);
  const existing = order.shipments.find(shipment => shipment.labelStorageKey);
  if (existing) return { shipment: existing, created: false };
  if (order.status !== "READY_TO_SHIP") throw new FulfilmentError("The order must be ready to ship before creating a label", 409);
  if (!order.shippingProviderKey || !order.shippingServiceCode || !order.shippingServiceName) throw new FulfilmentError("The order has no shipping service snapshot", 409);
  const provider = await db.shippingProvider.findFirst({ where: { storeId: store.id, key: order.shippingProviderKey, active: true, supportsLabels: true } });
  if (!provider) throw new FulfilmentError("This shipping provider cannot create labels. Add tracking manually or configure a label-capable provider.", 409);
  if (provider.kind !== "MOCK") throw new FulfilmentError("The live carrier label adapter is not enabled", 503);
  const origin = await db.shippingOrigin.findFirst({ where: { storeId: store.id, active: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  if (!origin) throw new FulfilmentError("A shipping origin is required", 409);

  const trackingNumber = `MOCK${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const label = createShippingLabelPdf([
    store.displayName,
    order.shippingServiceName,
    `Order ${order.orderNumber}`,
    order.shippingName ?? "Recipient",
    order.shippingLine1 ?? "",
    order.shippingLine2 ?? "",
    `${order.shippingSuburb ?? ""} ${order.shippingState ?? ""} ${order.shippingPostcode ?? ""}`.trim(),
    order.shippingCountry,
    `Tracking ${trackingNumber}`,
  ].filter(Boolean));
  const storageKey = createDocumentStorageKey(currentAppEnvironment(), store.slug, randomUUID(), "pdf");
  await getStorageProvider().put(storageKey, label, { contentType: "application/pdf", cacheControl: "private, no-store", metadata: { environment: currentAppEnvironment(), store: store.slug, purpose: "shipping-label" } });
  try {
    const shipment = await db.$transaction(async tx => {
      const created = await tx.shipment.create({ data: { idempotencyKey: `${order.id}:${order.shippingProviderKey}:${order.shippingServiceCode}:v1`, storeId: store.id, orderId: order.id, originId: origin.id, providerId: provider.id, providerShipmentId: trackingNumber, status: "LABEL_READY", serviceCode: order.shippingServiceCode!, serviceName: order.shippingServiceName!, trackingNumber, trackingUrl: null, labelStorageKey: storageKey, labelMimeType: "application/pdf", labelCreatedAt: new Date(), createdById: actorId } });
      await tx.order.update({ where: { id: order.id }, data: { shippingCarrier: provider.name, trackingNumber } });
      await tx.printJob.create({ data: { storeId: store.id, shipmentId: created.id, status: "QUEUED" } });
      await tx.auditLog.create({ data: { actorId, storeId: store.id, action: "SHIPMENT_LABEL_CREATED", entityType: "Shipment", entityId: created.id, metadata: { orderId: order.id, provider: provider.key, serviceCode: order.shippingServiceCode } } });
      return created;
    });
    return { shipment, created: true };
  } catch (error) {
    await getStorageProvider().delete(storageKey).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await db.shipment.findUnique({ where: { idempotencyKey: `${order.id}:${order.shippingProviderKey}:${order.shippingServiceCode}:v1` } });
      if (concurrent) return { shipment: concurrent, created: false };
    }
    throw error;
  }
}

export async function queueShipmentReprint(shipmentId: string, storeId: string, actorId: string) {
  const shipment = await db.shipment.findFirst({ where: { id: shipmentId, storeId, status: "LABEL_READY", labelStorageKey: { not: null } } });
  if (!shipment) throw new FulfilmentError("A printable shipment label was not found", 404);
  return db.$transaction(async tx => {
    const job = await tx.printJob.create({ data: { storeId, shipmentId } });
    await tx.auditLog.create({ data: { actorId, storeId, action: "SHIPMENT_LABEL_REPRINT_QUEUED", entityType: "Shipment", entityId: shipmentId, metadata: { printJobId: job.id } } });
    return job;
  });
}

export async function registerPrintAgent(storeId: string, name: string, printerName: string | undefined, actorId: string) {
  const token = createOpaqueToken();
  const agent = await db.printAgent.create({ data: { storeId, name, printerName: printerName || null, tokenHash: sha256(token), createdById: actorId } });
  await db.auditLog.create({ data: { actorId, storeId, action: "PRINT_AGENT_REGISTERED", entityType: "PrintAgent", entityId: agent.id, metadata: { name, printerName: printerName || null } } });
  return { agent, token };
}

async function authenticatePrintAgent(token: string) {
  const agent = await db.printAgent.findUnique({ where: { tokenHash: sha256(token) } });
  if (!agent?.active) throw new FulfilmentError("Invalid print agent credential", 401);
  return agent;
}

export async function claimPrintJob(agentToken: string) {
  const agent = await authenticatePrintAgent(agentToken);
  const now = new Date();
  return db.$transaction(async tx => {
    const candidate = await tx.printJob.findFirst({ where: { storeId: agent.storeId, OR: [{ status: "QUEUED" }, { status: "CLAIMED", leaseExpiresAt: { lt: now } }] }, orderBy: { createdAt: "asc" } });
    await tx.printAgent.update({ where: { id: agent.id }, data: { lastSeenAt: now } });
    if (!candidate) return null;
    const leaseToken = createOpaqueToken();
    const changed = await tx.printJob.updateMany({ where: { id: candidate.id, OR: [{ status: "QUEUED" }, { status: "CLAIMED", leaseExpiresAt: { lt: now } }] }, data: { status: "CLAIMED", printAgentId: agent.id, leaseTokenHash: sha256(leaseToken), leaseExpiresAt: new Date(now.getTime() + LEASE_MS), claimedAt: now, attempts: { increment: 1 }, errorMessage: null } });
    if (!changed.count) return null;
    return { id: candidate.id, leaseToken, documentUrl: `/api/print-agent/jobs/${candidate.id}/document`, copies: candidate.copies };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function readClaimedPrintDocument(agentToken: string, jobId: string, leaseToken: string) {
  const agent = await authenticatePrintAgent(agentToken);
  const job = await db.printJob.findFirst({ where: { id: jobId, storeId: agent.storeId, printAgentId: agent.id, status: "CLAIMED", leaseTokenHash: sha256(leaseToken), leaseExpiresAt: { gt: new Date() } }, include: { shipment: true } });
  if (!job?.shipment.labelStorageKey) throw new FulfilmentError("The print lease is invalid or expired", 401);
  const bytes = await getStorageProvider().get(job.shipment.labelStorageKey);
  if (!bytes) throw new FulfilmentError("Label document not found", 404);
  return { bytes, mimeType: job.shipment.labelMimeType ?? "application/pdf" };
}

export async function completePrintJob(agentToken: string, jobId: string, leaseToken: string, success: boolean, errorMessage?: string) {
  const agent = await authenticatePrintAgent(agentToken);
  const changed = await db.printJob.updateMany({ where: { id: jobId, storeId: agent.storeId, printAgentId: agent.id, status: "CLAIMED", leaseTokenHash: sha256(leaseToken), leaseExpiresAt: { gt: new Date() } }, data: success ? { status: "PRINTED", printedAt: new Date(), leaseTokenHash: null, leaseExpiresAt: null } : { status: "FAILED", failedAt: new Date(), errorMessage: errorMessage?.slice(0, 500) || "Print failed", leaseTokenHash: null, leaseExpiresAt: null } });
  if (!changed.count) throw new FulfilmentError("The print lease is invalid or expired", 409);
  return { ok: true };
}
