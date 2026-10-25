import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { StoreCapability } from "@prisma/client";
const m = vi.hoisted(() => ({ context: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context, canManageStore: () => true }));
vi.mock("@/lib/db", () => ({ db: { store: { update: m.update }, auditLog: { create: m.audit }, $transaction: m.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: () => true, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
import { PATCH } from "@/app/api/admin/storefront/route";
const request = (body: unknown) => new NextRequest("https://shop.test/api/admin/storefront", { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); });
it.each([[StoreCapability.COMMERCE, StoreCapability.PRINT_3D], [StoreCapability.NFC], [StoreCapability.PET_PROFILE]])("blocks pet profile writes without the complete NFC/pet module: %j", async (...capabilities) => {
  m.context.mockResolvedValue({ store: { id: "kosykin", capabilities }, user: { id: "admin" } });
  const response = await PATCH(request({ area: "pet-profile", config: {} }));
  expect(response.status).toBe(404);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("allows the enabled Tapkin module and scopes its update and audit to the current store", async () => {
  m.context.mockResolvedValue({ store: { id: "tapkin", capabilities: [StoreCapability.NFC, StoreCapability.PET_PROFILE] }, user: { id: "admin" } });
  expect((await PATCH(request({ area: "pet-profile", config: {} }))).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tapkin" }, data: { petProfileConfig: expect.any(Object) } }));
  expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ storeId: "tapkin", entityId: "tapkin" }) }));
});
it("keeps ordinary Kosykin footer editing available without NFC capabilities", async () => {
  m.context.mockResolvedValue({ store: { id: "kosykin", capabilities: [StoreCapability.COMMERCE, StoreCapability.PRINT_3D] }, user: { id: "admin" } });
  expect((await PATCH(request({ area: "footer", config: { support: { instagramHref: "https://ig.me/m/example", responseText: "We reply within 2 days." } }, socialLinks: { instagram: "", facebook: "", tiktok: "", linkedin: "" } }))).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "kosykin" }, data: expect.objectContaining({ footerConfig: expect.objectContaining({ support: expect.objectContaining({ instagramHref: "https://ig.me/m/example", responseText: "We reply within 2 days." }) }) }) }));
});
it("returns all validation paths and actionable corrections without saving invalid footer settings", async () => {
  m.context.mockResolvedValue({ store: { id: "kosykin", capabilities: [StoreCapability.COMMERCE] }, user: { id: "admin" } });
  const response = await PATCH(request({ area: "footer", config: { textSizePx: 0, support: { headlineTypography: { sizePx: 7 } } }, socialLinks: { instagram: "", facebook: "", tiktok: "", linkedin: "" } }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Check the highlighted fields before saving.", issues: expect.arrayContaining([
    expect.objectContaining({ path: "config.textSizePx", field: "textSizePx", message: expect.stringContaining("at least 8") }),
    expect.objectContaining({ path: "config.support.headlineTypography.sizePx", field: "supportHeadlineTypography-size", message: expect.stringContaining("at least 8") }),
  ]) });
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it("saves unchanged footer defaults without requiring hidden legacy social URLs", async () => {
  m.context.mockResolvedValue({ store: { id: "kosykin", capabilities: [StoreCapability.COMMERCE] }, user: { id: "admin" } });
  const response = await PATCH(request({ area: "footer", config: {} }));
  expect(response.status).toBe(200);
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("socialLinks");
});
