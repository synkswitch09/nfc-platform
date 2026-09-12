import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage, MAX_PRODUCT_IMAGE_BYTES, validateAndStoreImage } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) return jsonError("Store administrator access required", 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PRODUCT_IMAGE_BYTES + 100_000) return jsonError("Images must be 5 MB or smaller", 413);
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Select an image");
  let stored: Awaited<ReturnType<typeof validateAndStoreImage>>;
  try { stored = await validateAndStoreImage(file, context.store.slug, "store-media"); }
  catch (error) { return jsonError(error instanceof Error && error.message === "IMAGE_SIZE" ? "Images must be 5 MB or smaller" : error instanceof Error && error.message === "IMAGE_DIMENSIONS" ? "Image dimensions are invalid or exceed 40 megapixels" : "Use a genuine PNG, JPEG or WebP image", 415); }
  try {
    const image = await db.$transaction(async tx => {
      const created = await tx.categoryImage.create({ data: { storeId: context.store.id, storageKey: stored.storageKey, url: `/api/media/${stored.storageKey}`, purpose: "store-media", mimeType: stored.mimeType, byteSize: stored.byteSize, width: stored.width, height: stored.height } });
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "STORE_MEDIA_ADDED", entityType: "CategoryImage", entityId: created.id, metadata: { byteSize: stored.byteSize } } });
      return created;
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch { await deleteStoredImage(stored.storageKey); return jsonError("Image could not be saved", 500); }
}
