import Link from "next/link";
import { InventoryAdjuster } from "@/components/inventory-adjuster";
import { db } from "@/lib/db";
import { requireAdminPageContext } from "@/lib/admin";

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { store } = await requireAdminPageContext();
  const { view } = await searchParams;
  const variants = await db.productVariant.findMany({ where: { product: { storeId: store.id }, active: true, ...(view === "low" ? { inventory: { lte: 5 } } : {}) }, include: { product: { select: { name: true, status: true } }, inventoryMovements: { take: 1, orderBy: { createdAt: "desc" } } }, orderBy: [{ inventory: "asc" }, { sku: "asc" }] });
  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>Inventory</h1><p>Available stock excludes units reserved by unpaid orders.</p></div><div className="admin-actions"><Link className={`button ${view === "low" ? "" : "secondary"}`} href="/admin/inventory?view=low">Low stock</Link><Link className={`button ${view !== "low" ? "" : "secondary"}`} href="/admin/inventory">All stock</Link></div></div><section className="admin-panel flush"><div className="admin-table inventory-table"><div className="admin-tr admin-th"><span>Product / SKU</span><span>On hand</span><span>Reserved</span><span>Available</span><span>Action</span></div>{variants.map(variant => { const available = variant.inventory - variant.reservedInventory; return <div className="admin-tr" key={variant.id}><span><strong>{variant.product.name}</strong><small>{variant.sku} · {variant.name}</small></span><span>{variant.inventory}</span><span>{variant.reservedInventory}</span><strong className={available <= variant.lowStockThreshold ? "stock-warning" : ""}>{available}</strong><InventoryAdjuster variantId={variant.id} current={variant.inventory} reserved={variant.reservedInventory} /></div>; })}</div>{!variants.length && <div className="admin-empty">No inventory items match this view.</div>}</section></div>;
}
