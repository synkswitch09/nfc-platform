import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentAppEnvironment } from "@/lib/config";
import { deploymentEnvironment, getCurrentStorefront } from "@/lib/storefront";
import { redirect } from "next/navigation";

export async function getAdminApiUser() {
  const user = await getCurrentUser();
  return user && ["STAFF", "ADMIN"].includes(user.role) ? user : null;
}

export async function getAdminApiContext() {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStorefront()]);
  if (!user || !["STAFF", "ADMIN"].includes(user.role)) return null;
  const membership = await db.storeMembership.findUnique({ where: { storeId_userId: { storeId: store.id, userId: user.id } }, select: { role: true } });
  if (user.role !== "ADMIN" && (!membership || !["STAFF", "ADMIN"].includes(membership.role))) return null;
  return { user, store, storeRole: user.role === "ADMIN" ? "ADMIN" as const : membership!.role, isPlatformAdmin: user.role === "ADMIN" };
}

export async function requireAdminPageContext() {
  const context = await getAdminApiContext();
  if (!context) redirect("/dashboard");
  return context;
}

export function canManageStore(context: Awaited<ReturnType<typeof getAdminApiContext>>) {
  return Boolean(context && (context.isPlatformAdmin || context.storeRole === "ADMIN"));
}

export async function getAccessibleAdminStores(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const environment = deploymentEnvironment(currentAppEnvironment());
  const stores = await db.store.findMany({
    where: user.role === "ADMIN" ? {} : { memberships: { some: { userId: user.id, role: { in: ["STAFF", "ADMIN"] } } } },
    select: {
      id: true,
      slug: true,
      displayName: true,
      status: true,
      capabilities: true,
      domains: { where: { environment }, orderBy: [{ isPrimary: "desc" }, { hostname: "asc" }], take: 1 },
    },
    orderBy: { displayName: "asc" },
  });
  return stores.flatMap(store => {
    const domain = store.domains[0];
    return domain ? [{ ...store, origin: `${domain.protocol}://${domain.hostname}` }] : [];
  });
}
