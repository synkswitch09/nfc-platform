"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimOrderForm({ orderNumber, claimToken }: { orderNumber: string; claimToken: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function claim() {
    setPending(true); setError("");
    const response = await fetch("/api/orders/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber, claimToken }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setPending(false); setError(result.error ?? "Could not claim this order"); return; }
    router.push(`/dashboard/orders/${result.orderId}?claimed=true`); router.refresh();
  }
  return <div className="form"><button type="button" className="button" onClick={claim} disabled={pending}>{pending ? "Linking order…" : "Link order to my account"}</button>{error && <div className="form-error" role="alert">{error}</div>}</div>;
}
