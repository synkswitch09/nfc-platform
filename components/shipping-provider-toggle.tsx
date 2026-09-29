"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShippingProviderToggle({ provider }: { provider: { id: string; name: string; kind: string; active: boolean; supportsRates: boolean; supportsLabels: boolean } }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  async function toggle() { setPending(true); setMessage(""); const response = await fetch(`/api/admin/shipping/providers/${provider.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !provider.active }) }); const result = await response.json().catch(() => ({})); setPending(false); if (!response.ok) return setMessage(result.error ?? "Provider could not be updated"); router.refresh(); }
  return <div className="shipping-provider-row"><span><strong>{provider.name}</strong><small>{provider.kind} · Rates {provider.supportsRates ? "on" : "off"} · Labels {provider.supportsLabels ? "on" : "off"}</small></span><button className="button secondary" type="button" onClick={toggle} disabled={pending}>{pending ? "Updating…" : provider.active ? "Disable" : "Enable"}</button>{message && <span className="upload-error">{message}</span>}</div>;
}
