"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProductionBatchAction({ count, version }: { count: number; version: number }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function decide(decision: "KEEP" | "UPDATE_AND_NOTIFY") {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/production/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, expectedVersion: version }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(body.error ?? "Could not save decision"); router.refresh();
  }
  return <div className="admin-panel"><h2>{count} orders at risk of a later dispatch date</h2><p>Review the previous and recalculated dates below. Apply one decision to the affected orders.</p><div className="actions"><button type="button" className="button secondary" disabled={busy} onClick={() => void decide("KEEP")}>Keep promised dates; no email</button><button type="button" className="button" disabled={busy} onClick={() => void decide("UPDATE_AND_NOTIFY")}>Update dates and notify all</button></div>{error && <p role="alert" className="form-error">{error}</p>}</div>;
}
