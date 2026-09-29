import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { logEvent } from "@/lib/logger";
import { getCurrentStorefront } from "@/lib/storefront";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("login", getClientIp(request), 10, 15 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many attempts. Try again later.", 429);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) { logEvent("warn", "auth.login_rejected", { requestId: request.headers.get("x-request-id"), reason: "invalid_input" }); return jsonError("Invalid email or password", 401); }
  const store = await getCurrentStorefront();
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    logEvent("warn", "auth.login_rejected", { requestId: request.headers.get("x-request-id"), reason: "invalid_credentials" }); return jsonError("Invalid email or password", 401);
  }
  await db.storeMembership.upsert({ where: { storeId_userId: { storeId: store.id, userId: user.id } }, create: { storeId: store.id, userId: user.id }, update: {} });
  await createSession(user.id, store);
  logEvent("info", "auth.login_succeeded", { requestId: request.headers.get("x-request-id"), userId: user.id, role: user.role, storeId: store.id, storeSlug: store.slug });
  await db.auditLog.create({ data: { actorId: user.id, storeId: store.id, action: "USER_LOGIN", entityType: "User", entityId: user.id } });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
