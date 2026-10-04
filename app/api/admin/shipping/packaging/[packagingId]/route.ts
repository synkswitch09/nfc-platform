import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { packageFields } from "@/lib/shipping-admin-validation";

type Context = { params: Promise<{ packagingId: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = packageFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid packaging", 400);
  const { packagingId } = await params;
  const item = await db.packaging.findFirst({ where: { id: packagingId, storeId: context!.store.id } });
  if (!item) return jsonError("Packaging not found", 404);
  if (item.code.startsWith("MAILER-") ? parsed.data.heightMm !== 0 : parsed.data.heightMm === 0) return jsonError("Check the package height", 400);
  if (parsed.data.maxWeightGrams !== null && parsed.data.maxWeightGrams <= parsed.data.emptyWeightGrams) return jsonError("Maximum weight must exceed empty weight", 400);
  await db.packaging.update({ where: { id: packagingId }, data: parsed.data });
  await db.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "PACKAGING_UPDATED", entityType: "Packaging", entityId: packagingId } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const { packagingId } = await params;
  const item = await db.packaging.findFirst({ where: { id: packagingId, storeId: context!.store.id }, include: { _count: { select: { products: true, variants: true, shippingRates: true } } } });
  if (!item) return jsonError("Packaging not found", 404);
  if (item._count.products || item._count.variants || item._count.shippingRates) return jsonError("This package is in use. Remove it from products and rates before deleting it.", 409);
  if (item.code === "OUTER-BOX-30X25X25") return jsonError("Keep the outer shipping box for multi-item orders; edit its measurements instead.", 409);
  await db.packaging.delete({ where: { id: packagingId } });
  await db.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "PACKAGING_DELETED", entityType: "Packaging", entityId: packagingId, metadata: { code: item.code } } });
  return NextResponse.json({ ok: true });
}
