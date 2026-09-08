import Link from "next/link";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const products = await db.product.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }] } : {}),
      ...(status && ["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"].includes(status) ? { status: status as "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "ARCHIVED" } : {}),
    },
    include: { category: true, variants: { where: { active: true }, orderBy: { priceCents: "asc" } }, images: { where: { isPrimary: true }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return <div><div className="admin-heading"><div><p className="admin-kicker">Catalog</p><h1>Products</h1><p>Control publication, pricing, variants and NFC personalisation.</p></div><Link className="button" href="/admin/products/new"><Plus size={17} /> Add product</Link></div>
    <form className="admin-filters"><label><Search size={17} /><input name="q" defaultValue={q} placeholder="Search name, slug or SKU" /></label><select name="status" defaultValue={status}><option value="">All statuses</option><option>DRAFT</option><option>ACTIVE</option><option>OUT_OF_STOCK</option><option>ARCHIVED</option></select><button className="button secondary">Filter</button></form>
    <section className="admin-panel flush">{products.length ? <div className="admin-table product-admin-table"><div className="admin-tr admin-th"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Status</span></div>{products.map(product => {
      const activeVariants = product.variants;
      const stock = activeVariants.reduce((total, variant) => total + Math.max(0, variant.inventory - variant.reservedInventory), 0);
      return <Link href={`/admin/products/${product.id}`} className="admin-tr" key={product.id}><span className="admin-product-cell">{product.images[0] ? <Image src={product.images[0].url} alt="" width={42} height={42} unoptimized /> : <span className="admin-product-placeholder">TK</span>}<span><strong>{product.name}</strong><small>{activeVariants.map(variant => variant.sku).join(" · ") || "No active variants"}</small></span></span><span>{product.category?.name ?? "Uncategorised"}</span><span>{activeVariants[0] ? money.format(activeVariants[0].priceCents / 100) : "—"}</span><span className={stock <= 5 ? "stock-warning" : ""}>{stock}</span><span className={`admin-status ${product.status}`}>{product.status.replaceAll("_", " ")}</span></Link>;
    })}</div> : <div className="admin-empty">No products match this view.</div>}</section>
  </div>;
}
