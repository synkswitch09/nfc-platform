"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function OrderStatusForm({ orderId, options }: { orderId: string; options: string[] }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const [selected, setSelected] = useState(options[0] ?? "");
  if (!options.length) return <p className="muted">No further operational transition is available.</p>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/orders/${orderId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), note: form.get("note"), carrier: form.get("carrier"), trackingNumber: form.get("trackingNumber") }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Order could not be updated");
    router.refresh();
  }
  return <form className="status-update" onSubmit={submit}><select name="status" aria-label="Next status" value={selected} onChange={event => setSelected(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select>{selected === "SHIPPED" && <><input name="carrier" placeholder="Carrier" maxLength={80} required /><input name="trackingNumber" placeholder="Tracking number" maxLength={100} required /></>}<input name="note" placeholder="Optional internal note" maxLength={500} /><button className="button" disabled={pending}>{pending ? "Updating…" : "Update status"}</button>{message && <span className="form-error">{message}</span>}</form>;
}
