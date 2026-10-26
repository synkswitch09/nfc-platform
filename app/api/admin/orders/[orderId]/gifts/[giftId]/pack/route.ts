import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { assertNoSupportHold } from "@/lib/support-access";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; giftId: string }> },
) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("production.write");
  if (!context) return jsonError("Forbidden", 403);
  const input = await request.json().catch(() => ({}));
  const action = input?.action ?? "PACK";
  if (!["PACK", "PRINT"].includes(action)) return jsonError("Invalid gift action");
  const { orderId, giftId } = await params;
  const order = await db.order.findFirst({
    where: {
      id: orderId,
      storeId: context.store.id,
      status: { in: ["PAID", "PROCESSING"] },
    },
  });
  if (!order) return jsonError("Order not open for packing", 409);
  const changed = await db.$transaction(async (tx) => {
    await assertNoSupportHold(tx, orderId, context.store.id);
    const result = await tx.orderGift.updateMany({
      where: {
        id: giftId,
        orderId,
        packedAt: null,
        ...(action === "PRINT" ? { requiresPrinting: true, printedAt: null } : { OR: [{ requiresPrinting: false }, { printedAt: { not: null } }] }),
        order: {
          storeId: context.store.id,
          status: { in: ["PAID", "PROCESSING"] },
        },
      },
      data: action === "PRINT" ? { printedAt: new Date() } : { packedAt: new Date() },
    });
    if (result.count)
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          storeId: context.store.id,
          action: action === "PRINT" ? "GIFT_PRINTED" : "GIFT_PACKED",
          entityType: "OrderGift",
          entityId: giftId,
        },
      });
    return result.count;
  });
  return changed
    ? NextResponse.json({ ok: true })
    : jsonError("Gift not found, already completed, or still awaiting printing", 409);
}
