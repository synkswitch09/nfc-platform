import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const statuses = ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const validStatus = statuses.find(value => value === status);
  const orders = await db.order.findMany({
    where: { ...(q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { guestEmail: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {}), ...(validStatus ? { status: validStatus } : {}) },
    include: { user: { select: { email: true } }, items: { take: 2 } }, orderBy: { createdAt: "desc" }, take: 200,
  });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Sales</p><h1>Orders</h1><p>Paid purchases, production progress and fulfilment.</p></div></div><form className="admin-filters"><label><Search size={17} /><input name="q" defaultValue={q} placeholder="Order, customer or email" /></label><select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><button className="button secondary">Filter</button></form><section className="admin-panel flush">{orders.length ? <div className="admin-table order-admin-table"><div className="admin-tr admin-th"><span>Order</span><span>Customer</span><span>Items</span><span>Total</span><span>Status</span></div>{orders.map(order => <Link href={`/admin/orders/${order.id}`} className="admin-tr" key={order.id}><span><strong>{order.orderNumber}</strong><small>{order.createdAt.toLocaleString("en-AU")}</small></span><span><strong>{order.customerName ?? "Customer"}</strong><small>{order.user?.email ?? order.guestEmail ?? "—"}</small></span><span>{order.items[0]?.productName ?? "—"}<small>{order.items.length > 1 ? `+ ${order.items.length - 1} more` : order.items[0]?.sku}</small></span><strong>{money.format(order.totalCents / 100)}</strong><span className={`admin-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span></Link>)}</div> : <div className="admin-empty">No orders match this view.</div>}</section></div>;
}
