"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function AdminSupportAction({ requestId, status, priority, adminNote, holdActive, updatedAt }: { requestId: string; status: string; priority: string; adminNote: string | null; holdActive: boolean; updatedAt: string }) {
  const [error, setError] = useState(""), [pending, setPending] = useState(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true); const form = event.currentTarget, data = new FormData(form);
    try {
      const response = await fetch(`/api/admin/support/${requestId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: data.get("status"), priority: data.get("priority"), note: data.get("note"), response: data.get("response"), notifyCustomer: data.get("notify") === "on", releaseHold: data.get("releaseHold") === "on", releaseReason: data.get("releaseReason") || undefined, expectedUpdatedAt: updatedAt }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Could not save"); return; }
      form.reset(); router.refresh();
    } catch { setError("Could not save. Please refresh and try again."); } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="admin-stack"><label className="field">Status<select name="status" defaultValue={status}><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option></select></label><label className="field">Priority<select name="priority" defaultValue={priority}><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label className="field">Internal note (private)<textarea name="note" defaultValue={adminNote ?? ""} maxLength={4000} /></label><label className="field">Reply to customer (visible in ticket)<textarea name="response" maxLength={4000} /></label><label className="check-field"><input name="notify" type="checkbox" defaultChecked /> Also email the customer reply</label>{holdActive && <fieldset><legend>Preparation pause</legend><p>Review the request before allowing work to resume. A refund or cancellation is handled separately with the appropriate permissions. Other active ticket pauses remain in force.</p><label className="check-field"><input name="releaseHold" type="checkbox" /> Release this ticket’s preparation pause</label><label className="field">Reason for releasing the pause<textarea name="releaseReason" minLength={10} maxLength={500} /></label></fieldset>}<button className="button secondary" disabled={pending}>{pending ? "Saving…" : "Save ticket"}</button>{error && <p role="alert" className="form-error">{error}</p>}</form>;
}
