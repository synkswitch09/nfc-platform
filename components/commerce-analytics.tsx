"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CommerceEvent =
  | { event: "view_item"; productId: string }
  | { event: "begin_checkout"; items: { variantId: string; quantity: number }[] }
  | { event: "purchase"; orderId: string; claimToken?: string };

const consentKey = (store: string) => `commerce-analytics-consent:${store}`;
const clientKey = (store: string) => `commerce-analytics-client:${store}`;
const sentKey = (store: string, orderId: string) => `commerce-analytics-purchase:${store}:${orderId}`;
const inFlight = new Set<string>();

function clientId(store: string) {
  let id = sessionStorage.getItem(clientKey(store));
  if (!id) {
    const values = crypto.getRandomValues(new Uint32Array(2));
    id = `${values[0]}.${values[1]}`;
    sessionStorage.setItem(clientKey(store), id);
  }
  return id;
}

export function AnalyticsConsent({ store }: { store: string }) {
  const [choice, setChoice] = useState<"loading" | "yes" | "no" | "unknown">("loading");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(consentKey(store));
    setChoice(stored === "yes" || stored === "no" ? stored : "unknown");
  }, [store]);
  const choose = (value: "yes" | "no") => {
    localStorage.setItem(consentKey(store), value);
    setChoice(value);
    setOpen(false);
    window.dispatchEvent(new Event("commerce-analytics-consent"));
  };
  if (choice === "loading") return null;
  if (choice !== "unknown" && !open) return <button className="analytics-settings-link" type="button" onClick={() => setOpen(true)}>Analytics settings</button>;
  return <aside className="analytics-consent" aria-label="Optional analytics">
    <p>Help us understand product views and purchases. With your permission, we send limited shopping events to Google Analytics. We do not send contact details, tag IDs or page URLs. <Link href="/privacy">Privacy policy</Link></p>
    <div><button className="button secondary" type="button" onClick={() => choose("no")}>Decline</button><button className="button" type="button" onClick={() => choose("yes")}>Allow analytics</button></div>
  </aside>;
}

export function CommerceAnalyticsEvent({ store, data }: { store: string; data: CommerceEvent }) {
  const eventData = JSON.stringify(data);
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const record = async (attempt = 0) => {
      if (cancelled) return;
      const data = JSON.parse(eventData) as CommerceEvent;
      if (localStorage.getItem(consentKey(store)) !== "yes") return;
      const key = data.event === "purchase" ? sentKey(store, data.orderId) : null;
      if (key && (localStorage.getItem(key) || inFlight.has(key))) return;
      if (key) inFlight.add(key);
      try {
        const response = await fetch("/api/analytics", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...data, clientId: clientId(store) }),
          referrerPolicy: "no-referrer", credentials: "same-origin",
        });
        if (key && response.ok) localStorage.setItem(key, "yes");
        if (key && response.status === 409 && attempt < 10 && !cancelled) retry = setTimeout(() => void record(attempt + 1), 3_000);
      } catch { /* Optional measurement must not interrupt checkout. */ }
      finally { if (key) inFlight.delete(key); }
    };
    const onConsent = () => void record();
    void record();
    window.addEventListener("commerce-analytics-consent", onConsent);
    return () => { cancelled = true; if (retry) clearTimeout(retry); window.removeEventListener("commerce-analytics-consent", onConsent); };
  }, [store, eventData]);
  return null;
}
