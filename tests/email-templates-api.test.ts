import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultEmailTemplate } from "@/lib/email-templates";
import { hasPermission } from "@/lib/admin-permissions";
const m = vi.hoisted(() => ({ context: vi.fn(), origin: vi.fn(), update: vi.fn(), audit: vi.fn(), send: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context, hasPermission: (context: Parameters<typeof hasPermission>[0], permission: Parameters<typeof hasPermission>[1]) => hasPermission(context, permission) }));
vi.mock("@/lib/db", () => ({ db: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ store: { update: m.update }, auditLog: { create: m.audit } }) } }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail: m.send }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "@/app/api/admin/email-templates/route";
const request = (action: string, extra: Record<string, unknown> = {}) => new NextRequest("https://kosykin.com.au/api/admin/email-templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "verification", action, template: defaultEmailTemplate("verification"), revision: 0, ...extra }) });
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue({ user: { id: "admin", email: "editor@example.test" }, store: { id: "kosykin-store", slug: "kosykin", displayName: "Kosykin", origin: "https://kosykin.com.au" }, isPlatformAdmin: false, permissions: ["content.read", "content.write", "content.publish"] });
  m.origin.mockReturnValue(true); m.rate.mockResolvedValue({ allowed: true }); m.send.mockResolvedValue(true);
  m.update.mockResolvedValue({ accountConfig: { appleEnabled: false, integrations: { geoapifyEnabled: true }, emailSenders: { marker: "preserved" } } });
});
describe("email template CMS actions", () => {
  it("saves a store-scoped draft without publishing and retains account and integration settings", async () => {
    expect((await POST(request("save"))).status).toBe(200);
    const saved = m.update.mock.calls[1][0];
    expect(saved.where).toEqual({ id: "kosykin-store" });
    expect(saved.data.accountConfig).toMatchObject({ appleEnabled: false, integrations: { geoapifyEnabled: true }, emailSenders: { marker: "preserved" }, emailTemplates: { verification: { published: null, revision: 1 } } });
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ storeId: "kosykin-store", action: "EMAIL_TEMPLATE_SAVE" });
  });
  it("requires publishing permission independently of draft editing", async () => {
    const context = await m.context(); m.context.mockResolvedValue({ ...context, permissions: ["content.read", "content.write"] });
    expect((await POST(request("publish"))).status).toBe(403);
    expect((await POST(request("reset"))).status).toBe(403);
    expect(m.update).not.toHaveBeenCalled();
    expect((await POST(request("save"))).status).toBe(200);
  });
  it("publishes the reviewed design and restores a standard template safely", async () => {
    expect((await POST(request("publish"))).status).toBe(200);
    expect(m.update.mock.calls[1][0].data.accountConfig.emailTemplates.verification.published).toEqual(defaultEmailTemplate("verification"));
    m.update.mockClear();
    expect((await POST(request("reset"))).status).toBe(200);
    expect(m.update.mock.calls[1][0].data.accountConfig.emailTemplates.verification.published).toBeNull();
  });
  it("rejects stale editors instead of overwriting their changes", async () => {
    expect((await POST(request("save", { revision: 1 }))).status).toBe(409);
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("previews only synthetic data without saving or sending", async () => {
    const context = await m.context(); m.context.mockResolvedValue({ ...context, permissions: ["content.read"] });
    const response = await POST(request("preview"));
    expect(response.status).toBe(200);
    const result = await response.json(); expect(result.html).toContain("123456"); expect(result.html).toContain("Kosykin");
    expect(m.update).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
    expect((await POST(request("test"))).status).toBe(403);
  });
  it("sends tests only to the editor, with the selected account category and explicit sample message", async () => {
    expect((await POST(request("test"))).status).toBe(200);
    expect(m.send.mock.calls[0][0]).toMatchObject({ to: "editor@example.test", storeSlug: "kosykin", category: "account", templateKey: "verification", text: expect.stringContaining("example data only") });
    expect((await POST(request("test", { to: "someone@example.test" }))).status).toBe(400);
    m.rate.mockResolvedValue({ allowed: false });
    expect((await POST(request("test"))).status).toBe(429);
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-origin writes, unsafe fields and unrecognised store overrides", async () => {
    m.origin.mockReturnValue(false); expect((await POST(request("save"))).status).toBe(403);
    m.origin.mockReturnValue(true); expect((await POST(request("save", { storeId: "tapkin-store" }))).status).toBe(400);
    expect((await POST(request("save", { template: { ...defaultEmailTemplate("verification"), subject: "{{secret}}" } }))).status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
});
