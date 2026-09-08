"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BuyButton({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function checkout() {
    setPending(true); setMessage("");
    const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ variantId, quantity: 1 }] }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (response.status === 401) { router.push("/login?next=/shop"); return; }
    if (!response.ok) return setMessage(result.error ?? "Checkout unavailable");
    window.location.href = result.url;
  }
  return <><button className="button" onClick={checkout} disabled={pending}>{pending ? "Starting checkout…" : "Buy now"}</button>{message && <p className="form-error">{message}</p>}</>;
}
