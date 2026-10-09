"use client";

import { useEffect } from "react";
import { privacyEvent, readPrivacyPreferences } from "@/lib/privacy-preferences";

type CommerceEvent =
  | { event: "view_item"; productId: string }
  | { event: "begin_checkout"; items: { variantId: string; quantity: number }[] }
  | { event: "purchase"; orderId: string; claimToken?: string };

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

export function CommerceAnalyticsEvent({ store, data }: { store: string; data: CommerceEvent }) {
  const eventData = JSON.stringify(data);
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let controller = new AbortController();
    const record = async (attempt = 0) => {
      if (cancelled) return;
      const data = JSON.parse(eventData) as CommerceEvent;
      if (!readPrivacyPreferences(store)?.analytics) return;
      const key = data.event === "purchase" ? sentKey(store, data.orderId) : null;
      try {
        if (key && (localStorage.getItem(key) || inFlight.has(key))) return;
        if (key) inFlight.add(key);
        const response = await fetch("/api/analytics", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...data, clientId: clientId(store) }),
          referrerPolicy: "no-referrer", credentials: "same-origin", signal: controller.signal,
        });
        if (key && response.ok) localStorage.setItem(key, "yes");
        if (key && response.status === 409 && attempt < 10 && !cancelled) retry = setTimeout(() => void record(attempt + 1), 3_000);
      } catch { /* Optional measurement must not interrupt checkout. */ }
      finally { if (key) inFlight.delete(key); }
    };
    const onConsent = () => {
      if (!readPrivacyPreferences(store)?.analytics) { if (retry) clearTimeout(retry); controller.abort(); }
      else { if (controller.signal.aborted) controller = new AbortController(); void record(); }
    };
    void record();
    window.addEventListener(privacyEvent, onConsent);
    return () => { cancelled = true; controller.abort(); if (retry) clearTimeout(retry); window.removeEventListener(privacyEvent, onConsent); };
  }, [store, eventData]);
  return null;
}
