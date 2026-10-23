"use client";
import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
export function ShopAddButton({ variantId, productName, variantName, unitPriceCents }: { variantId: string; productName: string; variantName: string; unitPriceCents: number }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  return <button className="kosy-section-action" type="button" disabled={!cart.ready} onClick={() => { cart.add({ variantId, productName, variantName, unitPriceCents, quantity: 1, personalisationChoice: 'BASIC', personalisation: {} }); setAdded(true); }}><ShoppingBag size={15} />{added ? 'Added to cart' : 'Add to cart'}</button>;
}
