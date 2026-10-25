"use client";
import { useAdminRequest } from "@/components/admin-form-feedback";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManufacturingStatusForm({ tagId, next }: { tagId: string; next?: string }) {
  const { request: adminRequest, feedbackRef, feedback } = useAdminRequest();

  const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  if (!next) return <span className="muted">Production lifecycle complete</span>;
  async function advance() {
    setPending(true); setMessage("");
    const response = await adminRequest(`/api/admin/tags/${tagId}/manufacturing`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Tag could not be updated");
    router.refresh();
  }
  return <span ref={node => { feedbackRef.current = node; }} className="manufacturing-action">{feedback}<button className="button secondary" type="button" onClick={advance} disabled={pending}>{pending ? "Updating…" : `Mark ${next!.replaceAll("_", " ")}`}</button>{message && <small className="form-error">{message}</small>}</span>;
}
