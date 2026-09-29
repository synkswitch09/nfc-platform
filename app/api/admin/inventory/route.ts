import { adjustStock, InventoryConflict } from "@/lib/inventory-service";
import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { inventoryAdjustmentSchema } from "@/lib/admin-validation";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { queueEtsyInventorySync } from "@/lib/etsy";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const parsed = inventoryAdjustmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid adjustment");
  try {
    const result = await db.$transaction(async tx => {
      const adjusted = await adjustStock(tx, { ...parsed.data, storeId: store.id, actorId: user.id });
      if (adjusted) await queueEtsyInventorySync(tx, store.id, adjusted.productId);
      return adjusted;
    });
    if (!result) return jsonError("Variant not found", 404);
    return NextResponse.json({ quantity: result.quantity });
  } catch (error) {
    if (error instanceof InventoryConflict) return jsonError(error.message, 409);
    return jsonError("Stock could not be updated. Refresh and try again.", 409);
  }
}
