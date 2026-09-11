import { StoreSettingsForm } from "@/components/store-settings-form";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { StoreCapability } from "@prisma/client";
import { notFound } from "next/navigation";

export default async function AdminSettingsPage() {
  const context = await requireAdminPageContext();
  if (!canManageStore(context)) notFound();
  const [settings, domainRows] = await Promise.all([getStoreSettings(context.store), db.storeDomain.findMany({ where: { storeId: context.store.id }, orderBy: [{ environment: "asc" }, { isPrimary: "desc" }] })]);
  const domains = domainRows.map(({ id, environment, hostname, protocol, port, isPrimary }) => ({ id, environment, hostname, protocol, port, isPrimary }));
  return <div><div className="admin-heading"><div><p className="admin-kicker">System · {context.store.displayName}</p><h1>Store settings</h1><p>Identity, theme, homepage, SEO, domains and enabled modules.</p></div></div><StoreSettingsForm settings={settings} domains={domains} platformAdmin={context.isPlatformAdmin} availableCapabilities={Object.values(StoreCapability)} /></div>;
}
