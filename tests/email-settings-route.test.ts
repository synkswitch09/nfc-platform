import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseEmailSenders } from "@/lib/email-senders";
const mock = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: mock.context, hasPermission: (context: { permissions?: string[] } | null, permission: string) => Boolean(context?.permissions?.includes(permission)) }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ email: { fromAddress: "hello@tapkin.com.au", kosykinFromAddress: "hello@kosykin.com.au" } }) }));
vi.mock("@/lib/db", () => ({ db: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ store: { update: mock.update }, auditLog: { create: mock.audit } }) } }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: mock.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { PATCH } from "@/app/api/admin/settings/email/route";
const request = (body: unknown) => new NextRequest("https://kosykin.com.au/api/admin/settings/email", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.context.mockResolvedValue({ user: { id: "admin" }, store: { id: "kosykin-store", slug: "kosykin" }, permissions: ["settings.write"] });
  mock.origin.mockReturnValue(true);
  mock.update.mockResolvedValue({ accountConfig: { appleEnabled: false, savedCartEnabled: true, helpEnabled: true } });
});
describe("email sender settings API", () => {
  it("saves only the current store and preserves the existing account configuration", async () => {
    const senders = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    expect((await PATCH(request(senders))).status).toBe(200);
    expect(mock.update.mock.calls[1][0]).toEqual({ where: { id: "kosykin-store" }, data: { accountConfig: { appleEnabled: false, savedCartEnabled: true, helpEnabled: true, emailSenders: senders } } });
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ storeId: "kosykin-store", action: "EMAIL_SENDERS_UPDATED" }) }));
  });
  it("rejects a sender from the other brand before writing", async () => {
    const senders = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin"); senders.orders.address = "orders@tapkin.com.au";
    expect((await PATCH(request(senders))).status).toBe(400);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("requires settings write permission", async () => {
    mock.context.mockResolvedValue({ permissions: ["settings.read"] });
    expect((await PATCH(request({}))).status).toBe(403);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin change", async () => {
    mock.origin.mockReturnValue(false);
    expect((await PATCH(request({}))).status).toBe(403);
    expect(mock.context).not.toHaveBeenCalled();
  });
});
