import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return <section className="section compact-section"><div className="section-head"><p className="eyebrow">Your selection</p><h1 className="page-title">Cart</h1></div><CartView /></section>;
}
