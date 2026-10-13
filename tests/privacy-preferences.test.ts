import { afterEach, expect, it, vi } from "vitest";
import { initializePrivacyPreferences, parsePrivacyPreferences, privacyCookieName, readPrivacyPreferences, savePrivacyPreferences } from "@/lib/privacy-preferences";
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
  for (const raw of [undefined, "yes", "bad", JSON.stringify({ ...preference, analytics: "yes" }), JSON.stringify({ ...preference, version: 2 }), JSON.stringify({ ...preference, savedAt: 2000 })]) expect(parsePrivacyPreferences(raw, 1001)).toBeNull();
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
it("starts configured tracking for new visitors without treating the default as an acknowledged notice", () => {
  browser();
  expect(initializePrivacyPreferences("kosykin", true, true)).toMatchObject({ analytics: true, advertising: true, noticeSeen: false });
  expect(readPrivacyPreferences("kosykin")).toMatchObject({ analytics: true, advertising: true, noticeSeen: false });
  expect(readPrivacyPreferences("tapkin")).toBeNull();
});
it("does not enable an unavailable category or create tracking preferences when all tools are disabled", () => {
  browser();
  expect(initializePrivacyPreferences("tapkin", false, false)).toBeNull();
  expect(initializePrivacyPreferences("kosykin", true, false)).toMatchObject({ analytics: true, advertising: false });
});
it("preserves legacy and current opt-outs instead of overriding them with new defaults", () => {
  const cookies = browser();
  const legacy = { version: 1, analytics: false, advertising: false, savedAt: Date.now() };
  cookies.set(privacyCookieName("kosykin"), encodeURIComponent(JSON.stringify(legacy)));
  expect(initializePrivacyPreferences("kosykin", true, true)).toEqual(legacy);
  savePrivacyPreferences("tapkin", false, true);
  expect(initializePrivacyPreferences("tapkin", true, true)).toMatchObject({ analytics: false, advertising: true, noticeSeen: true });
});
it("allows a new visitor to disable both categories and retains that decision on subsequent visits", () => {
  browser();
  initializePrivacyPreferences("kosykin", true, true);
  savePrivacyPreferences("kosykin", false, false);
  expect(initializePrivacyPreferences("kosykin", true, true)).toMatchObject({ analytics: false, advertising: false, noticeSeen: true });
  expect(sessionStorage.removeItem).toHaveBeenCalledWith("commerce-analytics-client:kosykin");
});
