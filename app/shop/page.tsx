import { db } from "@/lib/db";
import { BuyButton } from "@/components/buy-button";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await db.product.findMany({ where: { active: true }, include: { variants: { where: { active: true }, orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } });
  return <section className="section"><div className="section-head"><span className="eyebrow">TapKind shop</span><h1 style={{fontSize:"clamp(3rem,7vw,5.5rem)"}}>Choose your tag.</h1><p className="lead">Every product opens a secure profile you can update at any time. Prices are in Australian dollars.</p></div><div className="shop-grid">{products.map(product => { const variant = product.variants[0]; return <article className="card product-card" key={product.id}><span className="eyebrow">{product.type}</span><h3 style={{fontSize:"1.4rem",marginTop:20}}>{product.name}</h3><p>{product.description}</p>{variant ? <><p className="price">{new Intl.NumberFormat("en-AU", {style:"currency",currency:"AUD"}).format(variant.priceCents / 100)}</p><BuyButton variantId={variant.id} /></> : <p className="muted">Coming soon</p>}</article>; })}</div></section>;
}
