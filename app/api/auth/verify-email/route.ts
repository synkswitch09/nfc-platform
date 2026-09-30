import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { completeEmailVerification, emailVerificationCodeHash } from "@/lib/email-verification";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStorefront } from "@/lib/storefront";

export async function GET(request: NextRequest) {
  const store = await getCurrentStorefront();
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?verified=invalid", store.origin));
  const record = await db.emailVerification.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!record || record.storeId !== store.id || record.usedAt || record.expiresAt <= new Date()) return NextResponse.redirect(new URL("/login?verified=invalid", store.origin));

  const result = await completeEmailVerification(record);
  return NextResponse.redirect(new URL(result.verified ? result.destination : "/login?verified=invalid", store.origin));
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getSessionUser();
  if (!user) return jsonError("Sign in to verify your email", 401);
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true, destination: "/dashboard" });
  const store = await getCurrentStorefront();
  const code = (await request.json().catch(() => null))?.code;
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return jsonError("Enter the six-digit code");
  const limited = await rateLimit("email-verification-user", `${store.id}:${user.id}`, 5, 15 * 60_000);
  if (!limited.allowed) return jsonError("Too many attempts. Try again in 15 minutes.", 429);
  const record = await db.emailVerification.findFirst({
    where: { userId: user.id, storeId: store.id, tokenHash: emailVerificationCodeHash(user.id, store.id, code), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!record) return jsonError("The code is invalid or has expired", 400);
  const result = await completeEmailVerification(record);
  if (!result.verified) return jsonError("The code is invalid or has expired", 400);
  return NextResponse.json(result);
}
