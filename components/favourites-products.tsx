"use client";
import { productCardPriceLabel, type CardPriceProduct } from "@/lib/product-card-price";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFavourites } from "@/components/favourites-provider";
import { FavouriteButton } from "@/components/favourite-button";
type Product = CardPriceProduct & { slug: string; name: string; shortDescription: string | null; images: { url: string; altText: string }[]; variants: { priceCents: number }[] };
export function FavouritesProducts({ currency }: { currency: string }) {
  const favourites = useFavourites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const saved = JSON.stringify(favourites?.slugs ?? []);
  const ready = favourites?.ready;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch("/api/favourites/products", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: JSON.parse(saved) }) })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setProducts(data.products); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load your saved products. Please reload to try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [saved, ready]);
  if (error || favourites?.error) return <p role="status">{error || favourites?.error}</p>;
  if (loading || !ready) return <p role="status">Loading favourites…</p>;
  return <>{!products.length ? <div className="favourites-empty"><p>Save a piece using its heart button and it will appear here.</p><Link className="button" href="/shop">Explore the shop</Link></div> : <div className="shop-grid">{products.map(product => <article className="card product-card" key={product.slug}>
    <Link href={`/products/${product.slug}`}>{product.images[0] && <Image src={product.images[0].url} alt={product.images[0].altText} width={500} height={500} unoptimized />}<h2>{product.name}</h2></Link>
    <p>{product.shortDescription}</p>{product.variants[0] && <strong>{productCardPriceLabel(product, currency)}</strong>}
    <FavouriteButton slug={product.slug} /><Link className="button" href={`/products/${product.slug}`}>Add to cart</Link>
  </article>)}</div>}</>;
}
