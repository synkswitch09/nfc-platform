import { headers } from "next/headers";
import { effectivePermissions, permissionForRoute, type Permission } from "@/lib/admin-permissions";
export { hasPermission } from "@/lib/admin-permissions";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentAppEnvironment } from "@/lib/config";
import { deploymentEnvironment, getCurrentStorefront } from "@/lib/storefront";
import { redirect } from "next/navigation";

export async function getAdminApiUser() {
  return (await getAdminApiContext())?.user ?? null;
}

export async function getAdminApiContext(explicitPermission?:Permission) {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStorefront()]);
  if (!user || !["STAFF", "ADMIN"].includes(user.role)) return null;
  const membership = await db.storeMembership.findUnique({ where: { storeId_userId: { storeId: store.id, userId: user.id } }, select: { role: true, operationsRoles:true, permissions:true, operationsEnabled:true } });
  if (user.role !== "ADMIN" && (!membership?.operationsEnabled || !["STAFF", "ADMIN"].includes(membership.role))) return null;
  const granted=effectivePermissions(membership?.operationsRoles ?? [],membership?.permissions ?? [], membership?.role);
  const requestHeaders=await headers(); const path=requestHeaders.get("x-admin-path") ?? "/admin";
  const required=explicitPermission ?? (path.startsWith("/admin") || path.startsWith("/api/admin") ? permissionForRoute(path,requestHeaders.get("x-admin-method") ?? "GET") : null);
  if(user.role!=="ADMIN" && required && (required==="platform" || !granted.includes(required))) return null;
  return { user, store, permissions:granted, storeRole: user.role === "ADMIN" ? "ADMIN" as const : membership!.role, isPlatformAdmin: user.role === "ADMIN" };
}

export async function requireAdminPageContext() {
  const context = await getAdminApiContext();
  if (!context) redirect("/dashboard");
  return context;
}

export function canManageStore(context: Awaited<ReturnType<typeof getAdminApiContext>>) {
  return Boolean(context && (context.isPlatformAdmin || context.storeRole === "ADMIN" || context.permissions.some(p=>p.endsWith(".write") || p==="content.publish")));
}

export async function getAccessibleAdminStores(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const environment = deploymentEnvironment(currentAppEnvironment());
  const stores = await db.store.findMany({
    where: user.role === "ADMIN" ? {} : { memberships: { some: { userId: user.id, operationsEnabled:true, role: { in: ["STAFF", "ADMIN"] } } } },
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
    return domain ? [{ ...store, origin: `${domain.protocol}://${domain.hostname}${domain.port ? `:${domain.port}` : ""}` }] : [];
  });
}
