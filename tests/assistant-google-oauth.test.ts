import { beforeEach, describe, expect, it, vi } from "vitest";
import { assistantGoogleConfig, assistantGoogleCallback, createAssistantGoogleTransaction, readAssistantGoogleTransaction, assistantOAuthNext } from "@/lib/assistants/google-oauth";
import { createOAuthTransaction } from "@/lib/oauth";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("SESSION_SECRET", "test-session-secret-with-at-least-32-characters");
});
describe("assistant Google OAuth configuration and signed transactions", () => {
  const origin = "https://admin.example.test";
  it("reuses only the explicit store client, or a complete dedicated portal client", () => {
    const env = { GOOGLE_OAUTH_STORES: JSON.stringify({ tapkin: { clientId: "store-id", clientSecret: "store-secret" } }) };
    expect(assistantGoogleConfig(env)?.clientId).toBe("store-id");
    expect(assistantGoogleConfig({ ...env, AI_ASSISTANTS_GOOGLE_CLIENT_ID: "portal-id", AI_ASSISTANTS_GOOGLE_CLIENT_SECRET: "portal-secret" })?.clientId).toBe("portal-id");
    expect(assistantGoogleConfig({ ...env, AI_ASSISTANTS_GOOGLE_CLIENT_ID: "partial" })).toBeNull();
    expect(assistantGoogleConfig({ ...env, AI_ASSISTANTS_EMAIL_STORE: "missing" })).toBeNull();
    expect(assistantGoogleConfig({})).toBeNull();
  });
  it("binds state, nonce, verifier, client, canonical origin and expiry", () => {
    const tx = createAssistantGoogleTransaction(origin, "client", "/trading");
    expect(readAssistantGoogleTransaction(tx.cookie, origin, "client")).toMatchObject(tx.value);
    expect(tx.value.verifier.length).toBeGreaterThanOrEqual(43);
    expect(readAssistantGoogleTransaction(tx.cookie, "https://evil.test", "client")).toBeNull();
    expect(readAssistantGoogleTransaction(tx.cookie, origin, "other-client")).toBeNull();
    expect(readAssistantGoogleTransaction(tx.cookie, origin, "client", Date.now() + 600001)).toBeNull();
    expect(readAssistantGoogleTransaction(`${tx.cookie}.extra`, origin, "client")).toBeNull();
    expect(readAssistantGoogleTransaction(`x${tx.cookie}`, origin, "client")).toBeNull();
    expect(assistantGoogleCallback(origin)).toBe(`${origin}/api/assistants/oauth/google/callback`);
  });
  it("isolates the storefront signature and allows only private local return destinations", () => {
    const store = createOAuthTransaction("google", "/dashboard", { id: "store", origin });
    expect(readAssistantGoogleTransaction(store.cookie, origin, "client")).toBeNull();
    for (const next of ["https://evil.test", "//evil.test", "/\\evil.test", "/account?next=https://evil.test", "/api/assistants/auth"]) expect(assistantOAuthNext(next)).toBe("/account");
    expect(assistantOAuthNext("/account/integrations")).toBe("/account/integrations");
  });
});
