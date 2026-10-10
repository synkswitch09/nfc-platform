import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ context: vi.fn(), manage: vi.fn(), origin: vi.fn(), order: vi.fn(), refund: vi.fn(), reconcile: vi.fn(), queue: vi.fn(), notices: vi.fn(), config: vi.fn(), shipping: vi.fn() }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: m.context, hasPermission: m.manage }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/db", () => ({ db: { order: { findFirst: m.order } } }));
vi.mock("@/lib/refunds", () => ({ requestFullRefund: m.refund, restockRefundedOrder: vi.fn(), processRefund: vi.fn(), processPendingRefunds: m.reconcile, RefundError: class extends Error {} }));
vi.mock("@/lib/order-notifications", () => ({ notifyPaidOrder: m.queue, processOrderNotifications: m.notices }));
vi.mock("@/lib/loyalty", () => ({ processLoyaltyExpiry: async () => ({ checked: 0 }) }));
vi.mock("@/lib/measurement", () => ({ processMeasurementDeliveries: async () => ({ checked: 0 }) }));
vi.mock("@/lib/support-notifications", () => ({ processSupportNotifications: async () => ({ checked: 0 }) }));
vi.mock("@/lib/shippit-preparation", () => ({ processShippitPreparations: m.shipping }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: m.config }));
import { POST } from "@/app/api/admin/orders/[orderId]/operations/route";
import { POST as worker } from "@/app/api/integrations/orders/process/route";
const request = () => new NextRequest("https://test.example/api/admin/orders/o/operations", { method: "POST", body: JSON.stringify({ action: "refund", confirmed: true, reason: "Customer request", orderNumber: "T1", amountCents: 1000 }) });
beforeEach(() => {
  vi.resetAllMocks();
  m.shipping.mockResolvedValue({ checked: 0 });
  m.origin.mockReturnValue(true);
  m.manage.mockReturnValue(true);
  m.context.mockResolvedValue({ store: { id: "s" }, user: { id: "a" } });
  m.config.mockReturnValue({ stripe: { reconcileSecret: "test-secret" } });
});
it("rejects non-admin callers before querying an order", async () => {
  m.manage.mockReturnValue(false);
  expect((await POST(request(), { params: Promise.resolve({ orderId: "o" }) })).status).toBe(403);
  expect(m.order).not.toHaveBeenCalled();
});
it("rejects another store's order before financial side effects", async () => {
  m.order.mockResolvedValue(null);
  expect((await POST(request(), { params: Promise.resolve({ orderId: "o" }) })).status).toBe(404);
  expect(m.order.mock.calls[0][0].where).toEqual({ id: "o", storeId: "s" });
  expect(m.refund).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations", async () => {
  m.origin.mockReturnValue(false);
  expect((await POST(request(), { params: Promise.resolve({ orderId: "o" }) })).status).toBe(403);
  expect(m.refund).not.toHaveBeenCalled();
});
it("rejects an unauthenticated worker before processing either queue", async () => {
  expect((await worker(new NextRequest("https://test.example/api/integrations/orders/process", { method: "POST" }))).status).toBe(401);
  expect(m.reconcile).not.toHaveBeenCalled();
  expect(m.notices).not.toHaveBeenCalled();
  expect(m.shipping).not.toHaveBeenCalled();
});
it("continues processing notices if refund reconciliation fails", async () => {
  m.reconcile.mockRejectedValue(new Error("provider unavailable"));
  m.notices.mockResolvedValue({ checked: 1 });
  const response = await worker(new NextRequest("https://test.example/api/integrations/orders/process", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
  expect(await response.json()).toEqual({ loyalty: { checked: 0 }, measurement: { checked: 0 }, support: { checked: 0 }, shipping: { checked: 0 }, refunds: { error: "retry_required" }, notifications: { checked: 1 } });
});
