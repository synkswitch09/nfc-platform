import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck, Radio, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { ProductPurchase } from "@/components/product-purchase";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";

const getProductForStore = cache((storeId: string, slug: string) => db.product.findFirst({
  where: { storeId, slug, status: "ACTIVE", shopVisible: true, category: { storeId, status: "PUBLISHED" } },
  include: {
    category: true,
    images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    variants: { where: { active: true }, orderBy: { priceCents: "asc" } },
    options: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { values: { where: { active: true }, orderBy: { sortOrder: "asc" } } } },
  },
}));

async function getProduct(slug: string) {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) return null;
  return getProductForStore(store.id, slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.shortDescription ?? product.description;
  return {
    title,
    description,
    alternates: { canonical: product.canonicalUrl ?? `/products/${product.slug}` },
    robots: product.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: "website", images: product.ogImageUrl ? [product.ogImageUrl] : product.images[0] ? [product.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [product, store] = await Promise.all([getProduct((await params).slug), getCurrentStorefront()]);
  if (!product) notFound();
  const primary = product.images[0];
  const lowestPrice = product.variants[0]?.priceCents;
  const origin = store.origin;
  const connected = hasStoreCapability(store, StoreCapability.NFC);
  const productData = {
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: store.displayName },
    image: product.images.map(image => new URL(image.url, origin).toString()),
    offers: lowestPrice === undefined ? undefined : {
      "@type": "Offer",
      priceCurrency: store.currency,
      price: (lowestPrice / 100).toFixed(2),
      availability: product.variants.some(variant => !variant.trackInventory || variant.backorderPolicy === "ALLOW" || variant.inventory > variant.reservedInventory) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${origin}/products/${product.slug}`,
    },
  };
  const structuredData = { "@context": "https://schema.org", "@graph": [productData, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, ...(product.category ? [{ "@type": "ListItem", position: 3, name: product.category.name, item: `${origin}/${product.category.slug}` }] : []), { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name, item: `${origin}/products/${product.slug}` }] }] };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{product.category && <><span>/</span><Link href={`/${product.category.slug}`}>{product.category.name}</Link></>}</nav>
      <div className="product-layout">
        <div className="product-gallery">
          {primary ? <Image src={primary.url} alt={primary.altText} width={900} height={900} priority unoptimized /> : <div className="product-placeholder"><Radio size={64} /><span>{store.displayName}</span><strong>{product.name}</strong><small>Made to order in Adelaide</small></div>}
          {product.images.length > 1 && <div className="product-thumbs">{product.images.slice(1).map(image => <Image key={image.id} src={image.url} alt={image.altText} width={160} height={160} unoptimized />)}</div>}
        </div>
        <div className="product-copy">
          <p className="eyebrow">{product.category?.name ?? "Smart NFC product"}</p>
          <h1>{product.name}</h1>
          <p className="lead">{product.shortDescription ?? product.description}</p>
          <ProductPurchase productName={product.name} variants={product.variants} options={product.options} />
          <div className="trust-list">{connected && <span><ShieldCheck /> Personal data stays off the NFC chip</span>}{connected && <span><RefreshCw /> Update the profile any time</span>}<span><PackageCheck /> Personalised and made to order</span><span><Truck /> Australia-wide delivery</span></div>
        </div>
      </div>
      <div className="product-story"><div><p className="eyebrow">How it works</p><h2>{connected ? "One physical product. A profile you control." : "Thoughtfully designed. Made for your space."}</h2></div><div><p>{product.fullDescription ?? product.description}</p>{connected && <p>The NFC chip and printed QR code open the same secure {store.displayName} address. Your personal details live in your account, so you can update or disable them without replacing the product.</p>}</div></div>
    </section>
  </>;
}
