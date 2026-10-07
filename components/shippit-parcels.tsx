"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Parcel = { id: string; status: string; trackingState: string | null; trackingEventAt: string | null; serviceName: string; trackingNumber: string | null; labelStorageKey: string | null; bookedAt: string | null; parcel: unknown; idempotencyKey: string };

export function ShippitParcels({ orderId, parcels, readyToBook, preparation }: { orderId: string; parcels: Parcel[]; readyToBook: boolean; preparation: { status: string; lastError: string | null } | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function call(url: string, body: object) {
    setPending(true); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Shippit action failed");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Shippit action failed"); }
    finally { setPending(false); }
  }
  return <div className="status-update">
    {parcels.map((parcel, index) => <article key={parcel.id} className="admin-subpanel"><strong>Box {index + 1} · {parcel.serviceName}</strong><p>{parcel.trackingNumber ?? "Remote order requires reconciliation"} · {parcel.trackingState ? `Shippit: ${parcel.trackingState.replaceAll("_", " ")}` : parcel.bookedAt ? "Booked" : parcel.labelStorageKey ? "Label ready" : "Label pending"}{parcel.trackingEventAt ? ` · ${new Date(parcel.trackingEventAt).toLocaleString("en-AU")}` : ""}</p><small>{JSON.stringify(parcel.parcel)} · Reference {parcel.idempotencyKey.split(":").at(-1)?.slice(0, 8)}</small><div className="status-update">{parcel.labelStorageKey && <a href={`/api/admin/shipments/${parcel.id}/document`}>Download official label</a>}{parcel.labelStorageKey && !parcel.bookedAt && <button type="button" disabled={pending || !readyToBook || (preparation !== null && preparation.status !== "COMPLETE")} onClick={() => call(`/api/admin/shipments/${parcel.id}/shippit`, { action: "book" })}>Book carrier</button>}</div></article>)}
    <p className="muted">Packages and labels are prepared automatically from checkout. Book the carrier when production and packing are complete. Shipped and delivered are updated by Shippit.</p>
    {preparation && preparation.status !== "COMPLETE" && <p role="status">Shipping preparation: {preparation.status.toLowerCase()}. {preparation.lastError ?? "Labels are being prepared automatically."}</p>}
    {preparation?.status === "FAILED" && <button type="button" disabled={pending} onClick={() => call(`/api/admin/orders/${orderId}/shippit`, { action: "retry" })}>Retry automatic preparation</button>}
    {message && <p role="alert">{message}</p>}
  </div>;
}
