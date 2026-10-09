import { expect, it } from "vitest";
import { parsePrivacyPreferences, privacyCookieName } from "@/lib/privacy-preferences";
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
