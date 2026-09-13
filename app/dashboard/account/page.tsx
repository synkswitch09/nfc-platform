import Link from "next/link";
import { AddressManager } from "@/components/address-manager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

export default async function AccountPage() {
  const [user, store] = await Promise.all([requireUser(), getCurrentStorefront()]); const [addresses, zones] = await Promise.all([db.address.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }), db.shippingZone.findMany({ where: { storeId: store.id, active: true }, select: { countries: true } })]); const countries = [...new Set(zones.flatMap(zone => zone.countries))];
  return <section className="dashboard"><Link href="/dashboard" className="muted">← Dashboard</Link><div className="dashboard-head"><div><p className="eyebrow">Account</p><h1>Delivery addresses</h1><p className="muted">Manage country-aware delivery addresses for the destinations this Store supports.</p></div></div><AddressManager addresses={addresses} defaultName={user.name} countries={countries.length ? countries : [store.country]} /></section>;
}
