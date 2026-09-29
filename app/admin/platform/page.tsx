import { notFound } from "next/navigation";
import { Building2, CircleDollarSign, PackageCheck, ShoppingBag, Users } from "lucide-react";
import { requireAdminPageContext } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function PlatformAdminPage() {
  const { isPlatformAdmin } = await requireAdminPageContext();
  if (!isPlatformAdmin) notFound();
  const [stores, orders, products, customers] = await Promise.all([
    db.store.findMany({ select: { id: true, displayName: true, status: true, currency: true }, orderBy: { displayName: "asc" } }),
    db.order.groupBy({ by: ["storeId"], where: { payments: { some: { status: "SUCCEEDED" } } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.product.groupBy({ by: ["storeId"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    db.storeMembership.groupBy({ by: ["storeId"], where: { role: "CUSTOMER" }, _count: { _all: true } }),
  ]);
  const orderMap = new Map(orders.map(row => [row.storeId, row]));
  const productMap = new Map(products.map(row => [row.storeId, row._count._all]));
  const customerMap = new Map(customers.map(row => [row.storeId, row._count._all]));
  const currencies = new Set(stores.map(store => store.currency));
  const totalRevenue = currencies.size === 1 ? orders.reduce((sum, row) => sum + (row._sum.totalCents ?? 0), 0) : null;
  const totalOrders = orders.reduce((sum, row) => sum + row._count._all, 0);
  const formatMoney = (value: number, currency: string) => new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);
  return <div>
    <div className="admin-heading"><div><p className="admin-kicker">All stores</p><h1>Platform overview</h1><p>Read-only commerce totals across the shared platform.</p></div></div>
    <div className="metric-grid"><article className="metric-card"><span><Building2 size={18} /></span><strong>{stores.length}</strong><p>Stores</p></article><article className="metric-card"><span><CircleDollarSign size={18} /></span><strong>{totalRevenue === null ? "Mixed currencies" : formatMoney(totalRevenue, stores[0]?.currency ?? "AUD")}</strong><p>Revenue</p></article><article className="metric-card"><span><ShoppingBag size={18} /></span><strong>{totalOrders}</strong><p>Paid orders</p></article></div>
    <section className="admin-panel flush"><div className="admin-table platform-table"><div className="admin-tr admin-th"><span>Store</span><span>Revenue</span><span>Orders</span><span>Products</span><span>Customers</span></div>{stores.map(store => { const storeOrders = orderMap.get(store.id); return <div className="admin-tr" key={store.id}><span><strong>{store.displayName}</strong><small>{store.status}</small></span><span>{formatMoney(storeOrders?._sum.totalCents ?? 0, store.currency)}</span><span><ShoppingBag size={14} /> {storeOrders?._count._all ?? 0}</span><span><PackageCheck size={14} /> {productMap.get(store.id) ?? 0}</span><span><Users size={14} /> {customerMap.get(store.id) ?? 0}</span></div>; })}</div></section>
  </div>;
}
