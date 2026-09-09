import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage, MAX_PRODUCT_IMAGE_BYTES, validateAndStoreImage } from "@/lib/uploads";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getAdminApiUser(); if (!user) return jsonError("Forbidden", 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0); if (contentLength > MAX_PRODUCT_IMAGE_BYTES + 100_000) return jsonError("Images must be 5 MB or smaller", 413);
  const { productId } = await params; const form = await request.formData(); const file = form.get("file"); const altText = String(form.get("altText") ?? "").trim();
  if (!(file instanceof File)) return jsonError("Select an image");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return jsonError("Images must be 5 MB or smaller", 413);
  if (altText.length < 3 || altText.length > 160) return jsonError("Alternative text must contain 3–160 characters");
  const product = await db.product.findUnique({ where: { id: productId }, include: { _count: { select: { images: true } } } });
  if (!product) return jsonError("Product not found", 404); if (product._count.images >= 10) return jsonError("A product can have up to 10 images", 409);
  let stored: Awaited<ReturnType<typeof validateAndStoreImage>>;
  try { stored = await validateAndStoreImage(file); } catch (error) { return jsonError(error instanceof Error && error.message === "IMAGE_SIZE" ? "Images must be 5 MB or smaller" : error instanceof Error && error.message === "IMAGE_DIMENSIONS" ? "Image dimensions are invalid or exceed 40 megapixels" : "Use a genuine PNG, JPEG or WebP image", 415); }
  try {
    const primary = product._count.images === 0 || form.get("isPrimary") === "true";
    const image = await db.$transaction(async tx => {
      if (primary) await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      const created = await tx.productImage.create({ data: { productId, storageKey: stored.storageKey, url: `/api/media/${stored.storageKey}`, altText, mimeType: stored.mimeType, byteSize: stored.byteSize, width: stored.width, height: stored.height, sortOrder: product._count.images, isPrimary: primary } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PRODUCT_IMAGE_ADDED", entityType: "ProductImage", entityId: created.id, metadata: { productId, byteSize: stored.byteSize } } });
      return created;
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch { await deleteStoredImage(stored.storageKey); return jsonError("Image could not be saved", 500); }
}
