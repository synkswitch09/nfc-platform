import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "OUT_OF_STOCK", "ARCHIVED"]), reason: z.string().trim().min(3).max(300) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid product status");
  const { productId } = await params;
  const product = await db.product.findFirst({ where: { id: productId, storeId: store.id }, select: { status: true } }); if (!product) return jsonError("Product not found", 404);
  await db.$transaction([
    db.product.update({ where: { id: productId }, data: { status: parsed.data.status, ...(parsed.data.status === "HIDDEN" || parsed.data.status === "ARCHIVED" ? { shopVisible: false } : {}) } }),
    db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: parsed.data.status === "HIDDEN" ? "PRODUCT_HIDDEN" : parsed.data.status === "ARCHIVED" ? "PRODUCT_ARCHIVED" : "PRODUCT_STATUS_CHANGED", entityType: "Product", entityId: productId, metadata: { fromStatus: product.status, toStatus: parsed.data.status, reason: parsed.data.reason } } }),
  ]);
  return NextResponse.json({ ok: true });
}
