"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartView({ currency, nfcEnabled, shippingConfig }: { currency: string; nfcEnabled: boolean; shippingConfig: { flatRateCents: number; freeOverCents: number } }) {
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency });
  const { lines, ready, setQuantity, remove } = useCart();
  if (!ready) return <div className="card cart-empty">Loading your cart…</div>;
  if (!lines.length) return <div className="card cart-empty"><ShoppingBag size={42} /><h2>Your cart is empty</h2><p className="muted">Choose a product and personalise it before checkout.</p><Link href="/shop" className="button">Browse products</Link></div>;
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const shipping = subtotal >= shippingConfig.freeOverCents ? 0 : shippingConfig.flatRateCents;
  return <div className="cart-layout">
    <div className="cart-lines">{lines.map(line => <article className="cart-row" key={line.key}>
      <div className="cart-thumb"><ProductMark nfcEnabled={nfcEnabled} /></div>
      <div><h3>{line.productName}</h3><p className="muted">{line.variantName}</p>{Object.entries(line.personalisation).length > 0 && <dl className="personalisation-list">{Object.entries(line.personalisation).map(([key, value]) => <div key={key}><dt>{key.replaceAll("-", " ")}</dt><dd>{value}</dd></div>)}</dl>}</div>
      <div className="quantity-control" aria-label={`Quantity for ${line.productName}`}><button type="button" onClick={() => setQuantity(line.key, line.quantity - 1)} aria-label="Decrease quantity"><Minus size={15} /></button><span>{line.quantity}</span><button type="button" onClick={() => setQuantity(line.key, line.quantity + 1)} aria-label="Increase quantity"><Plus size={15} /></button></div>
      <strong>{money.format(line.unitPriceCents * line.quantity / 100)}</strong>
      <button className="icon-button" type="button" onClick={() => remove(line.key)} aria-label={`Remove ${line.productName}`}><Trash2 size={18} /></button>
    </article>)}</div>
    <aside className="order-summary"><h2>Order summary</h2><p><span>Subtotal</span><strong>{money.format(subtotal / 100)}</strong></p><p><span>Standard shipping</span><strong>{shipping ? money.format(shipping / 100) : "Free"}</strong></p><p className="summary-total"><span>Total</span><strong>{money.format((subtotal + shipping) / 100)}</strong></p><small>Final prices and availability are verified securely at checkout.</small><Link href="/checkout" className="button purchase-button">Continue to checkout</Link><Link href="/shop" className="text-link">Continue shopping</Link></aside>
  </div>;
}

function ProductMark({ nfcEnabled }: { nfcEnabled: boolean }) { return <span aria-hidden="true">{nfcEnabled ? "NFC" : "3D"}</span>; }
