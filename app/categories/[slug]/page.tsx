import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";

const getCategory = cache((slug: string) => db.productCategory.findFirst({
  where: { slug, active: true },
  include: { products: { where: { status: "ACTIVE" }, include: { images: { where: { isPrimary: true }, take: 1 }, variants: { where: { active: true }, orderBy: { priceCents: "asc" } } }, orderBy: [{ featured: "desc" }, { name: "asc" }] } },
}));
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = await getCategory((await params).slug); if (!category) return {};
  return { title: category.seoTitle ?? category.name, description: category.seoDescription ?? category.description, alternates: { canonical: `/categories/${category.slug}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = await getCategory((await params).slug); if (!category) notFound();
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const faq = Array.isArray(category.faq) ? category.faq.filter((item): item is { question: string; answer: string } => Boolean(item && typeof item === "object" && "question" in item && "answer" in item && typeof item.question === "string" && typeof item.answer === "string")) : [];
  const structuredData = { "@context": "https://schema.org", "@graph": [{ "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, { "@type": "ListItem", position: 3, name: category.name, item: `${origin}/categories/${category.slug}` }] }, { "@type": "ItemList", name: category.name, itemListElement: category.products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: `${origin}/products/${product.slug}`, name: product.name })) }, ...(faq.length ? [{ "@type": "FAQPage", mainEntity: faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }] : [])] };
  return <section className="section compact-section"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} /><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span>{category.name}</span></nav><div className="section-head"><span className="eyebrow">TapKind collection</span><h1 className="page-title">{category.name}</h1><p className="lead">{category.description}</p>{category.imageUrl && <Image className="category-hero-image" src={category.imageUrl} alt={`${category.name} collection`} width={1200} height={500} unoptimized />}</div><div className="shop-grid">{category.products.map(product => <article className="card product-card" key={product.id}>{product.images[0] && <Image className="category-product-image" src={product.images[0].url} alt={product.images[0].altText} width={500} height={500} unoptimized />}<span className="eyebrow">{product.type}</span><h2>{product.name}</h2><p>{product.shortDescription ?? product.description}</p>{product.variants[0] && <strong className="price">From {money.format(product.variants[0].priceCents / 100)}</strong>}<Link className="button" href={`/products/${product.slug}`}>View product</Link></article>)}</div>{!category.products.length && <div className="admin-empty">Products in this collection are coming soon.</div>}{faq.length > 0 && <section className="faq-section"><h2>Frequently asked questions</h2>{faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}</section>;
}
