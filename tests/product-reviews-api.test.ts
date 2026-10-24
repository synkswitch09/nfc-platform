import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ identity: vi.fn(), item: vi.fn(), create: vi.fn(), enabled: vi.fn(), origin: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { orderItem: { findFirst: m.item }, productReview: { create: m.create } } }));
vi.mock("@/lib/storefront", () => ({ getCurrentStorefront: async () => ({ id: "store" }) }));
vi.mock("@/lib/support-access", () => ({ supportIdentity: m.identity, supportOrderOwner: () => ({ userId: "buyer" }) }));
vi.mock("@/lib/store-experience", () => ({ getExperience: m.enabled }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: m.origin, getClientIp: () => "127.0.0.1", jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.limit }));
import { POST } from "@/app/api/products/[productId]/reviews/route";
const payload = { orderItemId: "00000000-0000-4000-8000-000000000001", rating: 2, displayName: "Buyer", body: "Useful but could be improved." };
const request = (body: unknown = payload) => new NextRequest("https://shop.test/api/products/p/reviews", { method: "POST", body: JSON.stringify(body) });
const productId = "00000000-0000-4000-8000-000000000002";
const params = { params: Promise.resolve({ productId }) };
beforeEach(() => { vi.resetAllMocks(); m.origin.mockReturnValue(true); m.enabled.mockResolvedValue({ config: { reviewsEnabled: true } }); m.identity.mockResolvedValue({ userId: "buyer", email: "buyer@example.test" }); m.limit.mockResolvedValue({ allowed: true }); m.item.mockResolvedValue({ orderId: "order" }); });
it("accepts critical verified reviews as pending and scopes the purchase to this store, product and buyer", async () => {
  expect((await POST(request(), params)).status).toBe(201);
  expect(m.item.mock.calls[0][0].where).toMatchObject({ id: payload.orderItemId, variant: { productId, product: { storeId: "store" } }, order: { storeId: "store", AND: [{ status: { in: expect.arrayContaining(["PAID", "DELIVERED"]) }, payments: { some: { status: "SUCCEEDED" } } }, { userId: "buyer" }] } });
  expect(m.create).toHaveBeenCalledWith({ data: { ...payload, storeId: "store", productId, orderId: "order", status: "PENDING" } });
});
it("rejects anonymous users and other customers' order items", async () => {
  m.identity.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(401);
  m.identity.mockResolvedValue({ email: "buyer@example.test" }); m.item.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(403); expect(m.create).not.toHaveBeenCalled();
});
it("blocks foreign origins, paused reviews, rate limits, invalid ratings and duplicate purchase reviews", async () => {
  m.origin.mockReturnValue(false); expect((await POST(request(), params)).status).toBe(403); m.origin.mockReturnValue(true);
  m.enabled.mockResolvedValue({ config: { reviewsEnabled: false } }); expect((await POST(request(), params)).status).toBe(409); m.enabled.mockResolvedValue({ config: { reviewsEnabled: true } });
  m.limit.mockResolvedValue({ allowed: false }); expect((await POST(request(), params)).status).toBe(429); m.limit.mockResolvedValue({ allowed: true });
  expect((await POST(request({ ...payload, rating: 6 }), params)).status).toBe(400);
  m.create.mockRejectedValue({ code: "P2002" }); expect((await POST(request(), params)).status).toBe(409);
});
