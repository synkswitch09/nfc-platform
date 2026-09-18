import Link from "next/link";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { PetProfileCmsForm } from "@/components/pet-profile-cms-form";
import { notFound } from "next/navigation";

export default async function AdminPetProfilePage() {
  const context = await requireAdminPageContext(); if (!canManageStore(context)) notFound(); const settings = await getStoreSettings(context.store);
  return <div><Link className="admin-back" href="/admin/storefront">← Storefront</Link><div className="admin-heading"><div><p className="admin-kicker">Content · Storefront</p><h1>Pet profile</h1><p>Configure the mobile card shown after someone scans an active pet tag.</p></div></div><PetProfileCmsForm config={settings.petProfileConfig} /></div>;
}
