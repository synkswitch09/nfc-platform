import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ context: vi.fn(), permission: vi.fn(), update: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context, hasPermission: m.permission }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/db", () => ({ db: { $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ store: { update: m.update }, auditLog: { create: m.audit } }) } }));
import { PATCH } from "@/app/api/admin/settings/integrations/route";
const request = (body: unknown, origin = "https://kosykin.test") => new NextRequest("https://kosykin.test/api/admin/settings/integrations", { method: "PATCH", headers: { origin, host: "kosykin.test" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); m.context.mockResolvedValue({ user: { id: "admin" }, store: { id: "store-1" } }); m.permission.mockReturnValue(true);
  m.update.mockResolvedValue({ accountConfig: { googleEnabled: false, emailSenders: { default: { address: "orders@kosykin.test" } } } });
});
it("updates only the authorised store and preserves account settings and email senders", async () => {
  expect((await PATCH(request({ geoapifyEnabled: true }))).status).toBe(200);
  expect(m.update.mock.calls[1][0]).toMatchObject({ where: { id: "store-1" }, data: { accountConfig: { googleEnabled: false, emailSenders: { default: { address: "orders@kosykin.test" } }, integrations: { geoapifyEnabled: true, rememberCheckoutDays: 90 } } } });
  expect(m.audit).toHaveBeenCalledWith({ data: { actorId: "admin", storeId: "store-1", action: "INTEGRATION_SETTINGS_UPDATED", entityType: "Store", entityId: "store-1" } });
});
it("rejects unauthorised changes, cross-origin requests, secrets and store overrides", async () => {
  expect((await PATCH(request({}, "https://other.test"))).status).toBe(403);
  m.permission.mockReturnValue(false); expect((await PATCH(request({}))).status).toBe(403);
  m.permission.mockReturnValue(true);
  for (const body of [{ apiKey: "private" }, { storeId: "other" }, { rememberCheckoutDays: 91 }]) expect((await PATCH(request(body))).status).toBe(400);
  expect(m.update).not.toHaveBeenCalled();
});
