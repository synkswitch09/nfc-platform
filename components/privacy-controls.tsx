"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readPrivacyPreferences, savePrivacyPreferences } from "@/lib/privacy-preferences";
import { forgetCheckout, loadCheckout } from "@/lib/checkout-memory";

export function PrivacyControls({ store, analyticsAvailable, advertisingAvailable = false, rememberEnabled, retentionDays }: { store: string; analyticsAvailable: boolean; advertisingAvailable?: boolean; rememberEnabled: boolean; retentionDays: number }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const saved = readPrivacyPreferences(store);
    setAnalytics(analyticsAvailable && Boolean(saved?.analytics));
    setAdvertising(advertisingAvailable && Boolean(saved?.advertising));
    setOpen((analyticsAvailable || advertisingAvailable) && !saved);
    setReady(true);
    try {
      if (!rememberEnabled) forgetCheckout(localStorage, store);
      else loadCheckout(localStorage, store, retentionDays);
    } catch { /* Browser storage may be unavailable. */ }
  }, [store, analyticsAvailable, advertisingAvailable = false, rememberEnabled, retentionDays]);
  function choose(value: boolean, ads: boolean) {
    savePrivacyPreferences(store, analyticsAvailable && value, advertisingAvailable && ads);
    setAnalytics(analyticsAvailable && value); setAdvertising(advertisingAvailable && ads); setOpen(false);
  }
  function forget() {
    try { forgetCheckout(localStorage, store); } catch { /* Nothing accessible to remove. */ }
    window.dispatchEvent(new Event("checkout-details-forgotten"));
    setNotice("Checkout details forgotten on this device.");
  }
  if (!ready) return null;
  if (!open) return <button className="analytics-settings-link" type="button" onClick={() => { setNotice(""); setOpen(true); }}>Privacy & cookie settings</button>;
  return <aside className="analytics-consent privacy-controls" aria-label="Privacy and cookie settings">
    <div><h2>Privacy choices</h2><p>Essential cookies support sign-in, security and checkout. Optional analytics helps us understand shopping activity. Advertising measurement helps us assess our Meta campaigns. <Link href="/privacy">Privacy policy</Link></p>
      <label className="check-field"><input type="checkbox" checked disabled />Essential services (always required)</label>
      <label className="check-field"><input type="checkbox" checked={analytics} disabled={!analyticsAvailable} onChange={event => setAnalytics(event.target.checked)} />Analytics{!analyticsAvailable && " (not active)"}</label>
      <label className="check-field"><input type="checkbox" checked={advertising} disabled={!advertisingAvailable} onChange={event => setAdvertising(event.target.checked)} />Advertising{!advertisingAvailable && " (not active)"}</label>
      <p className="fine-print">You can accept analytics and advertising separately and change your choice here. Promotional email consent and remembering checkout details are separate choices.</p>
      <button className="text-button" type="button" onClick={forget}>Forget checkout details on this device</button>{notice && <p role="status">{notice}</p>}
    </div>
    <div className="privacy-actions"><button className="button secondary" type="button" onClick={() => choose(false, false)}>Reject optional</button>{(analyticsAvailable || advertisingAvailable) && <button className="button secondary" type="button" onClick={() => choose(true, true)}>Accept optional</button>}<button className="button" type="button" onClick={() => choose(analytics, advertising)}>Save choices</button></div>
  </aside>;
}
