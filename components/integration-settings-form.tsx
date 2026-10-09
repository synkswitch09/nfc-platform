"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationConfig } from "@/lib/integration-config";

export function IntegrationSettingsForm({ config, geoapifyReady, analyticsReady }: { config: IntegrationConfig; geoapifyReady: boolean; analyticsReady: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const payload = { ...Object.fromEntries(["geoapifyEnabled", "rememberCheckoutEnabled", "analyticsEnabled"].map(key => [key, data.get(key) === "on"])), rememberCheckoutDays: Number(data.get("rememberCheckoutDays")), ...Object.fromEntries(["ga4MeasurementId", "clarityProjectId", "metaPixelId", "metaCatalogId"].map(key => [key, String(data.get(key) ?? "").trim()])) };
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
      <p className="fine-print">The following IDs prepare the next integration phase. Saving them does not load scripts, send advertising events or synchronise products.</p>
      {([ ["clarityProjectId", "Microsoft Clarity project ID"], ["metaPixelId", "Meta Pixel ID"], ["metaCatalogId", "Meta catalog ID"] ] as const).map(([key, label]) => <label className="field" key={key}>{label}<input name={key} defaultValue={config[key]} maxLength={key === "clarityProjectId" ? 40 : 30} /></label>)}
    </fieldset>
    <button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save integration settings"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
