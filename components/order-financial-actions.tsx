"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderFinancialActions({ orderId, orderNumber, amountCents, currency, canRefund, canRestock, refundId, notificationId }: {
  orderId: string; orderNumber: string; amountCents: number; currency: string; canRefund?: boolean; canRestock?: boolean; refundId?: string; notificationId?: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const amount = new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amountCents / 100);
  async function run(action: "refund" | "restock" | "reconcile" | "resend") {
    if (pending) return;
    if ((action === "refund" || action === "restock") && reason.trim().length < 3) { setMessage("Reason: enter at least 3 characters."); return; }
    const confirmation = action === "refund" ? `Refund the full ${amount} for order ${orderNumber}? Stock will not be returned automatically and tags remain active.`
      : action === "restock" ? `Return the recorded sold stock for ${orderNumber}? Confirm the goods are available for resale; personalised or shipped goods must be checked first.`
      : action === "resend" ? "Send this notice again? The recipient may already have received the previous message." : null;
    if (confirmation && !window.confirm(confirmation)) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/operations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, confirmed: true, reason, orderNumber, amountCents, refundId, notificationId, requestId }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Operation failed"); return; }
      setRequestId(crypto.randomUUID());
      setMessage("Request recorded. Check the updated status below.");
      router.refresh();
    } catch { setMessage("Response uncertain. Refresh and inspect the status before retrying."); }
    finally { setPending(false); }
  }
  return <div className="admin-stack">
    {(canRefund || canRestock) && <label className="field">Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></label>}
    {canRefund && <button type="button" className="button secondary" disabled={pending} onClick={() => run("refund")}>Refund {amount}</button>}
    {canRestock && <button type="button" className="button secondary" disabled={pending} onClick={() => run("restock")}>Return sold stock</button>}
    {refundId && <button type="button" className="text-button" disabled={pending} onClick={() => run("reconcile")}>Check refund with Stripe</button>}
    {notificationId && <button type="button" className="text-button" disabled={pending} onClick={() => run("resend")}>Send again</button>}
    {message && <p role="status">{message}</p>}
  </div>;
}
