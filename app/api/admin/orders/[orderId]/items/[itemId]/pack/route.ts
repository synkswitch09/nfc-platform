import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ quantity: z.number().int().min(0), tagIds: z.array(z.string().trim().min(1)).max(100).default([]), removeTagIds: z.array(z.string().trim().min(1)).max(100).default([]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string; itemId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid packing quantity or NFC IDs", 400);
  const { orderId, itemId } = await params;
  const item = await db.orderItem.findFirst({ where: { id: itemId, orderId, order: { storeId: context.store.id } }, select: { id: true, quantity: true, packedQuantity: true, variantId: true, order: { select: { status: true } }, shippingSnapshot: true, manufacturingJobs: { select: { quantity: true, status: true } }, tags: { select: { publicTagId: true, manufacturingStatus: true, status: true } } } });
  if (!item) return jsonError("Order item not found", 404);
  if (!["PAID", "PROCESSING"].includes(item.order.status)) return jsonError("Order is not open for packing", 409);
  const { quantity, tagIds, removeTagIds } = parsed.data;
  if (quantity > item.quantity) return jsonError("Packed quantity exceeds purchased quantity", 400);
  const snapshot = item.shippingSnapshot && typeof item.shippingSnapshot === "object" && !Array.isArray(item.shippingSnapshot) ? (item.shippingSnapshot as Record<string, unknown>).production : null;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || typeof (snapshot as Record<string, unknown>).requiresManufacturing !== "boolean" || typeof (snapshot as Record<string, unknown>).requiresNfc !== "boolean") return jsonError("Production requirements missing from this historical line; manager review required", 409);
  const requirements = snapshot as { requiresManufacturing: boolean; requiresNfc: boolean };
  if (requirements.requiresManufacturing && item.manufacturingJobs.filter(job => job.status === "READY").reduce((sum, job) => sum + job.quantity, 0) < quantity) return jsonError("Production is not complete for this quantity", 409);
  if (new Set([...tagIds, ...removeTagIds]).size !== tagIds.length + removeTagIds.length) return jsonError("NFC IDs must be unique", 400);
  if ((!requirements.requiresNfc && (tagIds.length || removeTagIds.length)) || (requirements.requiresNfc && tagIds.length + item.tags.length - removeTagIds.length !== quantity)) return jsonError("Provide exactly one verified NFC unit per packed unit", 409);
  try {
    const changed = await db.$transaction(async tx => {
      const current = await tx.orderItem.findFirst({ where: { id: itemId, orderId, order: { storeId: context.store.id, status: { in: ["PAID", "PROCESSING"] } } }, select: { packedQuantity: true, tags: { select: { publicTagId: true } }, manufacturingJobs: { select: { status: true, quantity: true } } } });
      if (!current || current.packedQuantity !== item.packedQuantity || current.tags.length !== item.tags.length) return false;
      if (requirements.requiresManufacturing && current.manufacturingJobs.filter(job => job.status === "READY").reduce((sum, job) => sum + job.quantity, 0) < quantity) return false;
      for (const publicTagId of removeTagIds) {
        const removed = await tx.nFCTag.updateMany({ where: { publicTagId, storeId: context.store.id, orderItemId: itemId, manufacturingStatus: "ASSIGNED", status: "UNCLAIMED" }, data: { orderItemId: null, manufacturingStatus: "READY" } });
        if (!removed.count) throw new Error("NFC unit cannot be removed from this line");
      }
      for (const publicTagId of tagIds) {
        const assigned = await tx.nFCTag.updateMany({ where: { publicTagId, storeId: context.store.id, productVariantId: item.variantId, orderItemId: null, manufacturingStatus: "READY", status: "UNCLAIMED" }, data: { orderItemId: itemId, manufacturingStatus: "ASSIGNED" } });
        if (!assigned.count) throw new Error("NFC unit is unavailable, unverified or belongs to another variant");
      }
      const updated = await tx.orderItem.updateMany({ where: { id: itemId, orderId, packedQuantity: current.packedQuantity }, data: { packedQuantity: quantity, packedAt: quantity === item.quantity ? new Date() : null } });
      if (!updated.count) throw new Error("Packing changed during update");
      await tx.auditLog.create({ data: { storeId: context.store.id, actorId: context.user.id, action: "ORDER_ITEM_PACKED", entityType: "OrderItem", entityId: itemId, metadata: { quantity, previous: current.packedQuantity, assignedTags: tagIds, removedTags: removeTagIds } } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!changed) return jsonError("Packing changed; refresh and try again", 409);
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error instanceof Error && error.message.startsWith("NFC unit") ? error.message : "Packing changed; refresh and try again", 409); }
}
