"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationConfig } from "@/lib/integration-config";

export function IntegrationSettingsForm({ config, geoapifyReady, analyticsReady, metaReady, production, origin }: { config: IntegrationConfig; geoapifyReady: boolean; analyticsReady: boolean; metaReady: boolean; production: boolean; origin: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const payload = { ...Object.fromEntries(["geoapifyEnabled", "rememberCheckoutEnabled", "analyticsEnabled", "clarityEnabled", "metaPixelEnabled", "metaCapiEnabled", "metaCatalogEnabled"].map(key => [key, data.get(key) === "on"])), rememberCheckoutDays: Number(data.get("rememberCheckoutDays")), ...Object.fromEntries(["ga4MeasurementId", "clarityProjectId", "metaPixelId", "metaCatalogId"].map(key => [key, String(data.get(key) ?? "").trim()])) };
    try {
      const response = await fetch("/api/admin/settings/integrations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      setMessage(response.ok ? "Integration settings saved for this store" : result.error);
      if (response.ok) router.refresh();
    } catch { setMessage("Settings could not be saved. Please try again."); }
    finally { setPending(false); }
  }
  return <form className="admin-panel form" onSubmit={submit}>
    <h2>Checkout, privacy & integrations</h2><p>Settings apply only to this store. Credentials stay in the secure server configuration.</p>
    <fieldset><legend>Australian address suggestions</legend>
      <label className="check-field"><input type="checkbox" name="geoapifyEnabled" defaultChecked={config.geoapifyEnabled} />Enable Geoapify suggestions</label>
      <p>{geoapifyReady ? "Credential configured. Suggestions are available when enabled." : "Credential needed: configure this store in GEOAPIFY_STORES in Azure. Manual entry remains available."}</p>
      <p className="fine-print">Australia only. Four characters minimum, a short typing delay, five suggestions, and a shared allowance of approximately 2,500 requests per API key per rolling 24 hours. Check usage across all projects in your Geoapify account.</p>
    </fieldset>
    <fieldset><legend>Remember checkout details</legend>
      <label className="check-field"><input type="checkbox" name="rememberCheckoutEnabled" defaultChecked={config.rememberCheckoutEnabled} />Offer optional device storage to guests</label>
      <label className="field">Retention in days<input type="number" name="rememberCheckoutDays" min={1} max={90} defaultValue={config.rememberCheckoutDays} required /></label>
      <p className="fine-print">Guests must opt in. Contact and delivery details are stored in this browser; no payment details. Account addresses are managed separately.</p>
    </fieldset>
    <fieldset><legend>Measurement</legend>
      <label className="field">Google Analytics measurement ID<input name="ga4MeasurementId" defaultValue={config.ga4MeasurementId} placeholder="G-…" maxLength={22} /></label>
      <label className="check-field"><input type="checkbox" name="analyticsEnabled" defaultChecked={config.analyticsEnabled} />Enable consent-based shopping events in production</label>
      <p>{analyticsReady ? "Server credential configured. Events require a measurement ID, production mode and visitor consent." : "Server credential not configured. No analytics events will be sent."}</p>
      {!production && <p className="notice">This environment never sends live analytics or advertising events and never serves the production catalog feed.</p>}
    </fieldset>
    <fieldset><legend>Microsoft Clarity</legend>
      <label className="field">Clarity project ID<input name="clarityProjectId" defaultValue={config.clarityProjectId} maxLength={40} /></label>
      <label className="check-field"><input type="checkbox" name="clarityEnabled" defaultChecked={config.clarityEnabled} />Enable recordings after analytics consent</label>
      <p className="fine-print">Anonymous home, shop, FAQ and policy browsing only. All text is masked. Checkout, products with personalisation, accounts, orders, tickets, administration and NFC profiles are excluded. Select strict masking and require consent in Clarity too.</p>
    </fieldset>
    <fieldset><legend>Meta advertising</legend>
      <label className="field">Meta Pixel / dataset ID<input name="metaPixelId" defaultValue={config.metaPixelId} maxLength={30} /></label>
      <label className="check-field"><input type="checkbox" name="metaPixelEnabled" defaultChecked={config.metaPixelEnabled} />Enable Meta Pixel after advertising consent</label>
      <label className="check-field"><input type="checkbox" name="metaCapiEnabled" defaultChecked={config.metaCapiEnabled} />Enable Conversions API after advertising consent</label>
      <p>{metaReady ? "Matching Conversions API credential configured." : "Conversions API needs this store’s matching dataset ID and access token in META_CONVERSIONS_STORES in Azure."}</p>
      <p className="fine-print">Pixel and server events share an event ID. Payment-confirmed purchases are measured once per order. Personalised text and contact details are never sent. Refunds are recorded in GA4; Meta has no standard ecommerce Refund event.</p>
    </fieldset>
    <fieldset><legend>Meta catalog</legend>
      <label className="field">Meta catalog ID<input name="metaCatalogId" defaultValue={config.metaCatalogId} maxLength={30} /></label>
      <label className="check-field"><input type="checkbox" name="metaCatalogEnabled" defaultChecked={config.metaCatalogEnabled} />Publish this store’s production catalog feed</label>
      <p className="fine-print">In Commerce Manager, add a scheduled data feed using the URL below, choose a complete replacement feed, and schedule daily or hourly updates. New products and changes are included automatically at the next Meta import. Products without a public image or valid price are omitted.</p>
      {origin ? <label className="field">Production feed URL<input readOnly value={`${origin}/api/meta/catalog`} /></label> : <p>Open this store’s production CMS to copy its feed URL. This environment has no verified production domain.</p>}
      {production && config.metaCatalogEnabled && <a className="text-button" href="/api/meta/catalog" target="_blank" rel="noreferrer">View current catalog feed</a>}
      <a className="text-button" href="/admin/settings/measurement">View measurement delivery status</a>
    </fieldset>
    <button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save integration settings"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
