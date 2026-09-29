"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function TagLostModeControl({ tagId, status }: { tagId: string; status: "ACTIVE" | "LOST" }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const lost = status === "LOST";
  async function update() {
    const next = lost ? "ACTIVE" : "LOST";
    if (!lost && !window.confirm("Report your pet as lost? Anyone who scans the tag will see the lost alert and contact actions.")) return;
    setPending(true); setMessage(""); const response = await fetch(`/api/tags/${tagId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }); const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Lost mode could not be updated");
    router.refresh();
  }
  return <section className={`card lost-mode-control ${lost ? "is-lost" : ""}`}><div className="lost-mode-heading">{lost ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}<div><h3>{lost ? "Lost mode is on" : "Lost mode"}</h3><p>{lost ? "People who scan this tag are being asked to contact you." : "Turn this on only when your pet is missing."}</p></div></div><button className={`button ${lost ? "secondary" : "danger"}`} type="button" onClick={update} disabled={pending}>{pending ? "Updating…" : lost ? "My pet is safe — turn off lost mode" : "Report pet as lost"}</button>{message && <p className="form-error" role="status">{message}</p>}</section>;
}
