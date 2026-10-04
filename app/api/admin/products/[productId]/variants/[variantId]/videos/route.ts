import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage } from "@/lib/uploads";
import { MAX_PRODUCT_VIDEO_BYTES, storeProductVideo } from "@/lib/video-upload";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string; variantId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { productId, variantId } = await params;
  const variant = await db.productVariant.findFirst({ where: { id: variantId, productId, product: { storeId: context.store.id } }, select: { id: true, _count: { select: { videos: true } } } });
  if (!variant) return jsonError("Variant not found", 404);
  if (variant._count.videos >= 5) return jsonError("Up to five videos per variant", 409);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PRODUCT_VIDEO_BYTES + 100_000) return jsonError("Video must be 50 MB or smaller", 413);
  const form = await request.formData(); const file = form.get("file"); const caption = String(form.get("caption") ?? "").trim();
  if (!(file instanceof File)) return jsonError("Select an MP4 video", 400);
  if (caption.length < 3 || caption.length > 160) return jsonError("Describe the video in 3–160 characters", 400);
  let stored: Awaited<ReturnType<typeof storeProductVideo>>;
  try { stored = await storeProductVideo(file, context.store.slug); }
  catch (error) { return jsonError(error instanceof Error && error.message === "VIDEO_SIZE" ? "Video must be 50 MB or smaller" : "Use a genuine MP4 video", 415); }
  try {
    const video = await db.productVideo.create({ data: { productId, variantId, storageKey: stored.storageKey, caption, byteSize: stored.byteSize, sortOrder: variant._count.videos } });
    return NextResponse.json({ video }, { status: 201 });
  } catch { await deleteStoredImage(stored.storageKey); return jsonError("Could not save the video", 500); }
}
