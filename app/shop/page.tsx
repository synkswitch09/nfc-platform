import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const requestedCategory = (await searchParams).category ?? "";
  const categories = await db.productCategory.findMany({ where: { status: "PUBLISHED", showInShop: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const selected = categories.find(category => category.slug === requestedCategory);
  const products = requestedCategory && !selected ? [] : await db.product.findMany({ where: { status: "ACTIVE", shopVisible: true, category: { status: "PUBLISHED" }, ...(selected ? { categoryId: selected.id } : {}) }, include: { category: true, images: { where: { isPrimary: true }, take: 1 }, variants: { where: { active: true }, orderBy: { priceCents: "asc" } } }, orderBy: [{ featured: "desc" }, { name: "asc" }] });
  return <section className="section"><div className="section-head"><span className="eyebrow">Tapkin shop</span><h1 className="page-title">{selected ? selected.name : "Smart products for real life."}</h1><p className="lead">Personalised in Adelaide, connected by NFC and QR, and backed by secure profiles you can update whenever life changes.</p></div><nav className="category-pills" aria-label="Product categories"><Link className={!requestedCategory ? "active" : ""} href="/shop">All products</Link>{categories.map(category => <Link className={selected?.id === category.id ? "active" : ""} href={`/shop?category=${category.slug}`} key={category.id}>{category.name}</Link>)}</nav><div className="shop-grid">{products.map(product => { const variant = product.variants[0]; const image = product.images[0]; return <article className="card product-card" key={product.id}>{image && <Image className="category-product-image" src={image.url} alt={image.altText} width={520} height={520} unoptimized />}<span className="eyebrow">{product.category?.name ?? product.type}</span><h2>{product.name}</h2><p>{product.shortDescription ?? product.description}</p>{variant ? <><p className="price">From {money.format(variant.priceCents / 100)}</p><Link className="button" href={`/products/${product.slug}`}>View and personalise</Link></> : <p className="muted">Coming soon</p>}</article>; })}</div>{!products.length && <div className="admin-empty">No products are currently available in this collection.</div>}</section>;
}
