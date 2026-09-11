import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { inventoryAdjustmentSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = inventoryAdjustmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid adjustment");
  const { variantId, quantity, reason } = parsed.data;
  const result = await db.$transaction(async tx => {
    const variant = await tx.productVariant.findFirst({ where: { id: variantId, product: { storeId: store.id } }, select: { inventory: true, reservedInventory: true } });
    if (!variant) return null;
    if (quantity < variant.reservedInventory) throw new Error("RESERVED_STOCK");
    const difference = quantity - variant.inventory;
    await tx.productVariant.update({ where: { id: variantId }, data: { inventory: quantity } });
    if (difference !== 0) await tx.inventoryMovement.create({ data: { variantId, actorId: user.id, type: "ADJUSTMENT", quantity: difference, reason } });
    await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "INVENTORY_ADJUSTED", entityType: "ProductVariant", entityId: variantId, metadata: { from: variant.inventory, to: quantity, reason } } });
    return { quantity };
  }).catch(error => {
    if (error instanceof Error && error.message === "RESERVED_STOCK") return "reserved" as const;
    throw error;
  });
  if (result === "reserved") return jsonError("Stock cannot be lower than reserved units", 409);
  if (!result) return jsonError("Variant not found", 404);
  return NextResponse.json(result);
}
