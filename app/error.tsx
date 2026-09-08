"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error", error.digest ?? "no-digest"); }, [error]);
  return <section className="auth-shell"><div className="auth-card"><h1>Something went wrong</h1><p className="muted">The request could not be completed. No payment or NFC action should be repeated until you check its current status.</p>{error.digest && <p className="muted">Reference: {error.digest}</p>}<button className="button" onClick={reset}>Try again</button></div></section>;
}
