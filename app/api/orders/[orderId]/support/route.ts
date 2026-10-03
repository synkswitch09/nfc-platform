import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStorefront } from "@/lib/storefront";

const schema = z.object({ kind: z.enum(["ORDER_CHANGE", "CANCELLATION_REQUEST", "DELIVERY", "QUALITY", "OTHER"]), message: z.string().trim().min(10).max(2000), claimToken: z.string().min(20).max(200).optional() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limit = await rateLimit("order-support", getClientIp(request), 10, 60 * 60 * 1000);
  if (!limit.allowed) return jsonError("Too many requests", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  const { orderId } = await params;
  const [store, user] = await Promise.all([getCurrentStorefront(), getCurrentUser()]);
  const order = await db.order.findFirst({ where: { id: orderId, storeId: store.id, OR: [user ? { userId: user.id } : { id: "00000000-0000-0000-0000-000000000000" }, parsed.data.claimToken ? { claimTokenHash: sha256(parsed.data.claimToken), claimExpiresAt: { gt: new Date() } } : { id: "00000000-0000-0000-0000-000000000000" }] }, select: { id: true, status: true } });
  if (!order || ["PAYMENT_PENDING", "PENDING"].includes(order.status)) return jsonError("Order not found", 404);
  const support = await db.orderSupportRequest.create({ data: { orderId, storeId: store.id, kind: parsed.data.kind, message: parsed.data.message } });
  return NextResponse.json({ id: support.id }, { status: 201 });
}
