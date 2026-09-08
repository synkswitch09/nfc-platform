"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ActivateForm() {
  const router = useRouter(); const search = useSearchParams();
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/tags/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setError(data.error ?? "Activation failed");
    router.push(`/dashboard/tags/${data.tagId}`); router.refresh();
  }
  return <form className="form" onSubmit={submit}>
    <label className="field">Tag ID<input name="publicTagId" defaultValue={search.get("tag") ?? ""} placeholder="X7K29PFQ" autoCapitalize="characters" required /></label>
    <label className="field">Activation code<input name="activationCode" placeholder="ABCD-EFGH-JKLM" autoCapitalize="characters" required /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button" disabled={pending}>{pending ? "Checking…" : "Activate tag"}</button>
  </form>;
}
