"use client";
import { useAdminRequest } from "@/components/admin-form-feedback";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShipmentActions({ orderId, shipmentId }: { orderId: string; shipmentId?: string }) {
  const { request: adminRequest, feedbackRef, feedback } = useAdminRequest();

  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function act(url: string) {
    setPending(true); setMessage("");
    const response = await adminRequest(url, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Shipping action failed");
    setMessage(shipmentId ? "Reprint queued" : result.created ? "Label created and queued" : "Existing label retained");
    router.refresh();
  }
  return <div ref={node => { feedbackRef.current = node; }} className="status-update">{feedback}<button className="button" type="button" disabled={pending} onClick={() => act(shipmentId ? `/api/admin/shipments/${shipmentId}/reprint` : `/api/admin/orders/${orderId}/shipment`)}>{pending ? "Working…" : shipmentId ? "Queue label reprint" : "Create label & queue print"}</button>{message && <span className={message.includes("failed") ? "form-error" : "notice"}>{message}</span>}</div>;
}
