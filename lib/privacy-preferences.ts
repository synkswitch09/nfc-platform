export type PrivacyPreferences = { version: 1; analytics: boolean; advertising: boolean; savedAt: number };
export const privacyCookieName = (store: string) => `privacy-preferences-${store}`;
export const privacyEvent = "store-privacy-preferences";
const lifetime = 365 * 24 * 60 * 60 * 1000;

export function parsePrivacyPreferences(raw: string | undefined | null, now = Date.now()): PrivacyPreferences | null {
  try {
    const value = JSON.parse(decodeURIComponent(raw ?? ""));
    if (value.version !== 1 || typeof value.analytics !== "boolean" || typeof value.advertising !== "boolean" || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= lifetime) return null;
    return { version: 1, analytics: value.analytics, advertising: value.advertising, savedAt: value.savedAt };
  } catch { return null; }
}

export function readPrivacyPreferences(store: string): PrivacyPreferences | null {
  if (typeof document === "undefined") return null;
  const prefix = `${privacyCookieName(store)}=`;
  return parsePrivacyPreferences(document.cookie.split(";").map(item => item.trim()).find(item => item.startsWith(prefix))?.slice(prefix.length));
}

export function savePrivacyPreferences(store: string, analytics: boolean, advertising: boolean) {
  const value: PrivacyPreferences = { version: 1, analytics, advertising, savedAt: Date.now() };
  document.cookie = `${privacyCookieName(store)}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${lifetime / 1000}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  try {
    localStorage.removeItem(`commerce-analytics-consent:${store}`);
    if (!analytics) sessionStorage.removeItem(`commerce-analytics-client:${store}`);
  } catch { /* Blocked browser storage must not interrupt privacy choices. */ }
  for (const name of [...(!analytics ? ["_clck", "_clsk"] : []), ...(!advertising ? ["_fbp", "_fbc"] : [])]) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
    document.cookie = `${name}=; Path=/; Max-Age=0; Domain=${location.hostname}`;
    const base = location.hostname.split(".").slice(-3).join(".");
    if (base !== location.hostname) document.cookie = `${name}=; Path=/; Max-Age=0; Domain=${base}`;
  }
  window.dispatchEvent(new Event(privacyEvent));
  return value;
}
