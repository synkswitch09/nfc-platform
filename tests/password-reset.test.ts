import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ find: vi.fn(), claim: vi.fn(), updateUser: vi.fn(), sessions: vi.fn(), audit: vi.fn(), transaction: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { passwordReset: { findUnique: m.find }, $transaction: m.transaction } }));
vi.mock("@/lib/crypto", () => ({ sha256: () => "hash", hashPassword: async () => "password-hash" }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: async () => ({ id: "store" }) }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
import { POST } from "@/app/api/auth/reset-password/route";
const reset = () => ({ id: "reset", userId: "user", storeId: "store", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
const run = () => POST(new NextRequest("https://test.example/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: "t".repeat(40), password: "StrongPassword42!" }) }));
beforeEach(() => {
  vi.resetAllMocks(); m.origin.mockReturnValue(true); m.find.mockResolvedValue(reset()); m.claim.mockResolvedValue({ count: 1 });
  m.transaction.mockImplementation(fn => fn({ passwordReset: { updateMany: m.claim }, user: { update: m.updateUser }, session: { deleteMany: m.sessions }, auditLog: { create: m.audit } }));
});
it("claims an unexpired unused token and revokes sessions across every store", async () => {
  expect((await run()).status).toBe(200);
  expect(m.claim.mock.calls[0][0].where).toMatchObject({ id: "reset", storeId: "store", usedAt: null, expiresAt: { gt: expect.any(Date) } });
  expect(m.sessions).toHaveBeenCalledExactlyOnceWith({ where: { userId: "user" } });
  expect(m.claim.mock.calls[1][0].where).toEqual({ userId: "user", usedAt: null });
  expect(m.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
});
it("a competing claim cannot change the password or sessions twice", async () => {
  let won = false;
  m.claim.mockImplementation(({ where }) => {
    if (!where.id) return Promise.resolve({ count: 0 });
    const count = won ? 0 : 1; won = true; return Promise.resolve({ count });
  });
  const responses = await Promise.all([run(), run()]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
  expect(m.updateUser).toHaveBeenCalledOnce();
  expect(m.sessions).toHaveBeenCalledOnce();
});
it.each(["expired", "used", "other-store", "absent"])("rejects %s tokens before mutation", async kind => {
  m.find.mockResolvedValue(kind === "absent" ? null : { ...reset(), ...(kind === "expired" ? { expiresAt: new Date(0) } : kind === "used" ? { usedAt: new Date() } : { storeId: "other" }) });
  expect((await run()).status).toBe(400);
  expect(m.transaction).not.toHaveBeenCalled();
});
it("rechecks expiration at claim time", async () => {
  m.claim.mockResolvedValue({ count: 0 });
  expect((await run()).status).toBe(400);
  expect(m.updateUser).not.toHaveBeenCalled();
});
it("does not report success if the transaction fails", async () => {
  m.transaction.mockRejectedValue(new Error("serialization failure"));
  expect((await run()).status).toBe(409);
});
it("rejects cross-origin requests", async () => {
  m.origin.mockReturnValue(false);
  expect((await run()).status).toBe(403);
  expect(m.find).not.toHaveBeenCalled();
});
