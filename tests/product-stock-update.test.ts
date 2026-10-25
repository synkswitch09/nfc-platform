import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  find: vi.fn(), findVariant: vi.fn(), count: vi.fn(), updateVariant: vi.fn(), createVariant: vi.fn(), movement: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: async () => ({ user: { id: "admin" }, store: { id: "store" } }) }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: () => true, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock("@/lib/etsy", () => ({ queueEtsyInventorySync: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  product: { findFirst: mocks.find, count: mocks.count },
  $transaction: async (callback: (tx: unknown) => unknown) => callback({ product: { update: vi.fn() }, productVariant: { findFirst: mocks.findVariant, updateMany: mocks.updateVariant, create: mocks.createVariant }, productOption: { deleteMany: vi.fn() }, inventoryMovement: { create: mocks.movement }, auditLog: { create: mocks.audit } }),
} }));
import { PATCH } from "@/app/api/admin/products/[productId]/route";
const variantId = "00000000-0000-4000-8000-000000000001";
const product = { name: "Pet tag", slug: "pet-tag", description: "A durable NFC pet tag.", type: "PET", status: "DRAFT", brand: "Tapkin", variants: [{ id: variantId, sku: "PET-001", name: "Mint", priceCents: 2495, inventory: 999, lowStockThreshold: 5, backorderPolicy: "DENY" }], options: [] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue({ id: "p", slug: "pet-tag", legacySlugs: [], status: "DRAFT", variants: [{ id: variantId, inventory: 7, priceCents: 2495 }] });
  mocks.count.mockResolvedValue(0);
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
const madeToOrderPayload = { ...product, variants: [{ ...product.variants[0], trackInventory: false, productionMinutes: 45, inventory: 0, lowStockThreshold: 0 }] };
const save = (body: unknown) => PATCH(new NextRequest("https://example.test/api/admin/products/p", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ productId: "p" }) });
it.each([{ inventory: 7, reservedInventory: 0 }, { inventory: 7, reservedInventory: 2 }])("allows editing an existing made-to-order variant with legacy counters without changing its inventory or reservations: %j", async counters => {
  mocks.findVariant.mockResolvedValue({ trackInventory: false, ...counters });
  const response = await save(madeToOrderPayload);
  expect(response.status).toBe(200);
  expect(mocks.findVariant).toHaveBeenCalledWith(expect.objectContaining({ where: { id: variantId, productId: "p" }, select: expect.objectContaining({ trackInventory: true }) }));
  for (const [args] of mocks.updateVariant.mock.calls) {
    expect(args.data).not.toHaveProperty("inventory");
    expect(args.data).not.toHaveProperty("reservedInventory");
  }
  expect(mocks.movement).not.toHaveBeenCalled();
});
it("still blocks changing a stocked variant to made to order and identifies the exact field and quantities", async () => {
  mocks.findVariant.mockResolvedValue({ trackInventory: true, inventory: 7, reservedInventory: 2 });
  const response = await save(madeToOrderPayload);
  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.error).toContain("7 units on hand and 2 reserved");
  expect(body.issues).toEqual([expect.objectContaining({ path: "variants.0.trackInventory", field: "Variant 1 — fulfilment method", section: "variants" })]);
  expect(mocks.updateVariant).not.toHaveBeenCalled();
  expect(mocks.movement).not.toHaveBeenCalled();
});
it("allows changing an in-stock variant once both on-hand and reserved stock are zero", async () => {
  mocks.findVariant.mockResolvedValue({ trackInventory: true, inventory: 0, reservedInventory: 0 });
  expect((await save(madeToOrderPayload)).status).toBe(200);
  expect(mocks.updateVariant).toHaveBeenCalledWith(expect.objectContaining({ where: { id: variantId, productId: "p" }, data: expect.objectContaining({ trackInventory: false, productionMinutes: 45 }) }));
});
