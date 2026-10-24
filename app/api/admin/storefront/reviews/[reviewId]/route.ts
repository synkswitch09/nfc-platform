import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext, canManageStore } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("content.publish");
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = z.object({ status: z.enum(["PENDING", "PUBLISHED", "HIDDEN"]) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid review status", 400);
  const { reviewId } = await params;
  const changed = await db.productReview.updateMany({ where: { id: reviewId, storeId: context!.store.id }, data: parsed.data });
  if (!changed.count) return jsonError("Review not found", 404);
  await db.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "REVIEW_MODERATED", entityType: "ProductReview", entityId: reviewId, metadata: parsed.data } });
  return NextResponse.json({ ok: true });
}
