import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const [address, settings] = await Promise.all([user ? db.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { recipient: true, line1: true, line2: true, suburb: true, state: true, postcode: true } }) : null, getStoreSettings()]);
  return <section className="section compact-section"><div className="section-head"><p className="eyebrow">Secure checkout</p><h1 className="page-title">Complete your order</h1><p className="lead">Checkout as a guest or use your signed-in account. An account is only required later to activate and manage NFC products.</p></div><CheckoutForm account={user ? { name: user.name, email: user.email, address } : null} shippingConfig={{ flatRateCents: settings.shippingConfig.flatRateCents ?? 900, freeOverCents: settings.shippingConfig.freeOverCents ?? 6000 }} /></section>;
}
