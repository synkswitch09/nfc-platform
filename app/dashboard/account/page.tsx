import Link from "next/link";
import { AddressManager } from "@/components/address-manager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AccountPage() {
  const user = await requireUser(); const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return <section className="dashboard"><Link href="/dashboard" className="muted">← Dashboard</Link><div className="dashboard-head"><div><p className="eyebrow">Account</p><h1>Delivery addresses</h1><p className="muted">Manage the Australian addresses saved to your account.</p></div></div><AddressManager addresses={addresses} defaultName={user.name} /></section>;
}
