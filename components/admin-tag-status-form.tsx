"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminTagStatusForm({ tagId, options }: { tagId: string; options: string[] }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  if (!options.length) return <p className="muted">This tag has reached a terminal state.</p>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setMessage("");
    const response = await fetch(`/api/admin/tags/${tagId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), reason: form.get("reason") }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Tag could not be updated");
    router.refresh();
  }
  return <form className="status-update" onSubmit={submit}><select name="status">{options.map(option => <option key={option}>{option}</option>)}</select><input name="reason" minLength={3} maxLength={300} placeholder="Required reason" required /><button className="button">Update tag</button>{message && <span className="form-error">{message}</span>}</form>;
}
