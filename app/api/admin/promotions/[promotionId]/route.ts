import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { promotionSchema } from "@/app/api/admin/promotions/route";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ promotionId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const { promotionId } = await params;
  const parsed = promotionSchema.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid promotion", 400);
  const changed = await db.promotion.updateMany({ where: { id: promotionId, storeId: context!.store.id }, data: parsed.data });
  return changed.count ? NextResponse.json({ ok: true }) : jsonError("Promotion not found", 404);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ promotionId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const { promotionId } = await params;
  const promo = await db.promotion.findFirst({ where: { id: promotionId, storeId: context!.store.id }, select: { _count: { select: { orders: true } } } });
  if (!promo) return jsonError("Promotion not found", 404);
  if (promo._count.orders) return jsonError("Used promotions can be disabled but not deleted", 409);
  await db.promotion.delete({ where: { id: promotionId } });
  return NextResponse.json({ ok: true });
}
