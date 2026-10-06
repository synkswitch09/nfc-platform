"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProductionSettingsForm({ weekly, days, paused }: { weekly: number; days: number; paused: boolean }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/production", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ weeklyCapacityMinutes: Number(form.get("weekly")), maxBusinessDays: Number(form.get("days")), paused: form.get("paused") === "on" }) });
    const body = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setError(body.error ?? "Could not save capacity");
    router.refresh();
  }
  return <form onSubmit={save} className="field-grid three"><label className="field">Minutes per week<input name="weekly" type="number" min="30" max="10080" defaultValue={weekly} required /></label><label className="field">Maximum business days<input name="days" type="number" min="1" max="60" defaultValue={days} required /></label><label className="check-field"><input name="paused" type="checkbox" defaultChecked={paused} /> Pause new made-to-order bookings</label><button className="button" disabled={saving}>{saving ? "Saving…" : "Save capacity"}</button>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}
