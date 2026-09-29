import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, PackageCheck, ScanLine, ShoppingBag, Tags, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";
import { hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";

export default async function AdminPage() {
  const { store } = await requireAdminPageContext();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency, maximumFractionDigits: 0 });
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last30 = new Date(now.getTime() - 30 * 86_400_000);
  const [revenueToday, revenue30, waiting, processing, lowStock, products, customers, activeTags, unclaimedTags, batches, scansToday, scans30, recentOrders, recentActivations] = await Promise.all([
    db.payment.aggregate({ where: { order: { storeId: store.id }, status: "SUCCEEDED", updatedAt: { gte: today } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { order: { storeId: store.id }, status: "SUCCEEDED", updatedAt: { gte: last30 } }, _sum: { amountCents: true } }),
    db.order.count({ where: { storeId: store.id, status: "PAID" } }),
    db.order.count({ where: { storeId: store.id, status: { in: ["PROCESSING", "READY_TO_SHIP"] } } }),
    db.productVariant.count({ where: { product: { storeId: store.id }, active: true, trackInventory: true, inventory: { lte: 5 } } }),
    db.product.count({ where: { storeId: store.id, status: "ACTIVE" } }),
    db.storeMembership.count({ where: { storeId: store.id, role: "CUSTOMER" } }),
    nfcEnabled ? db.nFCTag.count({ where: { storeId: store.id, status: "ACTIVE" } }) : Promise.resolve(0),
    nfcEnabled ? db.nFCTag.count({ where: { storeId: store.id, status: "UNCLAIMED" } }) : Promise.resolve(0),
    nfcEnabled ? db.manufacturingBatch.count({ where: { storeId: store.id, status: { not: "SOLD" } } }) : Promise.resolve(0),
    nfcEnabled ? db.scanEvent.count({ where: { tag: { storeId: store.id }, scannedAt: { gte: today } } }) : Promise.resolve(0),
    nfcEnabled ? db.scanEvent.count({ where: { tag: { storeId: store.id }, scannedAt: { gte: last30 } } }) : Promise.resolve(0),
    db.order.findMany({ where: { storeId: store.id }, take: 6, orderBy: { createdAt: "desc" }, include: { items: { take: 1 } } }),
    nfcEnabled ? db.tagActivation.findMany({ where: { tag: { storeId: store.id }, success: true }, take: 6, orderBy: { attemptedAt: "desc" }, include: { tag: { include: { product: { select: { name: true } }, owner: { select: { name: true } } } } } }) : Promise.resolve([]),
  ]);
  const metrics = [
    { label: "Revenue today", value: money.format((revenueToday._sum.amountCents ?? 0) / 100), icon: ShoppingBag },
    { label: "Revenue · 30 days", value: money.format((revenue30._sum.amountCents ?? 0) / 100), icon: PackageCheck },
    { label: "Orders waiting", value: waiting, icon: AlertTriangle },
    { label: "In production", value: processing, icon: Boxes },
    { label: "Low stock", value: lowStock, icon: AlertTriangle },
    { label: "Active products", value: products, icon: PackageCheck },
    { label: "Customers", value: customers, icon: Users },
    ...(nfcEnabled ? [{ label: "Active / unclaimed tags", value: `${activeTags} / ${unclaimedTags}`, icon: Tags }, { label: "Open NFC batches", value: batches, icon: ScanLine }, { label: "Scans today / 30 days", value: `${scansToday} / ${scans30}`, icon: ScanLine }] : []),
  ];
  return <div><div className="admin-heading"><div><p className="admin-kicker">{store.displayName} overview</p><h1>Good evening.</h1><p>Orders, stock and production at a glance.</p></div><div className="admin-actions">{nfcEnabled && <Link className="button secondary" href="/admin/manufacturing/batches">Create NFC batch</Link>}<Link className="button" href="/admin/products/new">Add product</Link></div></div><div className="metric-grid">{metrics.map(({ label, value, icon: Icon }) => <article className="metric-card" key={label}><span><Icon size={18} /></span><strong>{value}</strong><p>{label}</p></article>)}</div><section className="admin-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Newest purchases requiring attention.</p></div><Link href="/admin/orders">View all <ArrowRight size={16} /></Link></div>{recentOrders.length ? <div className="admin-table"><div className="admin-tr admin-th"><span>Order</span><span>Customer</span><span>Item</span><span>Total</span><span>Status</span></div>{recentOrders.map(order => <Link href={`/admin/orders/${order.id}`} className="admin-tr" key={order.id}><strong>{order.orderNumber}</strong><span>{order.customerName ?? order.guestEmail ?? "Customer"}</span><span>{order.items[0]?.productName ?? "—"}</span><span>{money.format(order.totalCents / 100)}</span><span className={`admin-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span></Link>)}</div> : <div className="admin-empty">No orders yet. New purchases will appear here.</div>}</section>{nfcEnabled && <section className="admin-panel"><div className="panel-heading"><div><h2>Recent activations</h2><p>Latest successfully claimed NFC units.</p></div><Link href="/admin/tags">View tags <ArrowRight size={16} /></Link></div><div className="compact-list">{recentActivations.map(activation => <Link href={`/admin/tags/${activation.tag.id}`} key={activation.id}><span><strong>{activation.tag.product.name}</strong><small>{activation.tag.publicTagId} · {activation.tag.owner?.name ?? "Customer"}</small></span><span>{activation.attemptedAt.toLocaleString("en-AU")}</span></Link>)}</div>{!recentActivations.length && <div className="admin-empty">No successful activations yet.</div>}</section>}</div>;
}
