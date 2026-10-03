"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function AdminSupportAction({ requestId, status, adminNote }: { requestId: string; status: string; adminNote: string | null }) {
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/support/${requestId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), note: form.get("note"), notifyCustomer: form.get("notify") === "on" }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setError(result.error ?? "Could not save"); router.refresh();
  }
  return <form onSubmit={submit} className="admin-stack"><label className="field">Status<select name="status" defaultValue={status}><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option></select></label><label className="field">Response / internal note<textarea name="note" defaultValue={adminNote ?? ""} maxLength={2000} /></label><label className="check-field"><input name="notify" type="checkbox" /> Email this response to customer</label><button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>{error && <p role="alert" className="form-error">{error}</p>}</form>;
}
