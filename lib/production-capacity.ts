import { DeploymentEnvironment, type Prisma } from "@prisma/client";

export class ProductionCapacityError extends Error {
  constructor(message: string) { super(message); }
}

export function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  for (let added = 0; added < days;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) added++;
  }
  return date;
}

export function productionForecast(usedMinutes: number, requestedMinutes: number, weeklyCapacityMinutes: number, maxBusinessDays: number, today = new Date()) {
  const daily = weeklyCapacityMinutes / 5;
  if (daily <= 0 || requestedMinutes <= 0 || usedMinutes + requestedMinutes > daily * maxBusinessDays) return null;
  return addBusinessDays(today, Math.max(1, Math.ceil((usedMinutes + requestedMinutes) / daily)));
}

export function canAcceptVariant(variant: { trackInventory: boolean; backorderPolicy: string; inventory: number; reservedInventory: number; productionMinutes: number | null }, pool: { paused: boolean; weeklyCapacityMinutes: number; maxBusinessDays: number } | null, usedMinutes: number) {
  if (variant.trackInventory && variant.inventory > variant.reservedInventory) return true;
  if (variant.trackInventory && variant.backorderPolicy !== "ALLOW") return false;
  if (!variant.productionMinutes) return false;
  return !(pool?.paused ?? false) && Boolean(productionForecast(usedMinutes, variant.productionMinutes, pool?.weeklyCapacityMinutes ?? 360, pool?.maxBusinessDays ?? 10));
}

export function projectQueue<T extends { minutes: number; promisedAt: Date }>(bookings: T[], weeklyMinutes: number, today = new Date()) {
  let occupied = 0;
  const daily = Math.max(1, weeklyMinutes / 5);
  return bookings.map(booking => {
    occupied += booking.minutes;
    const recalculated = addBusinessDays(today, Math.max(1, Math.ceil(occupied / daily)));
    return { ...booking, recalculated, atRisk: recalculated > booking.promisedAt };
  });
}

export async function reserveProduction(tx: Prisma.TransactionClient, environment: DeploymentEnvironment, orderId: string, minutes: number) {
  if (!minutes) return null;
  const pool = await tx.productionPool.upsert({ where: { environment }, update: { version: { increment: 1 }, reviewedAt: null }, create: { environment, version: 1 } });
  if (pool.paused) throw new ProductionCapacityError("Made-to-order purchases are temporarily paused. In-stock items remain available.");
  const occupied = await tx.productionBooking.aggregate({ where: { environment, releasedAt: null }, _sum: { minutes: true } });
  const promisedAt = productionForecast(occupied._sum.minutes ?? 0, minutes, pool.weeklyCapacityMinutes, pool.maxBusinessDays);
  if (!promisedAt) throw new ProductionCapacityError("The production queue is full. Please try again when new slots open.");
  await tx.productionBooking.create({ data: { environment, orderId, minutes, promisedAt } });
  return promisedAt;
}

export async function releaseProduction(tx: Prisma.TransactionClient, orderId: string) {
  await tx.productionBooking.updateMany({ where: { orderId, releasedAt: null }, data: { releasedAt: new Date() } });
}
