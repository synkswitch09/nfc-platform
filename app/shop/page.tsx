import { getStoreSettings } from "@/lib/settings";
import { KosykinShop } from "@/components/kosykin-shop";
import { kosykinCollectionSlug, kosykinShopCollections, queryList, shopProductVariants, type ShopQuery } from "@/lib/kosykin-shop";
import { FavouriteButton } from "@/components/favourite-button";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getExperience, publicBannerGroups } from "@/lib/store-experience";
import { getCurrentStorefront } from "@/lib/storefront";
import { notFound } from "next/navigation";
import { StoreStatus } from "@prisma/client";
import type { Metadata } from "next";
import { KEYCHAIN_SLUG } from "@/lib/keychain-order";
import { canAcceptVariant } from "@/lib/production-capacity";
import { KEYCHAIN_PREVIEW_NAME, KEYCHAIN_PREVIEW_DESCRIPTION } from "@/lib/keychain-shop-preview";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";

const categoriesFrom = (query: ShopQuery) => (Array.isArray(query.category) ? query.category : query.category ? [query.category] : []).slice(0, 20);

export async function generateMetadata({ searchParams }: { searchParams: Promise<ShopQuery> }): Promise<Metadata> {
  const store = await getCurrentStorefront();
  const filtered = Object.keys(await searchParams).length > 0;
  const runtime = getRuntimeConfig();
  const policy = store.status === StoreStatus.ACTIVE ? searchEnginePolicy(runtime.appEnv, runtime.previewMode) : { index: false, follow: false };
  return { title: "Shop", alternates: { canonical: `${store.origin}/shop` }, robots: filtered && policy.index ? { index: false, follow: true } : policy, openGraph: { url: `${store.origin}/shop`, title: `Shop · ${store.displayName}` } };
}

