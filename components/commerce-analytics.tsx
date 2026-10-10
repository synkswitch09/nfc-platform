"use client";
import { useEffect } from "react";
import { privacyEvent, readPrivacyPreferences } from "@/lib/privacy-preferences";
import { ensureMeasurementSession, sendCommerceEvent, type CommerceEvent } from "@/lib/measurement-client";
export function CommerceAnalyticsEvent({ store, data }: { store: string; data: CommerceEvent }) {
  const eventData = JSON.stringify(data);
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const eventId = crypto.randomUUID();
    const record = async (attempt = 0) => {
      const preferences = readPrivacyPreferences(store);
      if (cancelled || (!preferences?.analytics && !preferences?.advertising)) return;
      try {
        await ensureMeasurementSession(store);
        const status = await sendCommerceEvent(store, JSON.parse(eventData), eventId);
        if (status === 409 && attempt < 10 && !cancelled) retry = setTimeout(() => void record(attempt + 1), 3000);
      } catch { /* Optional tracking never interrupts shopping. */ }
    };
    void record();
    const onConsent = () => void record();
    window.addEventListener(privacyEvent, onConsent);
    return () => { cancelled = true; if (retry) clearTimeout(retry); window.removeEventListener(privacyEvent, onConsent); };
  }, [store, eventData]);
  return null;
}
