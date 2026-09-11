import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";
import { notFound } from "next/navigation";
import { StoreStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) notFound();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const requestedCategory = (await searchParams).category ?? "";
  const categories = await db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showInShop: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const selected = categories.find(category => category.slug === requestedCategory);
  const products = requestedCategory && !selected ? [] : await db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" }, ...(selected ? { categoryId: selected.id } : {}) }, include: { category: true, images: { where: { isPrimary: true }, take: 1 }, variants: { where: { active: true }, orderBy: { priceCents: "asc" } } }, orderBy: [{ featured: "desc" }, { name: "asc" }] });
  return <section className="section"><div className="section-head"><span className="eyebrow">{store.displayName} shop</span><h1 className="page-title">{selected ? selected.name : "Products made for real life."}</h1><p className="lead">Thoughtfully designed and personalised in Adelaide, with clear options and secure checkout.</p>{selected?.showLanding && <Link className="category-shop-intro" href={`/${selected.slug}`}>Explore the {selected.name} story <span aria-hidden="true">→</span></Link>}</div><nav className="category-pills" aria-label="Product categories"><Link className={!requestedCategory ? "active" : ""} href="/shop">All products</Link>{categories.map(category => <Link className={selected?.id === category.id ? "active" : ""} href={`/shop?category=${category.slug}`} key={category.id}>{category.name}</Link>)}</nav><div className="shop-grid">{products.map(product => { const variant = product.variants[0]; const image = product.images[0]; return <article className="card product-card" key={product.id}>{image && <Image className="category-product-image" src={image.url} alt={image.altText} width={520} height={520} unoptimized />}<span className="eyebrow">{product.category?.name ?? product.type}</span><h2>{product.name}</h2><p>{product.shortDescription ?? product.description}</p>{variant ? <><p className="price">From {money.format(variant.priceCents / 100)}</p><Link className="button" href={`/products/${product.slug}`}>View and personalise</Link></> : <p className="muted">Coming soon</p>}</article>; })}</div>{!products.length && <div className="admin-empty">No products are currently available in this collection.</div>}</section>;
}
