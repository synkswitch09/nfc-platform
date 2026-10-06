"use client";
import { FormEvent, useState } from "react";
export function OrderSupportForm({ orderId, claimToken }: { orderId: string; claimToken?: string }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setResult("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/orders/${orderId}/support`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: form.get("kind"), message, claimToken }) });
    const body = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setResult(body.error ?? "Could not send your request");
    setMessage(""); setResult("Your request has been sent to the store. We will reply by email.");
  }
  return <section className="card"><h2>Need help with this order?</h2><p>Ask about changes, delivery or quality. A cancellation request will be reviewed by the store.</p><form onSubmit={submit}><label className="field">Topic<select name="kind"><option value="ORDER_CHANGE">Change order</option><option value="CANCELLATION_REQUEST">Request cancellation</option><option value="DELIVERY">Delivery</option><option value="QUALITY">Quality issue</option><option value="OTHER">Other</option></select></label><label className="field">Message<textarea value={message} minLength={10} maxLength={2000} onChange={event => setMessage(event.target.value)} required /></label><button className="button secondary" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>{result && <p role="status">{result}</p>}</form></section>;
}
