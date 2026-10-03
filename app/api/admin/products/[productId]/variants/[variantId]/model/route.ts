import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { MAX_GLB_BYTES, storeGlb } from "@/lib/glb-upload";
import { deleteStoredImage } from "@/lib/uploads";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string; variantId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { productId, variantId } = await params;
  const variant = await db.productVariant.findFirst({ where: { id: variantId, productId, product: { storeId: context.store.id, slug: { not: "custom-name-keychain" } } }, select: { id: true, modelStorageKey: true } });
  if (!variant) return jsonError("Variant not found or custom preview is managed in code", 404);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_GLB_BYTES + 100_000) return jsonError("GLB must be 20 MB or smaller", 413);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return jsonError("Select a GLB file", 400);
  let storageKey;
  try { storageKey = await storeGlb(file, context.store.slug); }
  catch (error) { return jsonError(error instanceof Error && error.message === "GLB_SIZE" ? "GLB must be 20 MB or smaller" : "Use a self-contained binary GLB 2.0 model", 415); }
  try {
    await db.productVariant.update({ where: { id: variant.id }, data: { modelStorageKey: storageKey } });
    if (variant.modelStorageKey) await deleteStoredImage(variant.modelStorageKey);
    return NextResponse.json({ url: `/api/media/${storageKey}` });
  } catch { await deleteStoredImage(storageKey); return jsonError("Could not save the model", 500); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string; variantId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { productId, variantId } = await params;
  const variant = await db.productVariant.findFirst({ where: { id: variantId, productId, product: { storeId: context.store.id } }, select: { id: true, modelStorageKey: true } });
  if (!variant) return jsonError("Variant not found", 404);
  await db.productVariant.update({ where: { id: variant.id }, data: { modelStorageKey: null } });
  if (variant.modelStorageKey) await deleteStoredImage(variant.modelStorageKey);
  return NextResponse.json({ ok: true });
}
