import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { adjustStock, changeReservation, consumeStock } from "@/lib/inventory-service";

const models = { productVariant: { findFirst: vi.fn(), updateMany: vi.fn() }, inventoryMovement: { create: vi.fn() }, auditLog: { create: vi.fn() } };
const tx = models as unknown as Prisma.TransactionClient;
beforeEach(() => { vi.resetAllMocks(); models.productVariant.updateMany.mockResolvedValue({ count: 1 }); });

describe("inventory mutations", () => {
  it("refuses stale absolute adjustments without writing inventory", async () => {
    models.productVariant.findFirst.mockResolvedValue({ id: "v", productId: "p", inventory: 7, reservedInventory: 2 });
    await expect(adjustStock(tx, { variantId: "v", storeId: "s", actorId: "a", quantity: 12, expectedInventory: 10, reason: "Count" })).rejects.toThrow("changed since");
    expect(models.productVariant.updateMany).not.toHaveBeenCalled();
  });
  it("checks reservations and records the real adjustment with its actor", async () => {
    models.productVariant.findFirst.mockResolvedValue({ id: "v", productId: "p", inventory: 7, reservedInventory: 2 });
    await expect(adjustStock(tx, { variantId: "v", storeId: "s", actorId: "a", quantity: 1, expectedInventory: 7, reason: "Count" })).rejects.toThrow("reserved units");
    await adjustStock(tx, { variantId: "v", storeId: "s", actorId: "a", quantity: 9, expectedInventory: 7, reason: "Count" });
    expect(models.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: "v", inventory: 7, reservedInventory: 2 }, data: { inventory: 9 } });
    expect(models.inventoryMovement.create).toHaveBeenCalledWith({ data: { variantId: "v", actorId: "a", type: "ADJUSTMENT", quantity: 2, reason: "Count" } });
  });
  it("does not record a release when stock counters reject it", async () => {
    models.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(changeReservation(tx, { variantId: "v", orderId: "o", quantity: -2 })).rejects.toThrow("Reserved stock changed");
    expect(models.inventoryMovement.create).not.toHaveBeenCalled();
  });
  it("backorders consume only unreserved physical units, preserving other checkouts", async () => {
    await consumeStock(tx, { variantId: "v", orderId: "o", quantity: 5, held: 0, inventory: 4, reservedInventory: 3, backorder: true });
    expect(models.productVariant.updateMany.mock.calls[0][0]).toMatchObject({ where: { reservedInventory: 3, inventory: { gte: 4 } }, data: { inventory: { decrement: 1 }, reservedInventory: { decrement: 0 } } });
    expect(models.inventoryMovement.create.mock.calls[0][0].data.quantity).toBe(-1);
  });
  it("consumes the order's held units together with their reservation", async () => {
    await consumeStock(tx, { variantId: "v", orderId: "o", quantity: 2, held: 2, inventory: 5, reservedInventory: 4, backorder: false });
    expect(models.productVariant.updateMany.mock.calls[0][0].data).toEqual({ inventory: { decrement: 2 }, reservedInventory: { decrement: 2 } });
  });
});
