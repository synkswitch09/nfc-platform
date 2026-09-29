import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage, MAX_PRODUCT_IMAGE_BYTES, validateAndStoreImage } from "@/lib/uploads";

export async function POST(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  const { user, store } = context;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PRODUCT_IMAGE_BYTES + 100_000) return jsonError("Images must be 5 MB or smaller", 413);

  const { categoryId } = await params;
  const category = await db.productCategory.findFirst({ where: { id: categoryId, storeId: store.id }, select: { id: true, contentPage: { select: { id: true } } } });
  if (!category) return jsonError("Category not found", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Select an image");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return jsonError("Images must be 5 MB or smaller", 413);

  let stored: Awaited<ReturnType<typeof validateAndStoreImage>>;
  try {
    stored = await validateAndStoreImage(file, store.slug, "category-image");
  } catch (error) {
    return jsonError(error instanceof Error && error.message === "IMAGE_SIZE" ? "Images must be 5 MB or smaller" : error instanceof Error && error.message === "IMAGE_DIMENSIONS" ? "Image dimensions are invalid or exceed 40 megapixels" : "Use a genuine PNG, JPEG or WebP image", 415);
  }

  try {
    const image = await db.$transaction(async tx => {
      const created = await tx.categoryImage.create({ data: { storeId: store.id, categoryId, pageId: category.contentPage?.id, storageKey: stored.storageKey, url: `/api/media/${stored.storageKey}`, purpose: "category-image", mimeType: stored.mimeType, byteSize: stored.byteSize, width: stored.width, height: stored.height } });
      await tx.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "CATEGORY_IMAGE_ADDED", entityType: "CategoryImage", entityId: created.id, metadata: { categoryId, byteSize: stored.byteSize } } });
      return created;
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch {
    await deleteStoredImage(stored.storageKey);
    return jsonError("Image could not be saved", 500);
  }
}
