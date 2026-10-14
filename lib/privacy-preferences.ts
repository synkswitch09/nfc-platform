export type PrivacyPreferences = { version: 1 | 2; analytics: boolean; advertising: boolean; savedAt: number; noticeSeen?: boolean };
export const privacyCookieName = (store: string) => `privacy-preferences-${store}`;
export const privacyEvent = "store-privacy-preferences";
const lifetime = 365 * 24 * 60 * 60 * 1000;

export function parsePrivacyPreferences(raw: string | undefined | null, now = Date.now()): PrivacyPreferences | null {
  try {
    const value = JSON.parse(decodeURIComponent(raw ?? ""));
    if ((value.version !== 1 && value.version !== 2) || typeof value.analytics !== "boolean" || typeof value.advertising !== "boolean" || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= lifetime) return null;
    // Automatic opt-out-era settings are not evidence of an affirmative choice.
    // Preserve old explicit opt-ins and all saved refusals; renew ambiguous grants.
    if (value.noticeSeen === false || (value.version === 1 && value.noticeSeen !== undefined && (value.analytics || value.advertising))) return null;
    return { version: value.version, analytics: value.analytics, advertising: value.advertising, savedAt: value.savedAt, ...(typeof value.noticeSeen === "boolean" ? { noticeSeen: value.noticeSeen } : {}) };
  } catch { return null; }
}

export function readPrivacyPreferences(store: string): PrivacyPreferences | null {
  if (typeof document === "undefined") return null;
  const prefix = `${privacyCookieName(store)}=`;
  try {
    return parsePrivacyPreferences(document.cookie.split(";").map(item => item.trim()).find(item => item.startsWith(prefix))?.slice(prefix.length));
  } catch { return null; }
}

export function savePrivacyPreferences(store: string, analytics: boolean, advertising: boolean) {
  const value: PrivacyPreferences = { version: 2, analytics, advertising, savedAt: Date.now() };
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

