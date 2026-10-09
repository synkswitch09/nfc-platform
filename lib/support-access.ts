import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { Storefront } from "@/lib/storefront";
import { parseSupportConfig } from "@/lib/support-config";

export const SUPPORT_COOKIE = "support_access";
export type SupportIdentity = { email: string; name: string | null; userId: string | null };
export async function supportIdentity(store: Storefront): Promise<SupportIdentity | null> {
  const user = await getCurrentUser();
  if (user) return { email: user.email, name: user.name, userId: user.id };
  if (!parseSupportConfig(store.accountConfig).guestEnabled) return null;
  const token = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (!token) return null;
  const access = await db.supportAccess.findFirst({ where: { storeId: store.id, sessionHash: sha256(token), verifiedAt: { not: null }, sessionExpiresAt: { gt: new Date() } }, select: { email: true } });
  return access ? { email: access.email, name: null, userId: null } : null;
}
export function ticketOwner(identity: SupportIdentity): Prisma.OrderSupportRequestWhereInput {
  return { OR: [ ...(identity.userId ? [{ customerUserId: identity.userId }, { order: { userId: identity.userId } }] : []), { customerEmail: { equals: identity.email, mode: "insensitive" } }] };
}
export function supportOrderOwner(identity: SupportIdentity): Prisma.OrderWhereInput {
  return { OR: [ ...(identity.userId ? [{ userId: identity.userId }] : []), { guestEmail: { equals: identity.email, mode: "insensitive" } }, { user: { email: { equals: identity.email, mode: "insensitive" } } }] };
}
export async function lockSupportOrder(tx: Prisma.TransactionClient, orderId: string, storeId: string) {
  // Shared lock for ticket admission, starting work, packing and carrier booking.
  // A concurrent request wins either before work begins or after; no check/use gap.
  await tx.order.update({ where: { id: orderId, storeId }, data: { updatedAt: new Date() }, select: { id: true } });
}
export async function assertNoSupportHold(tx: Prisma.TransactionClient, orderId: string, storeId: string) {
  await lockSupportOrder(tx, orderId, storeId);
  if (await tx.orderSupportRequest.count({ where: { orderId, storeId, holdActive: true } })) throw new Error("SUPPORT_HOLD");
}
