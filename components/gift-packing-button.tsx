"use client";
import { useAdminRequest } from "@/components/admin-form-feedback";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GiftPackingButton({
  orderId,
  giftId,
  action = "PACK",
}: {
  orderId: string;
  giftId: string;
  action?: "PACK" | "PRINT";
}) {
  const { request: adminRequest, feedbackRef, feedback } = useAdminRequest();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function pack() {
    setBusy(true);
    try {
      const r = await adminRequest(
        `/api/admin/orders/${orderId}/gifts/${giftId}/pack`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) },
      );
      if (!r.ok) setError((await r.json()).error);
      else router.refresh();
    } catch {
      setError("Please retry");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div ref={node => { feedbackRef.current = node; }} style={{ display: "contents" }}>{feedback}
      <button type="button" disabled={busy} onClick={() => void pack()}>
        {busy ? "Saving…" : action === "PRINT" ? "Confirm gift printed and checked" : "Confirm gift packed"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
