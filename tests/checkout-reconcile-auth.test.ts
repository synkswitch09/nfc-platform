import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ secret: "a".repeat(32), reconcile: vi.fn() }));
vi.mock("@/lib/config", () => ({ getRuntimeConfig: () => ({ stripe: { reconcileSecret: mocks.secret } }) }));
vi.mock("@/lib/checkout-reconciliation", () => ({ reconcilePendingCheckouts: mocks.reconcile }));
vi.mock("@/lib/order-service", () => ({ CheckoutError: class extends Error {} }));
import { POST } from "@/app/api/integrations/checkout/reconcile/route";
beforeEach(() => { vi.clearAllMocks(); mocks.secret = "a".repeat(32); });
it.each([undefined, "Bearer wrong"])("rejects scheduler requests without the correct secret", async authorization => {
  const response = await POST(new NextRequest("https://example.test/api/integrations/checkout/reconcile", { method: "POST", headers: authorization ? { authorization } : {} }));
  expect(response.status).toBe(401);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("is disabled when no secret is configured", async () => {
  mocks.secret = "";
  expect((await POST(new NextRequest("https://example.test/api/integrations/checkout/reconcile", { method: "POST", headers: { authorization: "Bearer " } }))).status).toBe(401);
});
it("accepts a valid scheduler and rejects malformed pagination", async () => {
  mocks.reconcile.mockResolvedValue({ outcomes: [], nextCursor: null });
  const init = { method: "POST", headers: { authorization: `Bearer ${mocks.secret}` } };
  expect((await POST(new NextRequest("https://example.test/api/integrations/checkout/reconcile", init))).status).toBe(200);
  expect((await POST(new NextRequest("https://example.test/api/integrations/checkout/reconcile?cursor=bad", init))).status).toBe(400);
});
