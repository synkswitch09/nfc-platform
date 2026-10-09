export const permissions = ["catalog.read","catalog.write","content.read","content.write","content.publish","orders.read","orders.write","orders.cancel","orders.address","production.read","production.write","production.shared","shipping.read","shipping.write","support.read","support.write","customers.read","customers.export","finance.read","finance.refund","settings.read","settings.write","integrations.manage","audit.read"] as const;
export type Permission = typeof permissions[number];
export const operationsRoles = ["STORE_ADMIN","CATALOG","PRODUCTION","SHIPPING","SUPPORT","CONTENT","FINANCE","READ_ONLY"] as const;
export type OperationsRole = typeof operationsRoles[number];
export const roleLabels: Record<OperationsRole,string> = { STORE_ADMIN:"Store administrator", CATALOG:"Catalog & inventory", PRODUCTION:"Production", SHIPPING:"Dispatch & shipping", SUPPORT:"Customer support", CONTENT:"Content & marketing", FINANCE:"Finance", READ_ONLY:"Read only" };
const rolePermissions: Record<OperationsRole, Permission[]> = {
 STORE_ADMIN: permissions.filter(p=>!["finance.refund","orders.cancel","orders.address","production.shared","integrations.manage","customers.export"].includes(p)),
 CATALOG:["catalog.read","catalog.write"], PRODUCTION:["production.read","production.write"], SHIPPING:["orders.read","shipping.read","shipping.write"], SUPPORT:["orders.read","support.read","support.write","customers.read"], CONTENT:["catalog.read","content.read","content.write","content.publish"], FINANCE:["orders.read","finance.read"], READ_ONLY:permissions.filter(p=>p.endsWith(".read")),
};
export function effectivePermissions(roles: string[], extras: string[] = [], legacy?: string): Permission[] {
 const valid=roles.filter((r):r is OperationsRole=>operationsRoles.includes(r as OperationsRole));
 const set=new Set<Permission>(valid.flatMap(r=>rolePermissions[r]));
 // Existing store administrators retain operation access; platform admins bypass this map.
 if (!roles.length && legacy === "ADMIN") rolePermissions.STORE_ADMIN.forEach(p=>set.add(p));
 if (!roles.length && legacy === "STAFF") rolePermissions.SUPPORT.forEach(p=>set.add(p));
 extras.filter((p):p is Permission=>permissions.includes(p as Permission)).forEach(p=>set.add(p));
 if(valid.includes("READ_ONLY")) return [...set].filter(p=>p.endsWith(".read"));
 return [...set];
}
export function permissionForRoute(path: string, method="GET"): Permission | "platform" | null {
 const read=["GET","HEAD","OPTIONS"].includes(method); const route=path.replace(/^\/api\/admin/,"/admin");
 if (route==="/admin") return null;
 if (/^\/admin\/(stores|settings\/reset|store-reset)(\/|$)/.test(route)) return "platform";
 if (/^\/admin\/team(\/|$)/.test(route)) return "platform";
 if (/^\/admin\/production(\/|$)/.test(route)) return "production.shared";
 if (/^\/admin\/audit(\/|$)/.test(route)) return "audit.read";
 if (/^\/admin\/shipping\/(providers|print-agents)(\/|$)/.test(route)) return "integrations.manage";
 if (/^\/admin\/etsy(\/|$)/.test(route)) return "integrations.manage";
 if (/^\/admin\/orders\/.+\/(keychain|items)(\/|$)/.test(route)) return read?"production.read":"production.write";
 if (/^\/admin\/orders\/.+\/(shipment|shippit)(\/|$)/.test(route)) return read?"shipping.read":"shipping.write";
 if (/^\/admin\/customers\/export$/.test(route)) return "customers.export";
 if (/^\/admin\/orders\/.+\/address$/.test(route)) return "orders.address";
 if (/^\/admin\/orders\/.+\/operations$/.test(route)) return "orders.read"; // Action-level checks handle refunds and resends.
 const group = route.split("/")[2];
 if(!read && ["storefront","pages","storefront-releases","link-targets"].includes(group)) return "content.publish";
 const resource=({products:"catalog",categories:"catalog",inventory:"catalog",manufacturing:"production",tags:"production",orders:"orders",support:"support",customers:"customers",promotions:"content",storefront:"content",pages:"content",media:"content","email-templates":"content",shipping:"shipping",shipments:"shipping",settings:"settings","account-settings":"settings","storefront-releases":"content","link-targets":"content"} as Record<string,string>)[group];
 return resource?`${resource}.${read?"read":"write"}` as Permission:"platform";
}
export function hasPermission(context: {isPlatformAdmin:boolean;permissions?:string[]} | null, permission: Permission) { return Boolean(context && (context.isPlatformAdmin || context.permissions?.includes(permission))); }
