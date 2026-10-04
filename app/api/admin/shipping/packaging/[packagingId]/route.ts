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
  try {
    await db.$transaction(async tx => {
      const item = await tx.packaging.findFirst({ where: { id: packagingId, storeId: context!.store.id }, include: { products: { select: { name: true }, take: 3 }, shippingRates: { select: { id: true, zoneId: true, serviceCode: true } } } });
      if (!item) throw new Error("NOT_FOUND");
      if (item.code === "OUTER-BOX-30X25X25") throw new Error("OUTER_BOX");
      if (item.products.length) throw new Error(`PRODUCTS:${item.products.map(product => product.name).join(", ")}`);
      if (item.code !== "SMALL-PARCEL" && item.shippingRates.length) throw new Error("RATES");
      if (item.code === "SMALL-PARCEL") {
        for (const rate of item.shippingRates) {
          const duplicate = await tx.shippingRate.findFirst({ where: { storeId: context!.store.id, zoneId: rate.zoneId, serviceCode: rate.serviceCode, packagingId: null, id: { not: rate.id } } });
          if (duplicate) throw new Error("DUPLICATE_RATE");
        }
        await tx.shippingRate.updateMany({ where: { storeId: context!.store.id, packagingId }, data: { packagingId: null } });
      }
      // Old variant shipping overrides are no longer used; their invisible
      // references must not block removal of a product-level package.
      await tx.productVariant.updateMany({ where: { product: { storeId: context!.store.id }, defaultPackagingId: packagingId }, data: { defaultPackagingId: null } });
      await tx.packaging.delete({ where: { id: packagingId } });
      await tx.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "PACKAGING_DELETED", entityType: "Packaging", entityId: packagingId, metadata: { code: item.code, retainedRates: item.code === "SMALL-PARCEL" ? item.shippingRates.length : 0 } } });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "NOT_FOUND") return jsonError("Packaging not found", 404);
    if (reason === "OUTER_BOX") return jsonError("Keep the outer shipping box for multi-item orders; edit its measurements instead.", 409);
    if (reason.startsWith("PRODUCTS:")) return jsonError(`This package is assigned to: ${reason.slice(9)}. Change those products first.`, 409);
    if (reason === "RATES") return jsonError("This package is linked to a delivery rate. Change the rate before deleting it.", 409);
    if (reason === "DUPLICATE_RATE") return jsonError("A general rate already exists for this service. Review the rates before deleting the legacy package.", 409);
    return jsonError("The package could not be removed. Try again after refreshing Shipping.", 409);
  }
  return NextResponse.json({ ok: true });
}
