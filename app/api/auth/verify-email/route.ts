import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?verified=invalid", request.url));
  const record = await db.emailVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return NextResponse.redirect(new URL("/login?verified=invalid", request.url));

  let claimedOrderId: string | null = null;
  await db.$transaction(async tx => {
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    if (record.orderClaimId) {
      const order = await tx.order.findFirst({ where: { id: record.orderClaimId, userId: null, claimedAt: null, guestEmail: record.user.email, claimExpiresAt: { gt: new Date() } } });
      if (order) {
        const claimed = await tx.order.updateMany({ where: { id: order.id, userId: null, claimedAt: null }, data: { userId: record.userId, claimedAt: new Date(), claimTokenHash: null, claimExpiresAt: null } });
        if (claimed.count === 1) {
          claimedOrderId = order.id;
          await tx.auditLog.create({ data: { actorId: record.userId, action: "GUEST_ORDER_CLAIMED", entityType: "Order", entityId: order.id } });
        }
      }
    }
  });
  const destination = claimedOrderId ? `/dashboard/orders/${claimedOrderId}?claimed=true` : "/dashboard?verified=true";
  return NextResponse.redirect(new URL(destination, request.url));
}
