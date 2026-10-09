import { getRuntimeConfig } from "@/lib/config";
import Link from "next/link";
import {AccountProfileForm} from "@/components/account-profile-form";
import { AddressManager } from "@/components/address-manager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

export default async function AccountPage() {
  const [user, store] = await Promise.all([requireUser(), getCurrentStorefront()]); const [addresses, zones] = await Promise.all([db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" },{ createdAt: "asc" }] }), db.shippingZone.findMany({ where: { storeId: store.id, active: true }, select: { countries: true } })]); const profile=await db.user.findUniqueOrThrow({where:{id:user.id},select:{phone:true}});const countries = [...new Set(zones.flatMap(zone => zone.countries))];
  return <section className="dashboard"><Link href="/dashboard" className="muted">← Dashboard</Link><div className="dashboard-head"><div><p className="eyebrow">Account</p><h1>Details & delivery addresses</h1><p className="muted">Manage country-aware delivery addresses for the destinations this Store supports.</p></div></div><AccountProfileForm name={user.name} email={user.email} phone={profile.phone}/><h2>Saved addresses</h2><AddressManager addresses={addresses} defaultName={user.name} countries={countries.length ? countries : [store.country]} autocompleteEnabled={Boolean(store.integrations?.geoapifyEnabled && getRuntimeConfig().geoapifyStores[store.slug])} /></section>;
}
