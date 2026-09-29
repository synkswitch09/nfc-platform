"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function PrintAgentRegistration() {
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const [token, setToken] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); setToken("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/shipping/print-agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), printerName: data.get("printerName") || undefined }) });
    const result = await response.json().catch(() => ({})); setPending(false);
    if (!response.ok) return setMessage(result.error ?? "Print agent could not be registered");
    setToken(result.token); setMessage("Agent registered. Copy this credential now; it will not be shown again."); router.refresh(); event.currentTarget.reset();
  }
  return <form className="status-update" onSubmit={submit}><input name="name" placeholder="Agent name" maxLength={80} required /><input name="printerName" placeholder="Operating-system printer name" maxLength={120} /><button className="button" disabled={pending}>{pending ? "Registering…" : "Register print agent"}</button>{message && <span className={token ? "notice" : "form-error"}>{message}</span>}{token && <output className="one-time-secret"><code>{token}</code></output>}</form>;
}
