import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ orderNumber: z.string().regex(/^TK-[A-Z0-9]{10}$/), claimToken: z.string().min(32).max(200) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to claim this order", 401);
  if (!user.emailVerifiedAt) return jsonError("Verify your email before claiming a guest order", 403);
  const limited = await rateLimit("order-claim", `${user.id}:${getClientIp(request)}`, 8, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many attempts. Try again later.", 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid or expired order claim", 400);

  const order = await db.order.findFirst({ where: { orderNumber: parsed.data.orderNumber, claimTokenHash: sha256(parsed.data.claimToken), guestEmail: user.email, userId: null, claimedAt: null, claimExpiresAt: { gt: new Date() } }, select: { id: true } });
  if (!order) return jsonError("Invalid or expired order claim", 400);
  const claimed = await db.order.updateMany({ where: { id: order.id, userId: null, claimedAt: null }, data: { userId: user.id, claimedAt: new Date(), claimTokenHash: null, claimExpiresAt: null } });
  if (claimed.count !== 1) return jsonError("This order has already been claimed", 409);
  await db.auditLog.create({ data: { actorId: user.id, action: "GUEST_ORDER_CLAIMED", entityType: "Order", entityId: order.id } });
  return NextResponse.json({ ok: true, orderId: order.id });
}
