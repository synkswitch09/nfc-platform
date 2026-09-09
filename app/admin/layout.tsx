import Link from "next/link";
import type { Metadata } from "next";
import { Archive, Boxes, ClipboardList, Factory, FileClock, Gauge, PackageSearch, ScanLine, Settings, ShieldCheck, Tags, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

const groups = [
  { label: "Overview", links: [{ href: "/admin", label: "Dashboard", icon: Gauge }] },
  { label: "Catalog", links: [{ href: "/admin/products", label: "Products", icon: PackageSearch }, { href: "/admin/inventory", label: "Inventory", icon: Boxes }] },
  { label: "Sales", links: [{ href: "/admin/orders", label: "Orders", icon: ClipboardList }, { href: "/admin/customers", label: "Customers", icon: Users }] },
  { label: "NFC", links: [{ href: "/admin/tags", label: "Tags", icon: Tags }, { href: "/admin/manufacturing", label: "Manufacturing", icon: Factory }, { href: "/admin/manufacturing/batches", label: "Production batches", icon: ScanLine }] },
  { label: "Content", links: [{ href: "/admin/categories", label: "Categories & landings", icon: Archive }] },
  { label: "System", links: [{ href: "/admin/team", label: "Team access", icon: ShieldCheck }, { href: "/admin/audit", label: "Audit log", icon: FileClock }, { href: "/admin/settings", label: "Settings", icon: Settings }] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["STAFF", "ADMIN"]);
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand"><span>TK</span><div>Tapkin<small>Operations</small></div></Link>{groups.map(group => <div className="admin-nav-group" key={group.label}><p>{group.label}</p>{group.links.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label}</Link>)}</div>)}<Link href="/" className="admin-store-link">← View storefront</Link></aside><main className="admin-main">{children}</main></div>;
}
