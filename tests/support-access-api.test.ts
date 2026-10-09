import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ store: vi.fn(), origin: vi.fn(), limit: vi.fn(), send: vi.fn(), create: vi.fn(), claim: vi.fn(), record: vi.fn(), update: vi.fn(), cookie: vi.fn(), get: vi.fn(), runtime: vi.fn() }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: m.store }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, getClientIp: () => "127.0.0.1", jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
vi.mock("@/lib/config", () => ({ currentAppEnvironment: () => "production", getRuntimeConfig: m.runtime }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => null }));
vi.mock("@/lib/email-verification", () => ({ createEmailVerificationCode: () => "123456" }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: m.send }));
vi.mock("@/lib/crypto", () => ({ privacyHash: (s: string) => s, sha256: (s: string) => `hashed:${s}`, createOpaqueToken: () => "private-session-token" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.cookie, get: m.get }) }));
vi.mock("@/lib/db", () => ({ db: { supportAccess: { create: m.create, update: m.update, updateMany: m.claim }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ supportAccess: { updateMany: m.claim, findUniqueOrThrow: m.record, update: m.update } }) } }));
import { POST, PATCH, DELETE } from "@/app/api/support/access/route";
const id = "10000000-0000-4000-8000-000000000001";
const request = (method: string, data: unknown) => new NextRequest("https://kosykin.com.au/api/support/access", { method, body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); m.origin.mockReturnValue(true); m.limit.mockResolvedValue({ allowed: true }); m.store.mockResolvedValue({ id: "s", slug: "kosykin", displayName: "Kosykin", origin: "https://kosykin.com.au", accountConfig: {} }); m.send.mockResolvedValue(true); m.claim.mockResolvedValue({ count: 1 }); m.record.mockResolvedValue({ id, codeHash: `support:s:${id}:123456` }); m.runtime.mockReturnValue({ email: { mode: "live" } }); });
it("hashes OTP and scopes it to the store without returning any code or order data", async () => {
  const result = await POST(request("POST", { email: "Guest@EXAMPLE.test" })); const body = await result.json();
  expect(result.status).toBe(202); expect(Object.keys(body)).toEqual(["challengeId"]);
  expect(m.create.mock.calls[0][0].data).toMatchObject({ storeId: "s", email: "guest@example.test", codeHash: expect.stringContaining("support:s:") });
  expect(m.send.mock.calls[0][0]).toMatchObject({ category: "support", templateKey: "verification", to: "guest@example.test" });
});
it("rejects missing origin, rate limits and disabled guest access before creating a challenge", async () => {
  m.origin.mockReturnValue(false); expect((await POST(request("POST", { email: "a@example.test" }))).status).toBe(403);
  m.origin.mockReturnValue(true); m.limit.mockResolvedValue({ allowed: false }); expect((await POST(request("POST", { email: "a@example.test" }))).status).toBe(429);
  m.store.mockResolvedValue({ id: "s", accountConfig: { support: { guestEnabled: false } } }); expect((await POST(request("POST", { email: "a@example.test" }))).status).toBe(403); expect(m.create).not.toHaveBeenCalled();
});
it("invalidates a challenge if real provider delivery submission fails", async () => {
  m.send.mockRejectedValue(new Error("Unavailable")); expect((await POST(request("POST", { email: "a@example.test" }))).status).toBe(503);
  expect(m.update.mock.calls[0][0].data.expiresAt).toEqual(new Date(0));
});
it("consumes a valid code once and sets a secure httpOnly 24-hour session", async () => {
  expect((await PATCH(request("PATCH", { challengeId: id, code: "123456" }))).status).toBe(200);
  expect(m.claim.mock.calls[0][0]).toMatchObject({ where: { id, storeId: "s", verifiedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
  expect(m.update.mock.calls[0][0].data.sessionHash).toBe("hashed:private-session-token");
  expect(m.cookie).toHaveBeenCalledWith("support_access", "private-session-token", expect.objectContaining({ httpOnly: true, secure: true, sameSite: "strict", maxAge: 86400 }));
});
it("rejects wrong, expired, used or exhausted codes without granting a session", async () => {
  expect((await PATCH(request("PATCH", { challengeId: id, code: "999999" }))).status).toBe(400); expect(m.cookie).not.toHaveBeenCalled();
  m.claim.mockResolvedValue({ count: 0 }); expect((await PATCH(request("PATCH", { challengeId: id, code: "123456" }))).status).toBe(400); expect(m.update).not.toHaveBeenCalled();
});
it("clears guest access only for the active store", async () => {
  m.get.mockReturnValue({ value: "private-session-token" });
  expect((await DELETE(request("DELETE", {}))).status).toBe(200);
  expect(m.claim.mock.calls[0][0]).toMatchObject({ where: { storeId: "s", sessionHash: "hashed:private-session-token" }, data: { sessionHash: null } });
});
