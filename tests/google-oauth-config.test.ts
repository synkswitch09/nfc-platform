import { describe, expect, it } from "vitest";
import { googleOAuthCredentials } from "@/lib/google-oauth-config";
import { parseRuntimeConfig } from "@/lib/config";

const stores = JSON.stringify({ tapkin: { clientId: "tapkin-id", clientSecret: "tapkin-secret" }, kosykin: { clientId: "kosykin-id", clientSecret: "kosykin-secret" } });
const legacy = { GOOGLE_CLIENT_ID: "shared-id", GOOGLE_CLIENT_SECRET: "shared-secret" };
describe("Google OAuth credentials per store", () => {
  it("selects each brand's client rather than legacy shared credentials", () => {
    expect(googleOAuthCredentials("tapkin", { ...legacy, GOOGLE_OAUTH_STORES: stores })).toEqual({ clientId: "tapkin-id", clientSecret: "tapkin-secret" });
    expect(googleOAuthCredentials("kosykin", { ...legacy, GOOGLE_OAUTH_STORES: stores })).toEqual({ clientId: "kosykin-id", clientSecret: "kosykin-secret" });
  });
  it("does not fall back to another brand when a store is missing", () => {
    expect(googleOAuthCredentials("new-store", { ...legacy, GOOGLE_OAUTH_STORES: stores })).toBeUndefined();
    expect(googleOAuthCredentials("tapkin", { ...legacy, GOOGLE_OAUTH_STORES: "{}" })).toBeUndefined();
    expect(googleOAuthCredentials("constructor", { GOOGLE_OAUTH_STORES: stores })).toBeUndefined();
  });
  it("keeps credentials isolated between deployment environments", () => {
    const staging = JSON.stringify({ kosykin: { clientId: "stage-id", clientSecret: "stage-secret" } });
    expect(googleOAuthCredentials("kosykin", { GOOGLE_OAUTH_STORES: staging })?.clientId).toBe("stage-id");
    expect(googleOAuthCredentials("kosykin", { GOOGLE_OAUTH_STORES: stores })?.clientId).toBe("kosykin-id");
  });
  it("does not use removed shared credentials", () => {
    expect(googleOAuthCredentials("kosykin", legacy)).toBeUndefined();
    expect(googleOAuthCredentials("kosykin", {})).toBeUndefined();
  });
  it.each(["not-json", "null", '["invalid"]', JSON.stringify({ kosykin: { clientId: "id" } }), JSON.stringify({ kosykin: { clientId: "id", clientSecret: "" } })])("rejects invalid configuration without returning secret data", value => {
    expect(() => googleOAuthCredentials("kosykin", { GOOGLE_OAUTH_STORES: value })).toThrow("Invalid store Google OAuth configuration");
    expect(() => parseRuntimeConfig({ GOOGLE_OAUTH_STORES: value })).toThrow("Invalid runtime configuration");
  });
});
