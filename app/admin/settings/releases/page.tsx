import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontReleaseManager } from "@/components/storefront-release-manager";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";

export default async function StorefrontReleasesPage() {
  const context = await requireAdminPageContext();
  if (!canManageStore(context)) notFound();
  return <div><Link className="admin-back" href="/admin/settings">← Store settings</Link><div className="admin-heading"><div><p className="admin-kicker">System · Content promotion</p><h1>Storefront releases</h1><p>Move approved catalog and CMS content between environments without moving customers, orders, payments or NFC operations.</p></div></div><StorefrontReleaseManager /></div>;
}
