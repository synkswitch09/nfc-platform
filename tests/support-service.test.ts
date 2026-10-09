import { beforeEach, expect, it, vi } from "vitest";
import type { Storefront } from "@/lib/storefront";
const m = vi.hoisted(() => ({ order: vi.fn(), lock: vi.fn(), current: vi.fn(), ticket: vi.fn(), audit: vi.fn(), notice: vi.fn(), find: vi.fn(), create: vi.fn(), user: vi.fn(), cookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/db", () => ({ db: { supportAccess: { findFirst: m.find }, order: { findFirst: m.order }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ order: { update: m.lock, findFirstOrThrow: m.current }, orderSupportRequest: { create: m.ticket }, auditLog: { create: m.audit }, supportNotification: { createMany: m.create } }) } }));
vi.mock("@/lib/crypto", () => ({ sha256: (s: string) => `hashed:${s}` }));
import { parseAccountConfig } from "@/lib/account-config";
import { supportIdentity, ticketOwner } from "@/lib/support-access";
import { createSupportTicket, publicSupportTicket } from "@/lib/support-service";
const store = { id: "s", slug: "kosykin", displayName: "Kosykin", origin: "https://kosykin.com.au", timezone: "Australia/Adelaide", accountConfig: {} } as Storefront;
const identity = { email: "verified@example.test", userId: null, name: null };
beforeEach(() => {
  vi.resetAllMocks(); m.order.mockResolvedValue({ id: "o" }); m.current.mockResolvedValue({ status: "PAID", preparationStartedAt: null, items: [{ packedQuantity: 0, manufacturingJobs: [] }] }); m.ticket.mockResolvedValue({ id: "t" });
});
it("requires a verified store-bound session for guest access", async () => {
  m.user.mockResolvedValue(null); m.cookie.mockReturnValue({ value: "secret" }); m.find.mockResolvedValue({ email: identity.email });
  expect(await supportIdentity(store)).toEqual(identity);
  expect(m.find.mock.calls[0][0].where).toMatchObject({ storeId: "s", sessionHash: "hashed:secret", verifiedAt: { not: null } });
  m.find.mockResolvedValue(null); expect(await supportIdentity(store)).toBeNull();
});
it("can disable guest access without disabling verified account tickets", async () => {
  expect(await supportIdentity({ ...store, accountConfig: parseAccountConfig({ support: { guestEnabled: false } }) })).toBeNull();
  m.user.mockResolvedValue({ id: "u", email: identity.email, name: "Alex" });
  expect(await supportIdentity(store)).toMatchObject({ userId: "u" });
});
it("locks the order and records a high-priority pause and deadline before notifying", async () => {
  const result = await createSupportTicket(store, identity, { kind: "CANCELLATION_REQUEST", message: "Please review cancellation", orderNumber: "K1", attachments: [] });
  expect(result.held).toBe(true);
  expect(m.lock).toHaveBeenCalledBefore(m.current); expect(m.current).toHaveBeenCalledBefore(m.ticket);
  expect(m.order.mock.calls[0][0].where).toMatchObject({ storeId: "s", orderNumber: "K1" });
  expect(m.ticket.mock.calls[0][0].data).toMatchObject({ customerEmail: identity.email, verifiedAt: expect.any(Date), responseDueAt: expect.any(Date), priority: "HIGH", holdActive: true });
  expect(m.create.mock.calls[0][0].data[0].text).toContain("not a cancellation or refund approval");
});
it("accepts general and privacy tickets without an order and never pauses", async () => {
  await createSupportTicket(store, identity, { kind: "PRIVACY", message: "Please explain my data use", attachments: [] });
  expect(m.order).not.toHaveBeenCalled(); expect(m.lock).not.toHaveBeenCalled();
  expect(m.ticket.mock.calls[0][0].data.holdActive).toBe(false);
});
it("never pauses an already-started order, or a delivery inquiry", async () => {
  m.current.mockResolvedValue({ status: "PROCESSING", preparationStartedAt: new Date(), items: [] });
  expect((await createSupportTicket(store, identity, { kind: "ADDRESS_CHANGE", message: "Please change my address", attachments: [] }, "o")).held).toBe(false);
  m.current.mockResolvedValue({ status: "PAID", items: [] });
  expect((await createSupportTicket(store, identity, { kind: "DELIVERY", message: "Where is my delivery please", attachments: [] }, "o")).held).toBe(false);
});
it("rejects an unrelated order or a disabled topic without creating a ticket", async () => {
  m.order.mockResolvedValue(null);
  await expect(createSupportTicket(store, identity, { kind: "CANCELLATION_REQUEST", message: "Please cancel order", orderNumber: "other", attachments: [] })).rejects.toThrow("Order not found");
  await expect(createSupportTicket({ ...store, accountConfig: parseAccountConfig({ requestTopics: ["GENERAL"] }) }, identity, { kind: "PRIVACY", message: "Privacy question please", attachments: [] })).rejects.toThrow("unavailable");
  expect(m.ticket).not.toHaveBeenCalled();
});
it("queues internal alerts only to CMS recipients and keeps message contents in the CMS", async () => {
  await createSupportTicket({ ...store, accountConfig: parseAccountConfig({ support: { notificationEmails: ["ops@example.test"] } }) }, identity, { kind: "GENERAL", message: "Private customer information", attachments: [] });
  const notice = m.create.mock.calls[1][0].data[0]; expect(notice.to).toBe("ops@example.test"); expect(notice.text).not.toContain("Private customer information");
});
it("returns only customer-visible data, never internal notes or base64 photos", () => {
  const ticket = { id: "t", orderId: null, kind: "GENERAL", message: "Help", status: "OPEN", priority: "NORMAL", holdActive: false, responseDueAt: null, createdAt: new Date(), replies: [], attachments: [{ data: "PRIVATE" }], adminNote: "INTERNAL", customerEmail: identity.email };
  const result = publicSupportTicket(ticket);
  expect(result).not.toHaveProperty("adminNote"); expect(result).not.toHaveProperty("customerEmail"); expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(ticketOwner(identity)).toEqual({ OR: [{ customerEmail: { equals: identity.email, mode: "insensitive" } }] });
});
