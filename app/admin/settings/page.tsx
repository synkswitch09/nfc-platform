import { measurementAvailability } from "@/lib/measurement";
import { SupportSettingsForm } from "@/components/support-settings-form";
import { parseSupportConfig } from "@/lib/support-config";
import { IntegrationSettingsForm } from "@/components/integration-settings-form";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { getRuntimeConfig } from "@/lib/config";
import { EmailSendersForm } from "@/components/email-senders-form";
import { parseEmailSenders, senderDomain, defaultStoreSender } from "@/lib/email-senders";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { parseAccountConfig } from "@/lib/account-config";
import { StoreSettingsForm } from "@/components/store-settings-form";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { StoreCapability } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { storeDomainOrigin } from "@/lib/storefront";
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
  const runtime = getRuntimeConfig();
  const integrations = parseIntegrationConfig(context.store.integrations);
  const ready = measurementAvailability(context.store.slug, integrations);
  const productionDomain = domainRows.find(d => d.environment === "PRODUCTION" && d.isPrimary);
  const catalogOrigin = productionDomain ? storeDomainOrigin(productionDomain) : context.store.origin;
  const fallbackSender = defaultStoreSender(domainRows);
  const senders = parseEmailSenders(parseAccountConfig(context.store.accountConfig).emailSenders, fallbackSender, context.store.displayName);
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
      <IntegrationSettingsForm config={parseIntegrationConfig(context.store.integrations)} geoapifyReady={Boolean(runtime.geoapifyStores[context.store.slug])} analyticsReady={ready.ga4} metaReady={ready.capi} production={runtime.appEnv === "production"} origin={catalogOrigin} />
      <EmailSendersForm senders={senders} domain={senderDomain(fallbackSender)} />
      <SupportSettingsForm config={parseSupportConfig(context.store.accountConfig)} timezone={context.store.timezone} />
      <AccountSettingsForm config={parseAccountConfig(context.store.accountConfig)} />
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
