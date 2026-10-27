import { KosykinProductCard } from "@/components/kosykin-product-card";
import { KosykinTrustRow } from "@/components/kosykin-trust-row";
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { KosykinHomeSection } from '@/components/kosykin-home-section';
import { SharedBanners } from '@/components/shared-banners';
import type { BannerGroup } from '@/lib/store-experience';
import { KosykinShopFilters } from '@/components/kosykin-shop-filters';
import { queryList, shopCategoryStyle, type ShopQuery } from '@/lib/kosykin-shop';
import type { CSSProperties } from 'react';
type Product = Prisma.ProductGetPayload<{ include: { images: true; variants: true; options: { include: { values: true } } } }>;
type Category = { id: string; slug: string; name: string; shortDescription: string | null; highlightColour?: string };
type Promotion = { content: Prisma.JsonValue; visible: boolean } | null;
export function KosykinShop({ products, filterProducts, categories, query, promotion, trust, currency, available, bannerGroups = [] }: {
  bannerGroups?: BannerGroup[];
  products: (Product & { _count: { options: number }; sourceVariantCount: number })[]; filterProducts: Product[]; categories: Category[]; query: ShopQuery; promotion: Promotion; trust?: Record<string, unknown>; currency: string; checkoutEnabled: boolean; available: (variant: Product['variants'][number]) => boolean;
}) {
  const selected = categories.filter(category => queryList(query.category).includes(category.slug));
  const label = selected.length === 1 ? selected[0].name : selected.length > 1 ? 'Selected pieces' : 'All Pieces';
  const description = selected.length === 1 ? shopCategoryStyle(selected[0]).description : 'Find your kind of Kosy';
  const colours = [...new Map(filterProducts.flatMap(product => product.options.filter(option => option.type === "COLOUR").flatMap(option => option.values)).map(value => [value.value, { value: value.value, label: value.label, swatchHex: value.swatchHex }])).values()];
  const priceCeiling = Math.max(50, Math.ceil(Math.max(0, ...filterProducts.flatMap(product => product.variants.map(variant => variant.priceCents))) / 100 / 50) * 50, Number.isFinite(Number(query.max)) ? Math.max(0, Number(query.max)) : 0);
  const activeFilters = Boolean(query.min || query.max || query.colour || query.sale || query.availability || (query.sort && query.sort !== 'featured'));
  return <div className="kosy-shop">
    <SharedBanners groups={bannerGroups} position="TOP" />
    {promotion?.visible && promotion.content && typeof promotion.content === 'object' && !Array.isArray(promotion.content) && <section className="kosy-shop-promotions"><KosykinHomeSection type="CTA_BANNER" value={promotion.content as Record<string, unknown>} products={[]} currency={currency} /></section>}
    <section className="kosy-shop-intro"><h1>Make room for something Kosy.</h1><nav className="kosy-shop-categories" aria-label="Shop categories"><Link href="/shop" aria-current={!queryList(query.category).length ? 'page' : undefined} style={{ '--category-colour': '#243247' } as CSSProperties}>All Pieces</Link>{categories.map(category => <Link key={category.id} href={`/shop?${new URLSearchParams({ category: category.slug })}`} aria-current={selected.some(item => item.id === category.id) ? 'page' : undefined} style={{ '--category-colour': shopCategoryStyle(category).colour } as CSSProperties}>{category.name}</Link>)}</nav></section>
    <SharedBanners groups={bannerGroups} position="BEFORE_PRODUCTS" />
    <section className="kosy-shop-results" aria-labelledby="kosy-shop-results-title"><div className="kosy-shop-toolbar"><div><h2 id="kosy-shop-results-title">{label}</h2><p>{description}</p></div><KosykinShopFilters key={JSON.stringify(query)} query={query} colours={colours} priceCeiling={priceCeiling} currency={currency} /></div>
      {activeFilters && <p className="kosy-filter-summary" role="status">{products.length} {products.length === 1 ? 'piece' : 'pieces'} found with your filters. <Link href={selected.length ? `/shop?${new URLSearchParams(selected.map(category => ['category', category.slug]))}` : '/shop'}>Clear filters</Link></p>}
      <div className="kosy-shop-grid">{products.map(product => {
        const canBuy = product.variants.some(available);
        return <KosykinProductCard key={product.id} product={product} currency={currency} canBuy={canBuy} />;
      })}</div>
      {!products.length && <div className="kosy-shop-empty"><ShoppingBag size={32} /><h3>No pieces found</h3><p>Try another category or reset your filters to find your kind of Kosy.</p><Link className="kosy-section-action" href="/shop">See all pieces</Link></div>}
    </section>
    <SharedBanners groups={bannerGroups} position="AFTER_PRODUCTS" />
    <KosykinTrustRow content={trust} />

    <SharedBanners groups={bannerGroups} position="BOTTOM" />
  </div>;
}
