import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmailVerificationCode } from "@/lib/email-verification";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStorefront } from "@/lib/storefront";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getSessionUser();
  if (!user) return jsonError("Sign in to request a new code", 401);
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true });
  const store = await getCurrentStorefront();
  const current = await db.emailVerification.findFirst({
    where: { userId: user.id, storeId: store.id, usedAt: null }, orderBy: { createdAt: "desc" },
  });
  if (current && Date.now() - current.createdAt.getTime() < 60_000) return jsonError("Wait one minute before requesting another code", 429);
  const limited = await rateLimit("email-resend-user", `${store.id}:${user.id}`, 3, 60 * 60_000);
  if (!limited.allowed) return jsonError("Too many requests. Try again in one hour.", 429);
  const sent = await sendEmailVerificationCode(user, store, current?.orderClaimId);
  if (!sent) return jsonError("We couldn't send the code. Please try again shortly.", 503);
  return NextResponse.json({ sent: true });
}
