"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FavouriteButton } from "@/components/favourite-button";
import { StorefrontIcon } from "@/components/storefront-icon";
import { cardColourImage } from "@/lib/product-card-image";
import { ProductCardSwatches } from "@/components/product-card-swatches";
import { productCardPriceLabel, type CardPriceProduct } from "@/lib/product-card-price";

export type StorefrontCardProduct = Omit<CardPriceProduct, "options"> & {
  variants: (CardPriceProduct["variants"][number] & { id?: string; imageId?: string | null; colour?: string | null })[];
  id: string; slug: string; name: string; description: string; shortDescription: string | null;
  createdAt?: Date | string;
  images: { id?: string; url: string; altText: string; optionValueId?: string | null; variantId?: string | null }[];
  options?: (Omit<NonNullable<CardPriceProduct["options"]>[number], "values"> & { values: { id: string; label: string; value: string; swatchHex: string | null; priceDeltaCents: number; active?: boolean }[] })[];
};
export function KosykinProductCard({ product, currency, canBuy = true, addAction, home = false }: { product: StorefrontCardProduct; currency: string; canBuy?: boolean; addAction?: ReactNode; home?: boolean }) {
  const [previewColour, setPreviewColour] = useState<string | null>(null);
  const preview = previewColour ? cardColourImage(product, previewColour) : undefined;
  const primary = preview ?? product.images[0];
  const newArrival = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 30 * 86400000;
  return <article className={`kosy-product-card${home ? " kosy-product-card-home" : ""}`} onMouseLeave={() => setPreviewColour(null)}>
    <Link className="kosy-product-image" href={`/products/${product.slug}`}>{primary ? <Image src={primary.url} alt={primary.altText || product.name} width={520} height={520} unoptimized /> : <ShoppingBag aria-label="Product image coming soon" />}{!preview && product.images[1] && <Image className="kosy-product-hover-image" src={product.images[1].url} alt="" width={520} height={520} unoptimized />}{newArrival && <span className="kosy-product-badge">✦ New arrival</span>}</Link>
    <Link className="kosy-product-name" href={`/products/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.shortDescription ?? product.description}</p>
    <div className="kosy-product-price"><strong>{productCardPriceLabel(product, currency)}</strong><ProductCardSwatches product={product} onPreview={setPreviewColour} /></div>
    {!canBuy && <p className="kosy-product-unavailable">Currently unavailable</p>}
    <div className="kosy-product-actions">{home ? <Link className="kosy-section-action" href={`/products/${product.slug}`}>View product<ArrowRight size={16} aria-hidden="true" /></Link> : (addAction ?? <Link className="kosy-section-action" href={`/products/${product.slug}`}><StorefrontIcon name="cart" size={20} fallback={<ShoppingBag size={15} />} />{canBuy ? "Add to cart" : "View product"}</Link>)}<FavouriteButton slug={product.slug} iconOnly /></div>
  </article>;
}
