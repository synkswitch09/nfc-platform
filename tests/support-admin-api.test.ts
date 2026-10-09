import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), existing: vi.fn(), lock: vi.fn(), ticket: vi.fn(), update: vi.fn(), order: vi.fn(), audit: vi.fn(), notice: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { orderSupportRequest: { findFirst: m.existing }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ order: { update: m.order }, orderSupportRequest: { updateMany: m.lock, findUniqueOrThrow: m.ticket, update: m.update }, auditLog: { create: m.audit } }) } }));
vi.mock("@/lib/support-notifications", () => ({ dispatchSupportNotices: m.dispatch, queueSupportNotice: m.notice }));
import { PATCH } from "@/app/api/admin/support/[requestId]/route";
const at = "2026-10-09T10:00:00.000Z";
const req = (body: Record<string, unknown> = {}) => new NextRequest("https://kosykin.com.au/api/admin/support/t", { method: "PATCH", body: JSON.stringify({ status: "IN_REVIEW", expectedUpdatedAt: at, ...body }) });
const call = (body: Record<string, unknown> = {}) => PATCH(req(body), { params: Promise.resolve({ requestId: "t" }) });
beforeEach(() => { vi.resetAllMocks(); m.origin.mockReturnValue(true); m.context.mockResolvedValue({ store: { id: "s", displayName: "Kosykin", origin: "https://kosykin.com.au" }, user: { id: "admin" } }); m.existing.mockResolvedValue({ orderId: "o" }); m.lock.mockResolvedValue({ count: 1 }); m.ticket.mockResolvedValue({ id: "t", customerEmail: "guest@example.test", firstRespondedAt: null, priority: "HIGH", holdActive: true, replies: [] }); });
it("requires support.write independently of generic admin access and rejects another store's ticket", async () => {
  m.context.mockResolvedValue(null); expect((await call()).status).toBe(403); expect(m.context).toHaveBeenCalledWith("support.write");
  m.context.mockResolvedValue({ store: { id: "s" } }); m.existing.mockResolvedValue(null); expect((await call()).status).toBe(404); expect(m.existing.mock.calls[0][0].where).toEqual({ id: "t", storeId: "s" });
});
it("does not count internal notes as a public response or email them", async () => {
  expect((await call({ note: "Private note" })).status).toBe(200);
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("firstRespondedAt"); expect(m.notice).not.toHaveBeenCalled();
});
it("rejects stale edits before appending a response", async () => {
  m.lock.mockResolvedValue({ count: 0 }); expect((await call({ response: "Public reply" })).status).toBe(409); expect(m.update).not.toHaveBeenCalled(); expect(m.notice).not.toHaveBeenCalled();
});
it("requires explicit audited release with reason when resolving a held ticket", async () => {
  expect((await call({ status: "RESOLVED" })).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  expect((await call({ releaseHold: true, releaseReason: "short" })).status).toBe(400);
  expect((await call({ status: "RESOLVED", releaseHold: true, releaseReason: "Customer and team agreed to proceed", response: "We will proceed as agreed.", note: "INTERNAL", notifyCustomer: true })).status).toBe(200);
  expect(m.order).toHaveBeenCalledBefore(m.lock);
  const data = m.update.mock.calls[0][0].data; expect(data).toMatchObject({ holdActive: false, firstRespondedAt: expect.any(Date), replies: [expect.objectContaining({ author: "team", message: "We will proceed as agreed." })] });
  expect(m.notice.mock.calls[0][5]).not.toContain("INTERNAL"); expect(m.audit.mock.calls[0][0].data.action).toBe("SUPPORT_HOLD_RELEASED");
});
it("allows a portal-visible reply without email and preserves first-response history", async () => {
  m.ticket.mockResolvedValue({ customerEmail: "guest@example.test", firstRespondedAt: new Date(at), priority: "NORMAL", holdActive: false, replies: [{ author: "customer", message: "More details" }] });
  expect((await call({ response: "Reply in your portal", notifyCustomer: false })).status).toBe(200);
  expect(m.update.mock.calls[0][0].data.firstRespondedAt).toEqual(new Date(at)); expect(m.update.mock.calls[0][0].data.replies).toHaveLength(2); expect(m.notice).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations before database operations", async () => { m.origin.mockReturnValue(false); expect((await call()).status).toBe(403); expect(m.existing).not.toHaveBeenCalled(); });
