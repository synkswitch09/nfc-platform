"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerStatusForm({ userId, current }: { userId: string; current: string }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/customers/${userId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status") }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Customer could not be updated");
    setMessage("Account updated"); router.refresh();
  }
  return <form className="status-update" onSubmit={submit}><select name="status" defaultValue={current}><option>ACTIVE</option><option>SUSPENDED</option><option>DISABLED</option></select><button className="button">Save account</button>{message && <span className={message === "Account updated" ? "notice" : "form-error"}>{message}</span>}</form>;
}
