import { randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentAppEnvironment, getRuntimeConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { createOpaqueToken, privacyHash, sha256 } from "@/lib/crypto";
import { createEmailVerificationCode } from "@/lib/email-verification";
import { sendTransactionalEmail } from "@/lib/email";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseSupportConfig } from "@/lib/support-config";
import { SUPPORT_COOKIE } from "@/lib/support-access";

const start = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()) });
const verify = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront();
  if (!parseSupportConfig(store.accountConfig).guestEnabled) return jsonError("Guest support access is unavailable. Sign in to use Help & requests.", 403);
  const parsed = start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email address", 400);
  for (const [identity, maximum] of [[getClientIp(request), 10], [parsed.data.email, 3]] as const) {
    if (!(await rateLimit("support-access", `${store.id}:${identity}`, maximum, 3600000)).allowed) return jsonError("Too many verification requests. Try again later.", 429);
  }
  const id = randomUUID(), code = createEmailVerificationCode();
  await db.supportAccess.create({ data: { id, storeId: store.id, email: parsed.data.email, codeHash: privacyHash(`support:${store.id}:${id}:${code}`), expiresAt: new Date(Date.now() + 600000) } });
  try {
    const sent = await sendTransactionalEmail({ to: parsed.data.email, storeSlug: store.slug, category: "support", templateKey: "verification", templateFields: { "account.code": code }, subject: `${store.displayName}: verify your support access`, text: `Your support verification code is ${code}. It expires in 10 minutes. This verifies access to tickets for this email, without creating an account. If you did not request it, ignore this message.` });
    if (!sent && (getRuntimeConfig().email.mode !== "mock" || currentAppEnvironment() === "production")) throw new Error("Not accepted");
  } catch {
    await db.supportAccess.update({ where: { id }, data: { expiresAt: new Date(0) } });
    return jsonError("We could not send a verification code. Please try again later.", 503);
  }
  return NextResponse.json({ challengeId: id }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront();
  if (!parseSupportConfig(store.accountConfig).guestEnabled) return jsonError("Guest support access is unavailable", 403);
  if (!(await rateLimit("support-code", `${store.id}:${getClientIp(request)}`, 20, 3600000)).allowed) return jsonError("Too many attempts", 429);
  const parsed = verify.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid or expired verification code", 400);
  const token = createOpaqueToken();
  const accepted = await db.$transaction(async tx => {
    const claimed = await tx.supportAccess.updateMany({ where: { id: parsed.data.challengeId, storeId: store.id, verifiedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    if (!claimed.count) return false;
    const record = await tx.supportAccess.findUniqueOrThrow({ where: { id: parsed.data.challengeId } });
    const candidate = Buffer.from(privacyHash(`support:${store.id}:${record.id}:${parsed.data.code}`));
    const expected = Buffer.from(record.codeHash);
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return false;
    await tx.supportAccess.update({ where: { id: record.id }, data: { verifiedAt: new Date(), sessionHash: sha256(token), sessionExpiresAt: new Date(Date.now() + 86400000) } });
    return true;
  });
  if (!accepted) return jsonError("Invalid or expired verification code", 400);
  (await cookies()).set(SUPPORT_COOKIE, token, { httpOnly: true, secure: store.origin.startsWith("https://"), sameSite: "strict", path: "/", maxAge: 86400 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront(), jar = await cookies(), token = jar.get(SUPPORT_COOKIE)?.value;
  if (token) await db.supportAccess.updateMany({ where: { storeId: store.id, sessionHash: sha256(token) }, data: { sessionHash: null, sessionExpiresAt: null } });
  jar.set(SUPPORT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
