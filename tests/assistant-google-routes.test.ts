import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ exchange: vi.fn(), user: vi.fn(), session: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/oauth", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/oauth")>()), exchangeConfiguredOAuthCode: m.exchange, findOrCreateOAuthUser: m.user }));
vi.mock("@/lib/assistants/auth", () => ({ createAssistantSession: m.session }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/http", () => ({ getClientIp: () => "127.0.0.1" }));
import { GET as start } from "@/app/api/assistants/oauth/google/start/route";
import { GET as callback } from "@/app/api/assistants/oauth/google/callback/route";
import { ASSISTANT_OAUTH_COOKIE, createAssistantGoogleTransaction } from "@/lib/assistants/google-oauth";
const origin = "https://admin.example.test";
function request(path: string, cookie?: string, host = "admin.example.test") { return new NextRequest(origin + path, { headers: { host, ...(cookie ? { cookie: `${ASSISTANT_OAUTH_COOKIE}=${cookie}` } : {}) } }); }
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("AI_ASSISTANTS_ORIGIN", origin); vi.stubEnv("AI_ASSISTANTS_GOOGLE_CLIENT_ID", "google-client"); vi.stubEnv("AI_ASSISTANTS_GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("SESSION_SECRET", "test-session-secret-with-at-least-32-characters"); vi.stubEnv("AI_ASSISTANTS_ENABLED", "true");
  m.limit.mockResolvedValue({ allowed: true }); m.exchange.mockResolvedValue({ sub: "sub", email: "admin@example.test", email_verified: true });
  m.user.mockResolvedValue({ id: "same-admin-id", emailVerifiedAt: new Date() });
});
describe("assistant Google start and callback routes", () => {
  it("starts a Google authorization with PKCE/nonce and isolated HttpOnly cookie", async () => {
    const response = await start(request("/api/assistants/oauth/google/start?next=/trading"));
    const url = new URL(response.headers.get("location")!);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${origin}/api/assistants/oauth/google/callback`);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly"); expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/assistants/oauth/google");
  });
  it("rejects other hosts, missing cookies and state mismatches without exchanging a code", async () => {
    expect((await start(request("/api/assistants/oauth/google/start", undefined, "tapkin.com.au"))).status).toBe(404);
    expect((await callback(request("/api/assistants/oauth/google/callback?code=c&state=s"))).headers.get("location")).toContain("oauth=failed");
    const tx = createAssistantGoogleTransaction(origin, "google-client");
    const r = await callback(request("/api/assistants/oauth/google/callback?code=c&state=wrong", tx.cookie));
    expect(r.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970"); expect(m.exchange).not.toHaveBeenCalled();
  });
  it("creates only the assistant session for the verified existing identity", async () => {
    const tx = createAssistantGoogleTransaction(origin, "google-client", "/account/integrations");
    const r = await callback(request(`/api/assistants/oauth/google/callback?code=c&state=${tx.value.state}`, tx.cookie));
    expect(r.headers.get("location")).toBe(`${origin}/account/integrations`);
    expect(m.session).toHaveBeenCalledWith("same-admin-id"); expect(m.user.mock.calls[0][2]).toBeUndefined();
    expect(m.exchange.mock.calls[0].slice(2)).toEqual([tx.value.verifier, tx.value.state, tx.value.nonce]);
    expect(r.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });
  it("passes registration closure through, handles denial and never leaks provider error details", async () => {
    vi.stubEnv("AI_ASSISTANTS_ENABLED", "false");
    const tx = createAssistantGoogleTransaction(origin, "google-client");
    await callback(request(`/api/assistants/oauth/google/callback?code=c&state=${tx.value.state}`, tx.cookie));
    expect(m.user.mock.calls[0][3]).toEqual({ allowCreate: false });
    m.exchange.mockRejectedValue(new Error("secret-sensitive-error"));
    const failed = await callback(request(`/api/assistants/oauth/google/callback?code=c&state=${tx.value.state}`, tx.cookie));
    expect(failed.headers.get("location")).toBe(`${origin}/login?oauth=failed`);
    expect(failed.headers.get("location")).not.toContain("sensitive");
    m.exchange.mockClear();
    await callback(request(`/api/assistants/oauth/google/callback?error=access_denied&state=${tx.value.state}`, tx.cookie));
    expect(m.exchange).not.toHaveBeenCalled();
  });
});
