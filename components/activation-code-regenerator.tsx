"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";

export function ActivationCodeRegenerator({ tagId, eligible }: { tagId: string; eligible: boolean }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!window.confirm("Generate a new activation code? The previous credential will stop working immediately.")) return;
    setPending(true); setError(""); setCode(""); const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/tags/${tagId}/activation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: form.get("reason"), note: form.get("note"), confirmedIdentity: form.get("confirmedIdentity") === "on" }) });
    const result = await response.json().catch(() => ({})); setPending(false); if (!response.ok) return setError(result.error ?? "Activation code could not be regenerated"); setCode(result.activationCode);
  }
  if (!eligible) return <p className="muted">This tag is already claimed or retired, so it does not accept activation credentials.</p>;
  return <form className="form activation-regenerator" onSubmit={submit}><p className="muted">The current code is never stored in plaintext. Regeneration invalidates it and reveals the replacement once.</p><label className="field">Reason<select name="reason" required><option value="CUSTOMER_LOST_CODE">Customer lost activation code</option><option value="REPLACEMENT">Replacement</option><option value="SUPPORT_REQUEST">Support request</option><option value="OTHER">Other</option></select></label><label className="field">Support note<textarea name="note" minLength={5} maxLength={300} required placeholder="Record how the purchaser or owner was verified" /></label><label className="check-field"><input type="checkbox" name="confirmedIdentity" required /><span>I verified the purchaser or owner using account and order details</span></label><button type="submit" className="button danger" disabled={pending}><KeyRound size={16} /> {pending ? "Generating…" : "Regenerate activation code"}</button>{error && <div className="form-error">{error}</div>}{code && <div className="one-time-secret"><strong>New code — copy it now</strong><code>{code}</code><p>This value will disappear when you leave or refresh this page.</p></div>}</form>;
}
