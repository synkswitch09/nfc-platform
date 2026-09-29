import Link from "next/link";
import { Activity, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";

export default async function DashboardPage() {
  const [user, store] = await Promise.all([requireUser(), getCurrentStorefront()]);
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  const [tags, orders] = await Promise.all([db.nFCTag.findMany({
    where: { storeId: store.id, ownerId: user.id },
    include: { profile: true, _count: { select: { scans: true } } },
    orderBy: { updatedAt: "desc" },
  }), db.order.findMany({ where: { storeId: store.id, userId: user.id }, include: { items: { take: 1 } }, orderBy: { createdAt: "desc" }, take: 10 })]);
  return <section className="dashboard">
    <div className="dashboard-head"><div><p className="eyebrow">Your {store.displayName} dashboard</p><h1>Hi, {user.name.split(" ")[0]}</h1><p className="muted">Manage your orders and products for this store.</p></div><div className="actions"><Link className="button secondary" href="/dashboard/account">Account</Link>{nfcEnabled && <Link className="button" href="/activate"><Plus size={17} /> Activate tag</Link>}<LogoutButton /></div></div>
    {nfcEnabled && <><h2 style={{fontSize:"1.65rem"}}>My connected products</h2><div className="tag-list">{tags.length ? tags.map(tag => <Link className="tag-row" href={`/dashboard/tags/${tag.id}`} key={tag.id}><div><strong>{tag.profile?.displayName ?? "Unnamed tag"}</strong><p>{tag.productType[0] + tag.productType.slice(1).toLowerCase()} Tag · {tag.publicTagId}</p></div><span className={`status ${tag.status}`}>{tag.status}</span><strong><Activity size={16} /> {tag._count.scans} scans</strong></Link>) : <div className="card"><h3>No connected products yet</h3><p className="muted">When your product arrives, activate it using the separate code in the package.</p><Link className="button" href="/shop">Browse products</Link></div>}</div></>}<h2 style={{fontSize:"1.65rem",marginTop:42}}>Recent orders</h2><div className="tag-list">{orders.map(order => <Link className="tag-row" href={`/dashboard/orders/${order.id}`} key={order.id}><div><strong>{order.orderNumber}</strong><p>{order.items[0]?.productName ?? "Order"} · {order.createdAt.toLocaleDateString("en-AU")}</p></div><span className={`status ${order.status}`}>{order.status.replaceAll("_", " ")}</span><strong>{new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</strong></Link>)}{!orders.length && <div className="card"><p className="muted">Your paid orders will appear here.</p></div>}</div>
  </section>;
}
