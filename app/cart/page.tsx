import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getCurrentStorefront, hasStoreCapability, isStoreCommerceAvailable } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const store = await getCurrentStorefront();
  if (!isStoreCommerceAvailable(store)) notFound();
  return <section className="section compact-section"><div className="section-head"><p className="eyebrow">Your selection</p><h1 className="page-title">Cart</h1></div><CartView currency={store.currency} nfcEnabled={hasStoreCapability(store, StoreCapability.NFC)} shippingConfig={store.shippingConfig} /></section>;
}
