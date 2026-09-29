import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage } from "@/lib/uploads";

const schema = z.object({ altText: z.string().trim().min(3).max(160), isPrimary: z.boolean(), sortOrder: z.number().int().min(0).max(100), optionValueId: z.string().uuid().nullable().optional(), variantId: z.string().uuid().nullable().optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string; imageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid image details");
  const { productId, imageId } = await params;
  const exists = await db.productImage.findFirst({ where: { id: imageId, productId, product: { storeId: store.id } } }); if (!exists) return jsonError("Image not found", 404);
  if (parsed.data.optionValueId && !await db.productOptionValue.findFirst({ where: { id: parsed.data.optionValueId, option: { productId, product: { storeId: store.id } } }, select: { id: true } })) return jsonError("Colour choice does not belong to this product", 409);
  if (parsed.data.variantId && !await db.productVariant.findFirst({ where: { id: parsed.data.variantId, productId, product: { storeId: store.id } }, select: { id: true } })) return jsonError("Variant does not belong to this product", 409);
  await db.$transaction(async tx => {
    if (parsed.data.isPrimary) await tx.productImage.updateMany({ where: { productId, id: { not: imageId } }, data: { isPrimary: false } });
    const { variantId, ...imageData } = parsed.data;
    await tx.productImage.update({ where: { id: imageId }, data: imageData });
    await tx.productVariant.updateMany({ where: { productId, imageId }, data: { imageId: null } });
    if (variantId) await tx.productVariant.updateMany({ where: { id: variantId, productId }, data: { imageId } });
    await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_IMAGE_UPDATED", entityType: "ProductImage", entityId: imageId, metadata: { productId } } });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string; imageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const { user, store } = context;
  const { productId, imageId } = await params;
  const image = await db.productImage.findFirst({ where: { id: imageId, productId, product: { storeId: store.id } } }); if (!image) return jsonError("Image not found", 404);
  await db.$transaction(async tx => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) { const replacement = await tx.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: "asc" } }); if (replacement) await tx.productImage.update({ where: { id: replacement.id }, data: { isPrimary: true } }); }
    await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "PRODUCT_IMAGE_DELETED", entityType: "ProductImage", entityId: imageId, metadata: { productId } } });
  });
  await deleteStoredImage(image.storageKey);
  return NextResponse.json({ ok: true });
}
