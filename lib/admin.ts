import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

export async function getAdminApiUser() {
  const user = await getCurrentUser();
  return user && ["STAFF", "ADMIN"].includes(user.role) ? user : null;
}

export async function getAdminApiContext() {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStorefront()]);
  if (!user || !["STAFF", "ADMIN"].includes(user.role)) return null;
  if (user.role !== "ADMIN") {
    const membership = await db.storeMembership.findUnique({ where: { storeId_userId: { storeId: store.id, userId: user.id } }, select: { role: true } });
    if (!membership || !["STAFF", "ADMIN"].includes(membership.role)) return null;
  }
  return { user, store };
}
