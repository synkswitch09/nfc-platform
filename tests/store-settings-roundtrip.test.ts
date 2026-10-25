import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { storefrontThemeSchema } from "@/lib/storefront-theme";
const m = vi.hoisted(() => ({ context: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context, canManageStore: () => true }));
vi.mock("@/lib/db", () => ({ db: { store: { update: m.update }, auditLog: { create: m.audit }, $transaction: m.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: () => true, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
import { POST } from "@/app/api/admin/settings/route";
const payload = { storeName: "Kosykin", supportEmail: "hello@kosykin.com.au", currency: "AUD", defaultCountry: "AU", timezone: "Australia/Adelaide", siteTitle: "Kosykin shop", siteDescription: "Thoughtful products for everyday spaces.", flatRateCents: 900, freeOverCents: 10000, theme: storefrontThemeSchema.parse({}) };
const request = (body: unknown) => new NextRequest("https://kosykin.test/api/admin/settings", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); m.context.mockResolvedValue({ user: { id: "admin" }, store: { id: "kosykin", capabilities: [], organization: {}, homepage: { legacyValue: true } } }); });
it("saves general settings with optional fields blank without revalidating or replacing hidden chrome and home", async () => {
  const response = await POST(request({ ...payload, businessName: "", businessAbn: "", registeredBusinessName: "", logoUrl: "", faviconUrl: "", googleSiteVerification: "", defaultSocialImageUrl: "" }));
  expect(response.status).toBe(200);
  const data = m.update.mock.calls[0][0].data;
  expect(data).not.toHaveProperty("headerConfig");
  expect(data).not.toHaveProperty("footerConfig");
  expect(data).not.toHaveProperty("homepage");
});
it("returns the exact path for a real invalid visible setting", async () => {
  const response = await POST(request({ ...payload, theme: { ...payload.theme, typography: { ...payload.theme.typography, body: { ...payload.theme.typography.body, sizePx: 0 } } } }));
  expect(response.status).toBe(400);
  expect((await response.json()).issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "theme.typography.body.sizePx", message: expect.stringContaining("at least 8") })]));
  expect(m.update).not.toHaveBeenCalled();
});
