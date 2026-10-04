"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Parcel = { id: string; status: string; serviceName: string; trackingNumber: string | null; labelStorageKey: string | null; bookedAt: string | null; parcel: unknown; idempotencyKey: string };

export function ShippitParcels({ orderId, parcels, enabled }: { orderId: string; parcels: Parcel[]; enabled: boolean }) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function call(url: string, body: object) {
    setPending(true); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Shippit action failed");
      if (url.endsWith("/shippit") && "parcel" in body) setRequestId(crypto.randomUUID());
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Shippit action failed"); }
    finally { setPending(false); }
  }
  return <div className="status-update">
    {parcels.map((parcel, index) => <article key={parcel.id} className="admin-subpanel"><strong>Box {index + 1} · {parcel.serviceName}</strong><p>{parcel.trackingNumber ?? "Remote order requires reconciliation"} · {parcel.bookedAt ? "Booked" : parcel.labelStorageKey ? "Label ready" : "Label pending"}</p><small>{JSON.stringify(parcel.parcel)} · Reference {parcel.idempotencyKey.split(":").at(-1)?.slice(0, 8)}</small><div className="status-update">{parcel.labelStorageKey && <a href={`/api/admin/shipments/${parcel.id}/document`}>Download official label</a>}{parcel.trackingNumber && !parcel.labelStorageKey && <button type="button" disabled={pending} onClick={() => call(`/api/admin/shipments/${parcel.id}/shippit`, { action: "label" })}>Get label</button>}{parcel.labelStorageKey && !parcel.bookedAt && <button type="button" disabled={pending} onClick={() => call(`/api/admin/shipments/${parcel.id}/shippit`, { action: "book" })}>Book carrier</button>}</div></article>)}
    {enabled && <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const number = (key: string) => Number(form.get(key)); void call(`/api/admin/orders/${orderId}/shippit`, { requestId, service: form.get("service"), parcel: { weightGrams: number("weightGrams"), lengthMm: number("lengthMm"), widthMm: number("widthMm"), heightMm: number("heightMm") } }); }}><h3>Add packed box</h3><p className="muted">Confirm the actual weight and outer dimensions. Each box creates a separate Shippit booking and may incur its own charge.</p><label>Service <select name="service"><option value="standard">Standard</option><option value="express">Express</option></select></label><label>Weight (g) <input name="weightGrams" type="number" min="1" max="30000" required /></label><label>Length (mm) <input name="lengthMm" type="number" min="1" max="1000" required /></label><label>Width (mm) <input name="widthMm" type="number" min="1" max="1000" required /></label><label>Height (mm) <input name="heightMm" type="number" min="1" max="1000" required /></label><button className="button" disabled={pending}>Create Shippit order for this box</button></form>}
    {message && <p role="alert">{message}</p>}
  </div>;
}
