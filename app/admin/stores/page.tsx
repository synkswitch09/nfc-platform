import { ExternalLink, Settings2 } from "lucide-react";
import { getAccessibleAdminStores, requireAdminPageContext } from "@/lib/admin";
import { notFound } from "next/navigation";
import { currentAppEnvironment } from "@/lib/config";
import { CreateStoreForm } from "@/components/create-store-form";
import "./stores.css";

export default async function AdminStoresPage() {
  const { user, isPlatformAdmin } = await requireAdminPageContext();
  if (!isPlatformAdmin) notFound();
  const stores = await getAccessibleAdminStores(user);
  return <div>
    <div className="admin-heading"><div><p className="admin-kicker">Platform</p><h1>Stores</h1><p>Trusted storefronts and their environment-specific administration consoles.</p></div></div>
    <section className="admin-panel flush">
      <div className="admin-table store-table"><div className="admin-tr admin-th"><span>Store</span><span>Domain</span><span>Capabilities</span><span>Status</span><span>Manage</span></div>
        {stores.map(store => <div className="admin-tr" key={store.id}><span><strong>{store.displayName}</strong><small>{store.slug}</small></span><span><a className="text-link" href={store.origin}>{store.origin} <ExternalLink size={13} /></a></span><span><small>{store.capabilities.join(" · ") || "No modules"}</small></span><span className={`admin-status ${store.status}`}>{store.status}</span><span><a className="text-link" href={`${store.origin}/admin/settings`}><Settings2 size={15} /> Configure</a></span></div>)}
      </div>
    </section>
    <CreateStoreForm environment={currentAppEnvironment()} />
    <p className="muted admin-note">Only platform administrators can create stores. The domain becomes trusted in this environment after creation, but requires DNS and a verified Azure custom domain before it is reachable.</p>
  </div>;
}
