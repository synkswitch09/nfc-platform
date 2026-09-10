import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { getRuntimeConfig } from "@/lib/config";

export const SESSION_COOKIE = "nfc_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getRuntimeConfig().appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, status: true, emailVerifiedAt: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeen.getTime() > 15 * 60 * 1000) {
    void db.session.update({ where: { id: session.id }, data: { lastSeen: new Date() } }).catch(() => undefined);
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  return user;
}

export async function requireRole(roles: Array<"STAFF" | "ADMIN">) {
  const user = await requireUser();
  if (!roles.includes(user.role as "STAFF" | "ADMIN")) redirect("/dashboard");
  return user;
}
