import { Prisma } from "@prisma/client";

export class InventoryConflict extends Error {}

export async function changeReservation(tx: Prisma.TransactionClient, input: { variantId: string; orderId: string; quantity: number; reason?: string; expectedReserved?: number }) {
  const { variantId, orderId, quantity, reason, expectedReserved } = input;
  if (!Number.isInteger(quantity) || quantity === 0 || (quantity > 0 && expectedReserved === undefined)) throw new InventoryConflict("Invalid reservation change");
  const changed = await tx.productVariant.updateMany({
    where: quantity > 0
      ? { id: variantId, reservedInventory: expectedReserved, inventory: { gte: (expectedReserved ?? 0) + quantity } }
      : { id: variantId, reservedInventory: { gte: -quantity } },
    data: { reservedInventory: { increment: quantity } },
  });
  if (changed.count !== 1) throw new InventoryConflict("Reserved stock changed. Refresh and try again.");
  await tx.inventoryMovement.create({ data: { variantId, orderId, quantity, reason, type: quantity > 0 ? "RESERVATION" : "RELEASE" } });
}

// Use the actual reservation ledger, not today's editable variant policy.
export async function orderReservations(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.inventoryMovement.groupBy({ by: ["variantId"], where: { orderId, type: { in: ["RESERVATION", "RELEASE"] } }, _sum: { quantity: true } });
  return new Map(rows.map(row => [row.variantId, row._sum.quantity ?? 0]));
}

export async function consumeStock(tx: Prisma.TransactionClient, input: { variantId: string; orderId: string; quantity: number; held: number; inventory: number; reservedInventory: number; backorder: boolean; reason?: string }) {
  const { variantId, orderId, quantity, held, inventory, reservedInventory, backorder } = input;
  if (held < 0 || held > reservedInventory || (held && held !== quantity)) throw new InventoryConflict("Order reservation does not match its quantity");
  const consumed = held ? quantity : backorder ? Math.min(quantity, Math.max(0, inventory - reservedInventory)) : quantity;
  if (consumed || held) {
    const changed = await tx.productVariant.updateMany({
      where: { id: variantId, reservedInventory, inventory: { gte: reservedInventory + consumed - held } },
      data: { inventory: { decrement: consumed }, reservedInventory: { decrement: held } },
    });
    if (changed.count !== 1) throw new InventoryConflict("Stock changed while confirming payment. Retry the operation.");
  }
  if (consumed) await tx.inventoryMovement.create({ data: { variantId, orderId, type: "SALE", quantity: -consumed, reason: input.reason } });
}

export async function adjustStock(tx: Prisma.TransactionClient, input: { variantId: string; storeId: string; actorId: string; quantity: number; expectedInventory: number; reason: string }) {
  const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, product: { storeId: input.storeId } } });
  if (!variant) return null;
  if (variant.inventory !== input.expectedInventory) throw new InventoryConflict("Stock changed since this page was loaded. Refresh before adjusting it.");
  if (input.quantity < variant.reservedInventory) throw new InventoryConflict("Stock cannot be lower than reserved units");
  const changed = await tx.productVariant.updateMany({ where: { id: variant.id, inventory: input.expectedInventory, reservedInventory: variant.reservedInventory }, data: { inventory: input.quantity } });
  if (changed.count !== 1) throw new InventoryConflict("Stock changed while saving. Refresh before adjusting it.");
  const difference = input.quantity - variant.inventory;
  if (difference) await tx.inventoryMovement.create({ data: { variantId: variant.id, actorId: input.actorId, type: "ADJUSTMENT", quantity: difference, reason: input.reason } });
  await tx.auditLog.create({ data: { actorId: input.actorId, storeId: input.storeId, action: "INVENTORY_ADJUSTED", entityType: "ProductVariant", entityId: variant.id, metadata: { from: variant.inventory, to: input.quantity, reason: input.reason } } });
  return { quantity: input.quantity, productId: variant.productId };
}
