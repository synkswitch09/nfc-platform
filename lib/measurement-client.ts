"use client";
import { readPrivacyPreferences } from "@/lib/privacy-preferences";
export type CommerceEvent =
  | { event: "view_item"; productId: string; variantId?: string }
  | { event: "add_to_cart" | "begin_checkout"; items: { variantId: string; quantity: number }[] }
  | { event: "purchase"; orderId: string; claimToken?: string }
  | { event: "page_view"; path: string }
  | { event: "personalizer_interaction"; productId: string; action: "open" | "change" | "preview"; field?: "size" | "font" | "colour" | "shape" | "finish" | "attachment" | "text" | "preview" };
const sessions = new Map<string, { key: string; promise: Promise<boolean> }>();
const purchases = new Set<string>();
const inFlight = new Set<string>();
const seenEvents = new Set<string>();
export function ensureMeasurementSession(store: string, force = false) {
  const p = readPrivacyPreferences(store);
  const key = JSON.stringify(p);
  const previous = sessions.get(store);
  if (!force && previous?.key === key) return previous.promise;
  const promise = (async () => {
    let id: string | null = null;
    try { id = sessionStorage.getItem(`commerce-analytics-client:${store}`); } catch { /* Storage is optional. */ }
    if (!id || !/^\d{1,10}\.\d{1,10}$/.test(id)) {
      const v = crypto.getRandomValues(new Uint32Array(2)); id = `${v[0]}.${v[1]}`;
      if (p?.analytics || p?.advertising) try { sessionStorage.setItem(`commerce-analytics-client:${store}`, id); } catch { /* Optional. */ }
    }
    const response = await fetch("/api/analytics/session", { method: "POST", credentials: "same-origin", referrerPolicy: "no-referrer", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: id, ...(p?.advertising && /^[A-Za-z0-9_-]{1,250}$/.test(new URLSearchParams(location.search).get("fbclid") ?? "") ? { fbc: `fb.1.${Date.now()}.${new URLSearchParams(location.search).get("fbclid")}` } : {}) }) });
    if (!response.ok) { sessions.delete(store); return false; }
    return Boolean((await response.json()).enabled);
  })().catch(() => { sessions.delete(store); return false; });
  sessions.set(store, { key, promise }); return promise;
}
export function emitCommerceEvent(data: CommerceEvent) {
  window.dispatchEvent(new CustomEvent("commerce-measurement", { detail: data }));
}
export async function sendCommerceEvent(store: string, data: CommerceEvent, eventId = crypto.randomUUID()) {
  const p = readPrivacyPreferences(store);
  if (!p?.analytics && !p?.advertising) return 403;
  const key = data.event === "purchase" ? `${store}:purchase:${data.orderId}` : `${store}:${eventId}`;
  if (seenEvents.has(key) || inFlight.has(key) || (data.event === "purchase" && purchases.has(key))) return 200;
  if (!await ensureMeasurementSession(store)) return 404;
  inFlight.add(key);
  try {
    const response = await fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, eventId }), referrerPolicy: "no-referrer", credentials: "same-origin" });
    if (response.ok) {
      const result = await response.json();
      seenEvents.add(key);
      if (data.event === "purchase") purchases.add(key);
      if (result.pixel && readPrivacyPreferences(store)?.advertising) window.dispatchEvent(new CustomEvent("commerce-pixel", { detail: result.pixel }));
    }
    return response.status;
  } catch { return 503; } finally { inFlight.delete(key); }
}
