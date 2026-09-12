import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage, MAX_PRODUCT_IMAGE_BYTES, validateAndStoreImage } from "@/lib/uploads";

export async function POST(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { pageId } = await params; const page = await db.contentPage.findFirst({ where: { id: pageId, storeId: context.store.id, categoryId: null }, select: { id: true } }); if (!page) return jsonError("Page not found", 404);
  const contentLength = Number(request.headers.get("content-length") ?? 0); if (contentLength > MAX_PRODUCT_IMAGE_BYTES + 100_000) return jsonError("Images must be 5 MB or smaller", 413);
  const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) return jsonError("Select an image");
  let stored: Awaited<ReturnType<typeof validateAndStoreImage>>;
  try { stored = await validateAndStoreImage(file, context.store.slug, "page-image"); }
  catch (error) { return jsonError(error instanceof Error && error.message === "IMAGE_SIZE" ? "Images must be 5 MB or smaller" : error instanceof Error && error.message === "IMAGE_DIMENSIONS" ? "Image dimensions are invalid or exceed 40 megapixels" : "Use a genuine PNG, JPEG or WebP image", 415); }
  try { const image = await db.$transaction(async tx => { const created = await tx.categoryImage.create({ data: { storeId: context.store.id, pageId, storageKey: stored.storageKey, url: `/api/media/${stored.storageKey}`, purpose: "page-image", mimeType: stored.mimeType, byteSize: stored.byteSize, width: stored.width, height: stored.height } }); await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "CONTENT_PAGE_IMAGE_ADDED", entityType: "CategoryImage", entityId: created.id, metadata: { pageId, byteSize: stored.byteSize } } }); return created; }); return NextResponse.json({ image }, { status: 201 }); }
  catch { await deleteStoredImage(stored.storageKey); return jsonError("Image could not be saved", 500); }
}
