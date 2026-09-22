import { StoreSettingsForm } from "@/components/store-settings-form";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { StoreCapability } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isStoreResetAllowed } from "@/lib/store-reset";

export default async function AdminSettingsPage() {
  const context = await requireAdminPageContext();
  if (!canManageStore(context)) notFound();
  const [settings, domainRows] = await Promise.all([
    getStoreSettings(context.store),
    db.storeDomain.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ environment: "asc" }, { isPrimary: "desc" }],
    }),
  ]);
  const domains = domainRows.map(
    ({ id, environment, hostname, protocol, port, isPrimary }) => ({
      id,
      environment,
      hostname,
      protocol,
      port,
      isPrimary,
    }),
  );
  return (
    <div>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">System · {context.store.displayName}</p>
          <h1>Store settings</h1>
          <p>
            Business identity, base theme, SEO, shipping, domains and enabled
            modules. Storefront content lives under Content.
          </p>
        </div>
      </div>
      <StoreSettingsForm
        settings={settings}
        domains={domains}
        platformAdmin={context.isPlatformAdmin}
        availableCapabilities={Object.values(StoreCapability)}
      />
      {isStoreResetAllowed() && <section className="admin-panel danger-panel">
        <div className="panel-heading">
          <div>
            <h2>Start fresh</h2>
            <p>Clear test catalog, NFC and order history for this store and create one out-of-stock Pets product.</p>
          </div>
          <Link className="button secondary" href="/admin/settings/reset">Open reset tool</Link>
        </div>
      </section>}
      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Storefront releases</h2>
            <p>Export approved storefront content from Development, then preview and import it in another environment.</p>
          </div>
          <Link className="button secondary" href="/admin/settings/releases">Manage releases</Link>
        </div>
      </section>
    </div>
  );
}
