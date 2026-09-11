"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthForm({ mode, storeName }: { mode: "login" | "register"; storeName: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isLogin = mode === "login";
  const next = search.get("next");
  const oauthNext = next?.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    if (!isLogin && search.get("order") && search.get("claim")) {
      body.orderNumber = search.get("order")!;
      body.orderClaimToken = search.get("claim")!;
    }
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setError(data.error ?? "Something went wrong");
    router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return <><div className="oauth-grid"><a className="oauth-button" href={`/api/auth/oauth/google/start${oauthNext}`}><span>G</span> Continue with Google</a><a className="oauth-button dark" href={`/api/auth/oauth/apple/start${oauthNext}`}><span>●</span> Continue with Apple</a></div><div className="auth-divider"><span>or use email</span></div>{search.get("oauth") && <div className="form-error" role="alert">{search.get("oauth") === "unavailable" ? "That sign-in provider is not configured yet." : "Social sign-in could not be completed. Please try again."}</div>}<form className="form" onSubmit={submit}>
    {!isLogin && <label className="field">Name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>}
    <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
    <label className="field">Password<input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? 1 : 12} required /></label>
    {!isLogin && <p className="muted">Use 12+ characters with upper and lowercase letters and a number.</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button" disabled={pending}>{pending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}</button>
    {isLogin && <Link className="muted" href="/forgot-password"><u>Forgot password?</u></Link>}
    <p className="muted">{isLogin ? `New to ${storeName}? ` : "Already have an account? "}<Link href={isLogin ? "/register" : "/login"}><u>{isLogin ? "Create an account" : "Sign in"}</u></Link></p>
  </form></>;
}
