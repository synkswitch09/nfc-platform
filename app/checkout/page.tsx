import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  return <section className="section compact-section"><div className="section-head"><p className="eyebrow">Secure checkout</p><h1 className="page-title">Complete your order</h1><p className="lead">Checkout as a guest or use your signed-in account. An account is only required later to activate and manage NFC products.</p></div><CheckoutForm account={user ? { name: user.name, email: user.email } : null} /></section>;
}
