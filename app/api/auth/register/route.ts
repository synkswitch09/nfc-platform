import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { createOpaqueToken, hashPassword, sha256 } from "@/lib/crypto";
import { sendTransactionalEmail } from "@/lib/email";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { getRuntimeConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("register", getClientIp(request), 5, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many attempts. Try again later.", 429);

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid details");
  const exists = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (exists) return jsonError("An account already exists for this email", 409);

  const claimOrder = parsed.data.orderNumber && parsed.data.orderClaimToken
    ? await db.order.findFirst({ where: { orderNumber: parsed.data.orderNumber, claimTokenHash: sha256(parsed.data.orderClaimToken), guestEmail: parsed.data.email, userId: null, claimedAt: null, claimExpiresAt: { gt: new Date() } }, select: { id: true } })
    : null;
  if (parsed.data.orderNumber && !claimOrder) return jsonError("This order claim link is invalid or expired", 400);

  const { password } = parsed.data;
  const details = { name: parsed.data.name, email: parsed.data.email };
  const user = await db.user.create({
    data: { ...details, passwordHash: await hashPassword(password) },
    select: { id: true, name: true, email: true },
  });
  await createSession(user.id);
  const verificationToken = createOpaqueToken();
  await db.emailVerification.create({ data:{userId:user.id,tokenHash:sha256(verificationToken),expiresAt:new Date(Date.now()+24*60*60*1000),orderClaimId:claimOrder?.id} });
  const origin = getRuntimeConfig().appUrl;
  await sendTransactionalEmail({to:user.email,subject:"Verify your Tapkin email",text:`Verify your email: ${origin}/verify-email?token=${verificationToken}`}).catch(() => undefined);
  await db.auditLog.create({ data: { actorId: user.id, action: "USER_REGISTERED", entityType: "User", entityId: user.id } });
  return NextResponse.json({ user }, { status: 201 });
}
