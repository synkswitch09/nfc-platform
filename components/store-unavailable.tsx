import Link from "next/link";
import type { Storefront } from "@/lib/storefront";

export function StoreUnavailable({ store }: { store: Pick<Storefront, "displayName" | "supportEmail"> }) {
  return <section className="section compact-section"><div className="section-head"><span className="eyebrow">Store update</span><h1 className="page-title">{store.displayName} is not taking new orders.</h1><p className="lead">Existing customers can still sign in and manage previous purchases and connected services.</p><div className="actions"><Link className="button" href="/login">Sign in</Link><Link className="button secondary" href="/dashboard/help">Open a support ticket</Link></div></div></section>;
}
