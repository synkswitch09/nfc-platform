import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Layers3 } from "lucide-react";
import type { Storefront } from "@/lib/storefront";

type AdminStore = {
  id: string;
  displayName: string;
  status: string;
  origin: string;
};

export function AdminStoreSwitcher({ current, stores, platformAdmin }: { current: Storefront; stores: AdminStore[]; platformAdmin: boolean }) {
  return <details className="admin-store-switcher">
    <summary><span><small>STORE</small><strong>{current.displayName}</strong></span><ChevronsUpDown size={16} aria-hidden="true" /></summary>
    <div className="admin-store-menu">
      {platformAdmin && <Link href="/admin/platform"><Layers3 size={16} /><span><strong>All stores</strong><small>Platform overview</small></span></Link>}
      {stores.map(store => <a href={`${store.origin}/admin`} key={store.id}><Building2 size={16} /><span><strong>{store.displayName}</strong><small>{store.status.toLowerCase()}</small></span>{store.id === current.id && <Check size={15} aria-label="Current store" />}</a>)}
    </div>
  </details>;
}
