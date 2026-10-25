import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { FavouriteButton } from "@/components/favourite-button";
import { StorefrontIcon } from "@/components/storefront-icon";
import { ProductCardSwatches } from "@/components/product-card-swatches";
import { productCardPriceLabel, type CardPriceProduct } from "@/lib/product-card-price";

export type StorefrontCardProduct = Omit<CardPriceProduct, "options"> & {
  id: string; slug: string; name: string; description: string; shortDescription: string | null;
  createdAt?: Date | string;
  images: { url: string; altText: string }[];
  options?: (Omit<NonNullable<CardPriceProduct["options"]>[number], "values"> & { values: { id: string; label: string; value: string; swatchHex: string | null; priceDeltaCents: number; active?: boolean }[] })[];
};
export function KosykinProductCard({ product, currency, canBuy = true, addAction }: { product: StorefrontCardProduct; currency: string; canBuy?: boolean; addAction?: ReactNode }) {
  const newArrival = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 30 * 86400000;
  return <article className="kosy-product-card">
    <Link className="kosy-product-image" href={`/products/${product.slug}`}>{product.images[0] ? <Image src={product.images[0].url} alt={product.images[0].altText || product.name} width={520} height={520} unoptimized /> : <ShoppingBag aria-label="Product image coming soon" />}{product.images[1] && <Image className="kosy-product-hover-image" src={product.images[1].url} alt="" width={520} height={520} unoptimized />}{newArrival && <span className="kosy-product-badge">✦ New arrival</span>}</Link>
    <Link className="kosy-product-name" href={`/products/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.shortDescription ?? product.description}</p>
    <div className="kosy-product-price"><strong>{productCardPriceLabel(product, currency)}</strong><ProductCardSwatches product={product} /></div>
    {!canBuy && <p className="kosy-product-unavailable">Currently unavailable</p>}
    <div className="kosy-product-actions">{addAction ?? <Link className="kosy-section-action" href={`/products/${product.slug}`}><StorefrontIcon name="cart" size={20} fallback={<ShoppingBag size={15} />} />{canBuy ? "Add to cart" : "View product"}</Link>}<FavouriteButton slug={product.slug} iconOnly /></div>
  </article>;
}
