import { db } from "@/lib/db";
import { privacyHash } from "@/lib/crypto";

export async function rateLimit(action: string, identity: string, limit: number, windowMs: number) {
  const keyHash = privacyHash(identity);
  const since = new Date(Date.now() - windowMs);
  const count = await db.securityEvent.count({ where: { action, keyHash, createdAt: { gte: since } } });
  if (count >= limit) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  await db.securityEvent.create({ data: { action, keyHash } });
  return { allowed: true, retryAfterSeconds: 0 };
}
