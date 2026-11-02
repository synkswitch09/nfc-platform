"use client";
import Image from "next/image";
import Link from "next/link";
import { StorefrontIcon } from "@/components/storefront-icon";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { FavouriteButton } from "@/components/favourite-button";
import { cardColourImage, cardCoverImage } from "@/lib/product-card-image";
import { ProductCardSwatches } from "@/components/product-card-swatches";
import { productCardPriceLabel, type CardPriceProduct } from "@/lib/product-card-price";

export type StorefrontCardProduct = Omit<CardPriceProduct, "options"> & {
  variants: (CardPriceProduct["variants"][number] & { id?: string; imageId?: string | null; colour?: string | null })[];
  id: string; slug: string; name: string; description: string; shortDescription: string | null;
  createdAt?: Date | string;
  images: { id?: string; url: string; altText: string; optionValueId?: string | null; variantId?: string | null }[];
  options?: (Omit<NonNullable<CardPriceProduct["options"]>[number], "values"> & { values: { id: string; label: string; value: string; swatchHex: string | null; priceDeltaCents: number; active?: boolean }[] })[];
};
let browsingSeed: number | undefined;
const subscribeToCover = () => () => {};
const browserCoverSeed = () => browsingSeed ??= Math.random();
const serverCoverSeed = () => null;

export function KosykinProductCard({ product, currency, canBuy = true }: { product: StorefrontCardProduct; currency: string; canBuy?: boolean }) {
  // Hydration uses the server snapshot; a fresh browser load then picks stable per-product colours.
  const seed = useSyncExternalStore(subscribeToCover, browserCoverSeed, serverCoverSeed);
  const [previewColour, setPreviewColour] = useState<string | null>(null);
  const preview = previewColour ? cardColourImage(product, previewColour) : undefined;
  const primary = preview ?? cardCoverImage(product, product.id, seed);
  const secondary = product.images.find(image => image.url !== primary?.url);
  const newArrival = product.createdAt && Date.now() - new Date(product.createdAt).getTime() < 30 * 86400000;
  return <article className="kosy-product-card" onMouseLeave={() => setPreviewColour(null)}>
    <Link className="kosy-product-image" href={`/products/${product.slug}`}>{primary ? <Image src={primary.url} alt={primary.altText || product.name} width={520} height={520} unoptimized /> : <ShoppingBag aria-label="Product image coming soon" />}{!preview && secondary && <Image className="kosy-product-hover-image" src={secondary.url} alt="" width={520} height={520} unoptimized />}{newArrival && <span className="kosy-product-badge">✦ New arrival</span>}</Link>
    <Link className="kosy-product-name" href={`/products/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.shortDescription ?? product.description}</p>
    <div className="kosy-product-price"><strong>{productCardPriceLabel(product, currency)}</strong><ProductCardSwatches product={product} onPreview={setPreviewColour} /></div>
    {!canBuy && <p className="kosy-product-unavailable">Currently unavailable</p>}
    <div className="kosy-product-actions"><Link className="kosy-section-action" href={`/products/${product.slug}`}>View product<StorefrontIcon name="arrowRight" size={16} fallback={<ArrowRight size={16} aria-hidden="true" />} /></Link><FavouriteButton slug={product.slug} iconOnly /></div>
  </article>;
}
