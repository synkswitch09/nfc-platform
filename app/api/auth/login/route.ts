import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("login", getClientIp(request), 10, 15 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many attempts. Try again later.", 429);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid email or password", 401);
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return jsonError("Invalid email or password", 401);
  }
  await createSession(user.id);
  await db.auditLog.create({ data: { actorId: user.id, action: "USER_LOGIN", entityType: "User", entityId: user.id } });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
