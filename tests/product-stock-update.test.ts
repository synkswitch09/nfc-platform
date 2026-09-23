import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  find: vi.fn(), updateVariant: vi.fn(), createVariant: vi.fn(), movement: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: async () => ({ user: { id: "admin" }, store: { id: "store" } }) }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: () => true, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/etsy", () => ({ queueEtsyInventorySync: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  product: { findFirst: mocks.find },
  $transaction: async (callback: (tx: unknown) => unknown) => callback({ product: { update: vi.fn() }, productVariant: { updateMany: mocks.updateVariant, create: mocks.createVariant }, productOption: { deleteMany: vi.fn() }, inventoryMovement: { create: mocks.movement }, auditLog: { create: mocks.audit } }),
} }));
import { PATCH } from "@/app/api/admin/products/[productId]/route";
const variantId = "00000000-0000-4000-8000-000000000001";
const product = { name: "Pet tag", slug: "pet-tag", description: "A durable NFC pet tag.", type: "PET", status: "DRAFT", brand: "Tapkin", variants: [{ id: variantId, sku: "PET-001", name: "Mint", priceCents: 2495, inventory: 999, lowStockThreshold: 5, backorderPolicy: "DENY" }], options: [] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue({ id: "p", status: "DRAFT", variants: [{ id: variantId, inventory: 7, priceCents: 2495 }] });
  mocks.updateVariant.mockResolvedValue({ count: 1 });
  mocks.createVariant.mockResolvedValue({ id: "new" });
});
it("editing a product with an old stock value cannot overwrite current inventory", async () => {
  const response = await PATCH(new NextRequest("https://example.test/api/admin/products/p", { method: "PATCH", body: JSON.stringify(product) }), { params: Promise.resolve({ productId: "p" }) });
  expect(response.status).toBe(200);
  for (const [args] of mocks.updateVariant.mock.calls) expect(args.data).not.toHaveProperty("inventory");
  expect(mocks.movement).not.toHaveBeenCalled();
});
it("a new variant receives its explicit initial stock and an attributed movement", async () => {
  const payload = { ...product, variants: [{ ...product.variants[0], id: undefined, inventory: 3 }] };
  const response = await PATCH(new NextRequest("https://example.test/api/admin/products/p", { method: "PATCH", body: JSON.stringify(payload) }), { params: Promise.resolve({ productId: "p" }) });
  expect(response.status).toBe(200);
  expect(mocks.createVariant.mock.calls[0][0].data.inventory).toBe(3);
  expect(mocks.movement.mock.calls[0][0].data).toMatchObject({ variantId: "new", actorId: "admin", type: "ADJUSTMENT", quantity: 3 });
});
