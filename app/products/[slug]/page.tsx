import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProductPurchase } from "@/components/product-purchase";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import { canonicalForStore, nonEmpty, productOffers } from "@/lib/seo";

const getProductForStore = cache((storeId: string, slug: string) => db.product.findFirst({
  where: { storeId, OR: [{ slug }, { legacySlugs: { has: slug } }], status: "ACTIVE", shopVisible: true, category: { storeId, status: "PUBLISHED" } },
  include: {
    category: true,
    images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    variants: { where: { active: true }, orderBy: [{ isDefault: "desc" }, { priceCents: "asc" }] },
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
  const store = await getCurrentStorefront();
  const title = nonEmpty(product.seoTitle, product.name);
  const description = nonEmpty(product.seoDescription, product.shortDescription ?? product.description);
  return {
    title,
    description,
    alternates: { canonical: canonicalForStore(store.origin, `/products/${product.slug}`, product.canonicalUrl) },
    robots: product.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: "website", url: `${store.origin}/products/${product.slug}`, images: product.ogImageUrl ? [product.ogImageUrl] : product.images[0] ? [product.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [product, store] = await Promise.all([getProduct((await params).slug), getCurrentStorefront()]);
  if (!product) notFound();
  if (product.slug !== (await params).slug) permanentRedirect(`/products/${product.slug}`);
  const origin = store.origin;
  const connected = hasStoreCapability(store, StoreCapability.NFC);
  const productData = {
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    brand: { "@type": "Brand", name: store.displayName },
    image: product.images.map(image => new URL(image.url, origin).toString()),
    offers: productOffers(product.variants, product.options, product.personalisationMode, store.currency, `${origin}/products/${product.slug}`),
  };
  const structuredData = { "@context": "https://schema.org", "@graph": [productData, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, ...(product.category ? [{ "@type": "ListItem", position: 3, name: product.category.name, item: `${origin}/${product.category.slug}` }] : []), { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name, item: `${origin}/products/${product.slug}` }] }] };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
    <section className="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{product.category && <><span>/</span><Link href={`/${product.category.slug}`}>{product.category.name}</Link></>}</nav>
      <ProductPurchase productName={product.name} description={product.shortDescription ?? product.description} categoryName={product.category?.name ?? null} storeName={store.displayName} currency={store.currency} connected={connected} personalisationMode={product.personalisationMode} variants={product.variants.map(variant => ({ id: variant.id, name: variant.name, priceCents: variant.priceCents, inventory: variant.inventory, reservedInventory: variant.reservedInventory, trackInventory: variant.trackInventory, backorderPolicy: variant.backorderPolicy, isDefault: variant.isDefault, optionSelection: variant.optionSelection as Record<string, string>, imageId: variant.imageId }))} options={product.options} images={product.images.map(image => ({ id: image.id, url: image.url, altText: image.altText, isPrimary: image.isPrimary, optionValueId: image.optionValueId }))} />
      <div className="product-story"><div><p className="eyebrow">How it works</p><h2>{connected ? "One physical product. A profile you control." : "Thoughtfully designed. Made for your space."}</h2></div><div><p>{product.fullDescription ?? product.description}</p>{connected && <p>The NFC chip and printed QR code open the same secure {store.displayName} address. Your personal details live in your account, so you can update or disable them without replacing the product.</p>}</div></div>
    </section>
  </>;
}