export const dynamic = "force-dynamic";
export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopQuery> }) {
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE) notFound();
  const params = await searchParams;
  const query = store.slug === "kosykin" ? { ...params, category: queryList(params.category).map(kosykinCollectionSlug) } : params;
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: store.currency });
  const categories = await db.productCategory.findMany({ where: { storeId: store.id, ...(store.slug === "kosykin" ? {} : { status: "PUBLISHED", showInShop: true }) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const home = store.slug === "kosykin" ? await db.contentPage.findFirst({ where: { storeId: store.id, kind: "HOME", status: "PUBLISHED" }, select: { sections: { where: { type: { in: ["CTA_BANNER", "FEATURE_BADGES", "HERO"] } }, orderBy: { sortOrder: "asc" }, select: { visible: true, content: true } } } }) : null;
  const collections = home?.sections.find(section => section.content && typeof section.content === "object" && !Array.isArray(section.content) && section.content.layoutVariant === "KOSYKIN_CIRCLES");
  const collectionContent = collections?.content as { items?: Parameters<typeof kosykinShopCollections>[1] } | undefined;
  const tabs = kosykinShopCollections(categories, Array.isArray(collectionContent?.items) ? collectionContent.items : []);
  const selected = categories.filter(category => categoriesFrom(query).includes(category.slug));
  const selectedIds = store.slug === "kosykin" ? tabs.filter(tab => categoriesFrom(query).includes(tab.slug)).flatMap(tab => tab.categoryIds) : selected.map(category => category.id);
  const min = query.min && Number.isFinite(Number(query.min)) ? Math.max(0, Number(query.min)) * 100 : 0;
  const max = query.max && Number.isFinite(Number(query.max)) ? Math.max(0, Number(query.max)) * 100 : Infinity;
  const [pool, booked] = await Promise.all([db.productionPool.findUnique({ where: { environment: store.environment } }), db.productionBooking.aggregate({ where: { environment: store.environment, releasedAt: null }, _sum: { minutes: true } })]);
  const available = (variant: { trackInventory: boolean; backorderPolicy: string; inventory: number; reservedInventory: number; productionMinutes: number | null }) => canAcceptVariant(variant, pool, booked._sum.minutes ?? 0);
  const products = await db.product.findMany({
    where: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" }, ...(categoriesFrom(query).length ? { categoryId: { in: selectedIds } } : {}) },
    include: { _count: { select: { options: true } }, category: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, variants: { where: { active: true }, orderBy: { priceCents: "asc" } }, options: { where: { type: "COLOUR" }, include: { values: { where: { active: true }, orderBy: { sortOrder: "asc" } } }, take: 1 } },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  const visible = products.filter(product => {
    if (store.slug === "kosykin") return shopProductVariants(product, query, available).length > 0;
    const cheapest = product.variants[0]?.priceCents;
    const canBuy = product.variants.some(available);
    return cheapest !== undefined && cheapest >= min && cheapest <= max && (query.availability !== "available" || canBuy);
  }).sort((a, b) => query.sort === "price-asc" ? a.variants[0].priceCents - b.variants[0].priceCents : query.sort === "price-desc" ? b.variants[0].priceCents - a.variants[0].priceCents : query.sort === "new" ? b.createdAt.getTime() - a.createdAt.getTime() : Number(b.featured) - Number(a.featured));
  if (store.slug === "kosykin") {
    const experience = await getExperience(store.id);
    const bannerGroups = await publicBannerGroups(store.id);
    const promotion = experience.configured ? null : home?.sections.find(section => section.content && typeof section.content === "object" && !Array.isArray(section.content) && section.content.layoutVariant === "KOSYKIN_PROMOTIONS") ?? null;
    const support = home?.sections.find(section => section.content && typeof section.content === "object" && !Array.isArray(section.content) && section.content.layoutVariant === "KOSYKIN_SUPPORT") ?? null;
    const trust = home?.sections.find(section => section.content && typeof section.content === "object" && !Array.isArray(section.content) && section.content.layoutVariant === "KOSYKIN_WAVY")?.content as Record<string, unknown> | undefined;
    const settings = await getStoreSettings(store);
    const sorted = [...visible].sort((a, b) => {
      const lowest = (product: typeof a) => Math.min(...shopProductVariants(product, query, available).map(variant => variant.priceCents));
      return query.sort === "price-asc" ? lowest(a) - lowest(b) : query.sort === "price-desc" ? lowest(b) - lowest(a) : query.sort === "new" ? b.createdAt.getTime() - a.createdAt.getTime() : Number(b.featured) - Number(a.featured);
    }).map(product => ({ ...product, sourceVariantCount: product.variants.length, variants: shopProductVariants(product, query, available) }));
    return <KosykinShop bannerGroups={bannerGroups} products={sorted} filterProducts={products} categories={tabs} query={{ ...query, category: queryList(query.category) }} promotion={promotion} support={support} trust={trust} socials={{ links: settings.socialLinks, icons: settings.footerConfig.socialIcons }} currency={store.currency} available={available} checkoutEnabled={getRuntimeConfig().checkoutEnabled} />;
  }
  const showKeychainPreview = store.slug === "kosykin" && !Object.keys(query).length && !products.some(product => product.slug === KEYCHAIN_SLUG);
  return <section className="section"><div className="section-head"><span className="eyebrow">{store.displayName} shop</span><h1 className="page-title">Products made for real life.</h1><p className="lead">Thoughtfully designed and personalised in Adelaide, with clear options and secure checkout.</p></div>
    <form className="shop-filters" action="/shop" method="get"><fieldset><legend>Categories</legend><div className="shop-filter-categories">{categories.map(category => <label key={category.id}><input name="category" type="checkbox" value={category.slug} defaultChecked={selected.some(item => item.id === category.id)} />{category.name}</label>)}</div></fieldset><label>Min price <input name="min" type="number" min="0" step="0.01" defaultValue={query.min ?? ""} /></label><label>Max price <input name="max" type="number" min="0" step="0.01" defaultValue={query.max ?? ""} /></label><label>Availability <select name="availability" defaultValue={query.availability ?? ""}><option value="">All products</option><option value="available">Available to order</option></select></label><label>Sort <select name="sort" defaultValue={query.sort ?? "featured"}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="new">Newest</option></select></label><button className="button" type="submit">Apply filters</button><Link href="/shop">Clear</Link></form>
    <div className="shop-grid">{visible.map(product => { const variant = product.variants[0]; const image = product.images[0]; const second = product.images[1]; const inStock = product.variants.some(available); const swatches = product.options[0]?.values.slice(0, 3) ?? []; const sizes = new Set(product.variants.map(item => item.size).filter(Boolean)); return <article className="card product-card" key={product.id}><Link className="shop-card-image" href={`/products/${product.slug}`}>{image && <Image className="category-product-image" src={image.url} alt={image.altText} width={520} height={520} unoptimized />}{second && <Image className="shop-card-second" src={second.url} alt={second.altText} width={520} height={520} unoptimized />}</Link><span className="eyebrow">{product.category?.name ?? product.type}</span><h2>{product.name}</h2><p>{product.shortDescription ?? product.description}</p><p className="price">From {money.format(variant.priceCents / 100)}</p><p className="shop-card-availability">{inStock ? "Available to order" : "Currently unavailable"}{sizes.size > 1 ? ` · ${sizes.size} sizes` : ""}</p>{swatches.length > 0 && <div className="shop-card-swatches" aria-label="Available colours">{swatches.map(item => <Link key={item.id} href={`/products/${product.slug}?colour=${encodeURIComponent(item.value)}`} aria-label={`View ${product.name} in ${item.label}`} title={item.label} style={{ background: item.swatchHex ?? undefined }} />)}{product.options[0].values.length > 3 && <span>+{product.options[0].values.length - 3}</span>}</div>}<div className="kosy-product-actions"><Link className="button" href={`/products/${product.slug}`}>View product</Link><FavouriteButton slug={product.slug} iconOnly /></div></article>; })}{showKeychainPreview && <article className="card product-card"><span className="eyebrow">Custom 3D print · Preview</span><h2>{KEYCHAIN_PREVIEW_NAME}</h2><p>{KEYCHAIN_PREVIEW_DESCRIPTION}</p><p className="muted">Orders opening soon</p><Link className="button" href={`/products/${KEYCHAIN_SLUG}`}>Design your keychain</Link></article>}</div>{!visible.length && !showKeychainPreview && <div className="admin-empty">No products match these filters.</div>}</section>;
}
