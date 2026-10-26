"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-provider";
import type { CartGiftOffer } from "@/lib/cart-gift-offers";
export function GiftOfferNotice({ gifts }: { gifts: CartGiftOffer[] }) {
  if (!gifts.length) return null;
  return <section className="card order-gifts" aria-label="Complimentary gift offer" aria-live="polite"><h2>Complimentary gift offer</h2>{gifts.map(gift => <p key={gift.id}><strong>Eligible for 1 × {gift.giftName} at no charge.</strong> Your cart includes a product from {gift.categoryName}.</p>)}<p className="fine-print">One of each eligible gift per order. No code or extra cart item is needed. The gift cannot be removed separately. Colour is assigned automatically from the available options after payment. Gifts are confirmed after successful payment, while campaign places remain available. Your order confirmation will show any gift awarded.</p></section>;
}
export function CartGiftOffers({ storeSlug }: { storeSlug: string }) {
  const { lines, ready } = useCart();
  const ids = [...new Set(lines.filter(line => line.quantity > 0).map(line => line.variantId))].sort();
  const signature = JSON.stringify([storeSlug, ids]);
  const [result, setResult] = useState<{ signature: string; gifts: CartGiftOffer[] } | null>(null);
  useEffect(() => {
    const [, variantIds] = JSON.parse(signature) as [string, string[]];
    if (!ready || !variantIds.length) return;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController(); controller = request;
      void fetch("/api/cart/gifts", { method: "POST", cache: "no-store", signal: request.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ variantIds }) }).then(async response => {
        if (!response.ok) throw new Error("Gift preview unavailable");
        return response.json();
      }).then(data => { if (!request.signal.aborted) setResult({ signature, gifts: Array.isArray(data.gifts) ? data.gifts : [] }); }).catch(() => { if (!request.signal.aborted) setResult({ signature, gifts: [] }); });
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [signature, ready]);
  return ready && ids.length && result?.signature === signature ? <GiftOfferNotice gifts={result.gifts} /> : null;
}
