import { afterEach, expect, it, vi } from "vitest";
import { parsePrivacyPreferences, privacyCookieName, readPrivacyPreferences, savePrivacyPreferences } from "@/lib/privacy-preferences";
import { parseIntegrationConfig, integrationConfigSchema } from "@/lib/integration-config";
import { parseRuntimeConfig } from "@/lib/config";

it("defaults to no optional integrations and independently scopes store choices", () => {
  expect(parseIntegrationConfig({})).toMatchObject({ geoapifyEnabled: false, analyticsEnabled: false, rememberCheckoutEnabled: true, rememberCheckoutDays: 90 });
  expect(privacyCookieName("tapkin")).not.toBe(privacyCookieName("kosykin"));
  expect(integrationConfigSchema.safeParse({ apiKey: "private" }).success).toBe(false);
  expect(integrationConfigSchema.safeParse({ rememberCheckoutDays: 91 }).success).toBe(false);
});
it("requires a valid explicit, current consent rather than trusting old analytics choices", () => {
  const preference = { version: 1, analytics: true, advertising: false, savedAt: 1000 };
  expect(parsePrivacyPreferences(encodeURIComponent(JSON.stringify(preference)), 1001)).toEqual(preference);
  for (const raw of [undefined, "yes", "bad", JSON.stringify({ ...preference, analytics: "yes" }), JSON.stringify({ ...preference, version: 3 }), JSON.stringify({ ...preference, savedAt: 2000 })]) expect(parsePrivacyPreferences(raw, 1001)).toBeNull();
  expect(parsePrivacyPreferences(JSON.stringify(preference), 1000 + 365 * 86_400_000)).toBeNull();
});
it("supports an empty Azure variable and rejects malformed private credentials", () => {
  expect(parseRuntimeConfig({ GEOAPIFY_STORES: "" }).geoapifyStores).toEqual({});
  expect(parseRuntimeConfig({ GEOAPIFY_STORES: JSON.stringify({ kosykin: { apiKey: "private-example-key" } }) }).geoapifyStores.kosykin.apiKey).toBe("private-example-key");
  expect(() => parseRuntimeConfig({ GEOAPIFY_STORES: "invalid" })).toThrow("GEOAPIFY_STORES");
});

afterEach(() => vi.unstubAllGlobals());
function browser() {
  const cookies = new Map<string, string>();
  const document = { get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); }, set cookie(raw: string) { const first = raw.split(";")[0]; const i = first.indexOf("="); cookies.set(first.slice(0, i), first.slice(i + 1)); } };
  vi.stubGlobal("document", document);
  vi.stubGlobal("location", { protocol: "https:", hostname: "kosykin.com.au" });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("localStorage", { removeItem: vi.fn() });
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn() });
  return cookies;
}
it("does not create or grant optional consent for a new visitor", () => {
  const cookies = browser();
  expect(readPrivacyPreferences("kosykin")).toBeNull();
  expect(cookies.size).toBe(0);
});
it("keeps optional tracking off when the browser denies access to cookies", () => {
  vi.stubGlobal("document", { get cookie() { throw new Error("Cookie access denied"); } });
  expect(readPrivacyPreferences("kosykin")).toBeNull();
});
it("rejects automatically enabled and ambiguous opt-out-era permissions", () => {
  browser();
  for (const noticeSeen of [false, true]) {
    const raw = JSON.stringify({ version: 1, analytics: true, advertising: true, savedAt: Date.now(), noticeSeen });
    expect(parsePrivacyPreferences(raw)).toBeNull();
  }
  expect(parsePrivacyPreferences(JSON.stringify({ version: 2, analytics: true, advertising: true, savedAt: Date.now(), noticeSeen: false }))).toBeNull();
});
it("preserves prior explicit consent and saved refusals", () => {
  const cookies = browser();
  const legacy = { version: 1, analytics: true, advertising: false, savedAt: Date.now() };
  cookies.set(privacyCookieName("kosykin"), encodeURIComponent(JSON.stringify(legacy)));
  expect(readPrivacyPreferences("kosykin")).toEqual(legacy);
  const refusal = { version: 1, analytics: false, advertising: false, savedAt: Date.now(), noticeSeen: true };
  expect(parsePrivacyPreferences(JSON.stringify(refusal))).toEqual(refusal);
});
it("saves affirmative choices with a new version and keeps each store separate", () => {
  browser();
  expect(savePrivacyPreferences("kosykin", true, false)).toMatchObject({ version: 2, analytics: true, advertising: false });
  expect(readPrivacyPreferences("kosykin")).toMatchObject({ version: 2, analytics: true, advertising: false });
  expect(readPrivacyPreferences("tapkin")).toBeNull();
  savePrivacyPreferences("kosykin", false, false);
  expect(readPrivacyPreferences("kosykin")).toMatchObject({ version: 2, analytics: false, advertising: false });
  expect(sessionStorage.removeItem).toHaveBeenCalledWith("commerce-analytics-client:kosykin");
});
