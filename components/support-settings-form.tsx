"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupportConfig } from "@/lib/support-config";
export function SupportSettingsForm({ config, timezone }: { config: SupportConfig; timezone: string }) {
  const [message, setMessage] = useState(""), [pending, setPending] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const form = new FormData(event.currentTarget);
    try {
      const payload = { guestEnabled: form.get("guestEnabled") === "on", autoPause: form.get("autoPause") === "on", firstResponseBusinessDays: Number(form.get("days")), holidays: String(form.get("holidays") ?? "").split(/[\s,]+/).filter(Boolean), notificationEmails: String(form.get("emails") ?? "").split(/[\s,;]+/).filter(Boolean) };
      const response = await fetch("/api/admin/support/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); setMessage(response.ok ? "Support settings saved" : result.error); if (response.ok) router.refresh();
    } catch { setMessage("Could not save support settings"); } finally { setPending(false); }
  }
  return <form className="admin-panel form" onSubmit={submit}><h2>Support & requests</h2><p>Tickets are the customer service channel. Configuration applies to new tickets; existing deadlines and active pauses remain unchanged.</p><label className="check-field"><input name="guestEnabled" type="checkbox" defaultChecked={config.guestEnabled} /> Allow guests to verify email and use tickets without an account</label><label className="check-field"><input name="autoPause" type="checkbox" defaultChecked={config.autoPause} /> Automatically pause eligible orders for verified change or cancellation requests</label><label className="field">First-response target (business days)<input name="days" type="number" min={1} max={30} defaultValue={config.firstResponseBusinessDays} required /></label><p>Deadlines exclude weekends and the dates below, at 5 pm in {timezone}. This is a response target, not a guarantee of resolution.</p><label className="field">Store holidays (YYYY-MM-DD, one per line)<textarea name="holidays" defaultValue={config.holidays.join("\n")} placeholder="2026-12-25" /></label><label className="field">Internal alert recipients (up to 5 emails)<textarea name="emails" defaultValue={config.notificationEmails.join("\n")} placeholder="One email per line" /></label><p>Leave empty to manage alerts only through the CMS inbox. These addresses receive new-ticket and follow-up alerts; customers still contact you through tickets.</p><button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save support settings"}</button>{message && <p role="status">{message}</p>}</form>;
}
