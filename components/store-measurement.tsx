"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { privacyEvent, readPrivacyPreferences } from "@/lib/privacy-preferences";
import { ensureMeasurementSession, sendCommerceEvent, type CommerceEvent } from "@/lib/measurement-client";
import { safeShoppingPath } from "@/lib/measurement-paths";
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global { interface Window { clarity?: Clarity } }
export function StoreMeasurement({ store, production, clarityProjectId, pixelEnabled }: { store: string; production: boolean; clarityProjectId: string; pixelEnabled: boolean }) {
  const path = usePathname();
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<unknown[]>([]);
  const frameReady = useRef(false);
  const [advertising, setAdvertising] = useState(false);
  useEffect(() => {
    if (!production) return;
    const refresh = () => {
      const p = readPrivacyPreferences(store);
      setAdvertising(Boolean(pixelEnabled && p?.advertising));
      if (!p?.advertising) { pending.current = []; frameReady.current = false; }
      void ensureMeasurementSession(store).then(() => {
        // Unload the recording runtime after any consent change. A denied user is never recorded in cookieless mode.
        if (window.clarity || clarityProjectId) window.location.reload();
      });
    };
    setAdvertising(Boolean(pixelEnabled && readPrivacyPreferences(store)?.advertising));
    if (readPrivacyPreferences(store)) void ensureMeasurementSession(store);
    window.addEventListener(privacyEvent, refresh);
    const event = (e: Event) => {
      const data = (e as CustomEvent<CommerceEvent>).detail;
      if (safeShoppingPath(window.location.pathname) || window.location.pathname === "/checkout") void sendCommerceEvent(store, data);
    };
    const pixel = (e: Event) => {
      if (!readPrivacyPreferences(store)?.advertising) return;
      if (frameReady.current && frame.current?.contentWindow) frame.current.contentWindow.postMessage((e as CustomEvent).detail, location.origin);
      else { if (pending.current.length < 30) pending.current.push((e as CustomEvent).detail); }
    };
    const ready = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data !== "pixel-ready") return;
      frameReady.current = true;
      for (const item of pending.current.splice(0)) frame.current?.contentWindow?.postMessage(item, location.origin);
    };
    window.addEventListener("commerce-measurement", event); window.addEventListener("commerce-pixel", pixel); window.addEventListener("message", ready);
    return () => { window.removeEventListener(privacyEvent, refresh); window.removeEventListener("commerce-measurement", event); window.removeEventListener("commerce-pixel", pixel); window.removeEventListener("message", ready); };
  }, [production, store, pixelEnabled, clarityProjectId]);
  useEffect(() => {
    if (!production || !safeShoppingPath(path)) return;
    const id = crypto.randomUUID();
    const view = () => void sendCommerceEvent(store, { event: "page_view", path }, id);
    view(); window.addEventListener(privacyEvent, view);
    return () => window.removeEventListener(privacyEvent, view);
  }, [path, production, store]);
  useEffect(() => {
    // Record only anonymous browsing surfaces. Checkout, personalizers, accounts,
    // orders, support, administration and NFC routes never load Clarity.
    if (!production || !clarityProjectId || !readPrivacyPreferences(store)?.analytics || !/^(\/(?:shop|faq|privacy|terms)?)$/.test(path) || location.search || location.hash) return;
    if (document.referrer) { try { const r = new URL(document.referrer); if (r.search || r.hash || (r.origin === location.origin && !safeShoppingPath(r.pathname))) return; } catch { return; } }
    const queue: Clarity = Object.assign((...args: unknown[]) => { queue.q!.push(args); }, { q: [] as unknown[][] });
    window.clarity = queue;
    queue("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
    const script = document.createElement("script"); script.async = true; script.src = `https://www.clarity.ms/tag/${clarityProjectId}`; script.referrerPolicy = "no-referrer"; document.head.appendChild(script);
    // Keep recordings within a document. Next's client router must never carry
    // an already-loaded recorder into a private page or a personalised product.
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const url = new URL(anchor.href);
      if (url.origin === location.origin && url.href !== location.href) { event.preventDefault(); event.stopPropagation(); window.location.assign(url.href); }
    };
    const history = () => window.location.reload();
    document.addEventListener("click", navigate, true); window.addEventListener("popstate", history);
    return () => { document.removeEventListener("click", navigate, true); window.removeEventListener("popstate", history); };
  }, [path, production, clarityProjectId, store]);
  // Pixel SDK executes in an empty document, never in the page containing
  // customer details, order tokens, tickets or the personalised 3D preview.
  return advertising ? <iframe ref={frame} src="/api/analytics/pixel" title="Optional advertising measurement" aria-hidden="true" tabIndex={-1} className="measurement-frame" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" /> : null;
}
