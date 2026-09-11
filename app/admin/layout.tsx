import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Archive, Boxes, Building2, ClipboardList, Factory, FileClock, Gauge, PackageSearch, ScanLine, Settings, ShieldCheck, Tags, Truck, Users } from "lucide-react";
import { canManageStore, getAccessibleAdminStores, requireAdminPageContext } from "@/lib/admin";
import { getRuntimeConfig } from "@/lib/config";
import { hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";
import { AdminStoreSwitcher } from "@/components/admin-store-switcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

const groups = [
  { label: "Overview", links: [{ href: "/admin", label: "Dashboard", icon: Gauge }] },
  { label: "Catalog", links: [{ href: "/admin/products", label: "Products", icon: PackageSearch }, { href: "/admin/inventory", label: "Inventory", icon: Boxes }] },
  { label: "Sales", links: [{ href: "/admin/orders", label: "Orders", icon: ClipboardList }, { href: "/admin/shipping", label: "Shipping", icon: Truck }, { href: "/admin/customers", label: "Customers", icon: Users }] },
  { label: "Manufacturing", links: [{ href: "/admin/manufacturing", label: "Production queue", icon: Factory }] },
  { label: "NFC", links: [{ href: "/admin/tags", label: "Tags", icon: Tags }, { href: "/admin/manufacturing/batches", label: "NFC production batches", icon: ScanLine }] },
  { label: "Content", links: [{ href: "/admin/categories", label: "Categories & landings", icon: Archive }] },
  { label: "System", links: [{ href: "/admin/settings", label: "Store settings", icon: Settings }] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAdminPageContext();
  const { user, store, isPlatformAdmin } = context;
  const environment = getRuntimeConfig().appEnv;
  const stores = await getAccessibleAdminStores(user);
  const visibleGroups = groups
    .filter(group => group.label !== "NFC" || hasStoreCapability(store, StoreCapability.NFC))
    .filter(group => group.label !== "Manufacturing" || hasStoreCapability(store, StoreCapability.PRINT_3D))
    .map(group => group.label === "System" && isPlatformAdmin ? { ...group, links: [{ href: "/admin/stores", label: "Stores", icon: Building2 }, ...group.links, { href: "/admin/team", label: "Team access", icon: ShieldCheck }, { href: "/admin/audit", label: "Audit log", icon: FileClock }] } : group)
    .filter(group => group.label !== "System" || canManageStore(context));
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand">{store.logoUrl ? <Image className="admin-brand-logo" src={store.logoUrl} alt="" width={150} height={44} unoptimized /> : <span>{store.displayName.slice(0, 2).toUpperCase()}</span>}<div>{store.displayName}<small>Operations</small></div></Link><AdminStoreSwitcher current={store} stores={stores} platformAdmin={isPlatformAdmin} />{visibleGroups.map(group => <div className="admin-nav-group" key={group.label}><p>{group.label}</p>{group.links.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label}</Link>)}</div>)}<Link href="/" className="admin-store-link">← View storefront</Link></aside><main className="admin-main">{environment !== "production" && <div className={`environment-banner ${environment}`} role="status">{environment.toUpperCase()} ENVIRONMENT · STORE: {store.displayName.toUpperCase()}</div>}{children}</main></div>;
}
