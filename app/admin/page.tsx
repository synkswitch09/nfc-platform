import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, PackageCheck, ScanLine, ShoppingBag, Tags, Users } from "lucide-react";
import { db } from "@/lib/db";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export default async function AdminPage() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last30 = new Date(now.getTime() - 30 * 86_400_000);
  const [revenueToday, revenue30, waiting, processing, lowStock, products, customers, activeTags, unclaimedTags, batches, recentOrders] = await Promise.all([
    db.payment.aggregate({ where: { status: "SUCCEEDED", updatedAt: { gte: today } }, _sum: { amountCents: true } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", updatedAt: { gte: last30 } }, _sum: { amountCents: true } }),
    db.order.count({ where: { status: "PAID" } }),
    db.order.count({ where: { status: { in: ["PROCESSING", "READY_TO_SHIP"] } } }),
    db.productVariant.count({ where: { active: true, trackInventory: true, inventory: { lte: 5 } } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.nFCTag.count({ where: { status: "ACTIVE" } }),
    db.nFCTag.count({ where: { status: "UNCLAIMED" } }),
    db.manufacturingBatch.count({ where: { status: { not: "SOLD" } } }),
    db.order.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { items: { take: 1 } } }),
  ]);
  const metrics = [
    { label: "Revenue today", value: money.format((revenueToday._sum.amountCents ?? 0) / 100), icon: ShoppingBag },
    { label: "Revenue · 30 days", value: money.format((revenue30._sum.amountCents ?? 0) / 100), icon: PackageCheck },
    { label: "Orders waiting", value: waiting, icon: AlertTriangle },
    { label: "In production", value: processing, icon: Boxes },
    { label: "Low stock", value: lowStock, icon: AlertTriangle },
    { label: "Active products", value: products, icon: PackageCheck },
    { label: "Customers", value: customers, icon: Users },
    { label: "Active / unclaimed tags", value: `${activeTags} / ${unclaimedTags}`, icon: Tags },
    { label: "Open NFC batches", value: batches, icon: ScanLine },
  ];
  return <div><div className="admin-heading"><div><p className="admin-kicker">Business overview</p><h1>Good evening.</h1><p>Orders, stock and NFC production at a glance.</p></div><div className="admin-actions"><Link className="button secondary" href="/admin/manufacturing/batches">Create NFC batch</Link><Link className="button" href="/admin/products/new">Add product</Link></div></div><div className="metric-grid">{metrics.map(({ label, value, icon: Icon }) => <article className="metric-card" key={label}><span><Icon size={18} /></span><strong>{value}</strong><p>{label}</p></article>)}</div><section className="admin-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Newest purchases requiring attention.</p></div><Link href="/admin/orders">View all <ArrowRight size={16} /></Link></div>{recentOrders.length ? <div className="admin-table"><div className="admin-tr admin-th"><span>Order</span><span>Customer</span><span>Item</span><span>Total</span><span>Status</span></div>{recentOrders.map(order => <Link href={`/admin/orders/${order.id}`} className="admin-tr" key={order.id}><strong>{order.orderNumber}</strong><span>{order.customerName ?? order.guestEmail ?? "Customer"}</span><span>{order.items[0]?.productName ?? "—"}</span><span>{money.format(order.totalCents / 100)}</span><span className={`admin-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span></Link>)}</div> : <div className="admin-empty">No orders yet. New purchases will appear here.</div>}</section></div>;
}
