import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreSettings } from "@/lib/settings";
import { getCurrentStorefront, hasStoreCapability, isStoreCommerceAvailable } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const [user, store] = await Promise.all([getCurrentUser(), getCurrentStorefront()]);
  if (!isStoreCommerceAvailable(store)) notFound();
  const [address, settings, zones] = await Promise.all([user ? db.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { recipient: true, company: true, line1: true, line2: true, dependentLocality: true, locality: true, administrativeArea: true, postcode: true, country: true, phone: true } }) : null, getStoreSettings(store), db.shippingZone.findMany({ where: { storeId: store.id, active: true }, select: { countries: true } })]);
  const countries = [...new Set(zones.flatMap(zone => zone.countries))];
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  return <section className="section compact-section"><div className="section-head"><p className="eyebrow">Secure checkout · {settings.storeName}</p><h1 className="page-title">Complete your order</h1><p className="lead">Checkout as a guest or use your signed-in account. {nfcEnabled ? "An account is only required later to activate and manage connected products." : "Your order can be linked securely if you create an account later."}</p></div><CheckoutForm account={user ? { name: user.name, email: user.email, address } : null} store={{ slug: store.slug, displayName: settings.storeName, currency: settings.currency, nfcEnabled }} countries={countries.length ? countries : [store.country]} /></section>;
}
