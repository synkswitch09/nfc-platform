"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GiftPackingButton({ orderId, giftId }: { orderId: string; giftId: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function pack() { setBusy(true); try { const r = await fetch(`/api/admin/orders/${orderId}/gifts/${giftId}/pack`, { method: "POST" }); if (!r.ok) setError((await r.json()).error); else router.refresh(); } catch { setError("Please retry"); } finally { setBusy(false); } }
  return <><button type="button" disabled={busy} onClick={() => void pack()}>{busy ? "Saving…" : "Confirm gift packed"}</button>{error && <p role="alert">{error}</p>}</>;
}
