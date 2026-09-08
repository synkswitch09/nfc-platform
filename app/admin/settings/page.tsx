import { StoreSettingsForm } from "@/components/store-settings-form";
import { requireRole } from "@/lib/auth";
import { getStoreSettings } from "@/lib/settings";

export default async function AdminSettingsPage() {
  await requireRole(["ADMIN"]);
  const settings = await getStoreSettings();
  return <div><div className="admin-heading"><div><p className="admin-kicker">System</p><h1>Settings</h1><p>Store identity, SEO, shipping and public channels.</p></div></div><StoreSettingsForm settings={settings} /></div>;
}
