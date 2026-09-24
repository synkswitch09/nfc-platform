"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ProductionActions({ jobId, next }: { jobId: string; next: string[] }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  if (!next.length) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/manufacturing/jobs/${jobId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), reason: form.get("reason") }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setError(result.error ?? "Could not update production");
    router.refresh();
  }
  return <form className="status-update" onSubmit={submit}><select name="status" aria-label="Next production stage">{next.map(status => <option key={status}>{status}</option>)}</select><input name="reason" placeholder="Reason if failed" maxLength={500} /><button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Advance"}</button>{error && <span className="form-error" role="alert">{error}</span>}</form>;
}

export function PackingAction({ orderId, itemId, quantity, packedQuantity, requiresNfc }: { orderId: string; itemId: string; quantity: number; packedQuantity: number; requiresNfc: boolean }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/orders/${orderId}/items/${itemId}/pack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantity: Number(form.get("quantity")), tagIds: String(form.get("tags") ?? "").split(/[\s,]+/).filter(Boolean), removeTagIds: String(form.get("removeTags") ?? "").split(/[\s,]+/).filter(Boolean) }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setError(result.error ?? "Could not record packing");
    router.refresh();
  }
  return <form className="status-update" onSubmit={submit}><label>Packed quantity <input type="number" name="quantity" min={0} max={quantity} defaultValue={packedQuantity} required /></label>{requiresNfc && <><label>Additional verified NFC IDs <input name="tags" placeholder="One public ID per new unit" /></label><label>Remove assigned NFC IDs <input name="removeTags" placeholder="IDs to return to available stock" /></label></>}<button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Record packing"}</button>{error && <span className="form-error" role="alert">{error}</span>}</form>;
}
