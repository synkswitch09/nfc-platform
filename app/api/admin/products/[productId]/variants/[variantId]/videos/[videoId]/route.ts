import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { deleteStoredImage } from "@/lib/uploads";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string; variantId: string; videoId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const { productId, variantId, videoId } = await params;
  const video = await db.productVideo.findFirst({ where: { id: videoId, variantId, productId, product: { storeId: context.store.id } } });
  if (!video) return jsonError("Video not found", 404);
  await db.productVideo.delete({ where: { id: video.id } });
  await deleteStoredImage(video.storageKey);
  return NextResponse.json({ ok: true });
}
