"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function EmailVerificationForm({ email, storeName, next, initialSent }: { email: string; storeName: string; next?: string; initialSent: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(initialSent ? "" : "We couldn't send the code. Request a new one below.");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setPending(true);
    try {
      const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error ?? "The code could not be verified");
      router.push(data.destination?.startsWith("/dashboard/orders/") ? data.destination : next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard?verified=true");
      router.refresh();
    } catch { setMessage("Connection failed. Please try again."); }
    finally { setPending(false); }
  }

  async function resend() {
    setMessage(""); setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await response.json();
      if (data.verified) { router.push("/dashboard"); router.refresh(); return; }
      setMessage(response.ok ? "A new code is on its way. Check spam if you don't see it." : data.error ?? "Could not send a new code");
    } catch { setMessage("Connection failed. Please try again."); }
    finally { setResending(false); }
  }

  return <>
    <p className="muted">We sent a six-digit code to <strong>{email}</strong>. Enter it to access your {storeName} account. It expires in 10 minutes.</p>
    <form className="form" onSubmit={verify}>
      <label className="field">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
      {message && <p className="form-error" role="status">{message}</p>}
      <button className="button" disabled={pending || code.length !== 6}>{pending ? "Verifying…" : "Verify email"}</button>
    </form>
    <button className="button secondary" type="button" disabled={resending} onClick={resend}>{resending ? "Sending…" : "Send a new code"}</button>
  </>;
}
