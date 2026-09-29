import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { store } = await requireAdminPageContext();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const { q = "" } = await searchParams;
  const customers = await db.user.findMany({ where: { storeMemberships: { some: { storeId: store.id, role: "CUSTOMER" } }, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}) }, include: { storeMemberships: { where: { storeId: store.id, role: "CUSTOMER" }, select: { createdAt: true }, take: 1 }, orders: { where: { storeId: store.id } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Sales · {store.displayName}</p><h1>Customers</h1><p>Store-specific customer relationships and order history.</p></div></div><form className="admin-filters"><label><Search size={17} /><input name="q" defaultValue={q} placeholder="Search name or email" /></label><button className="button secondary">Search</button></form><section className="admin-panel flush">{customers.length ? <div className="admin-table customer-table"><div className="admin-tr admin-th"><span>Customer</span><span>Joined store</span><span>Orders</span><span>Lifetime value</span><span>Status</span></div>{customers.map(customer => { const paid = customer.orders.filter(order => !["PENDING", "PAYMENT_PENDING", "CANCELLED"].includes(order.status)); return <Link href={`/admin/customers/${customer.id}`} className="admin-tr" key={customer.id}><span><strong>{customer.name}</strong><small>{customer.email}</small></span><span>{(customer.storeMemberships[0]?.createdAt ?? customer.createdAt).toLocaleDateString("en-AU")}</span><span>{customer.orders.length}</span><strong>{money.format(paid.reduce((sum, order) => sum + order.totalCents, 0) / 100)}</strong><span className={`admin-status ${customer.status}`}>{customer.status}</span></Link>; })}</div> : <div className="admin-empty">No customers match this search.</div>}</section></div>;
}
