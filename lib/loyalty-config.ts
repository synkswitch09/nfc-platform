import { z } from "zod";

export const loyaltyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  pointsPerDollar: z.number().int().min(1).max(10).default(1),
  redemptionUnitPoints: z.number().int().min(1).max(10000).default(100),
  redemptionUnitCents: z.number().int().min(1).max(10000).default(200),
  minimumRedeemPoints: z.number().int().min(1).max(100000).default(100),
  maximumRedeemPercent: z.number().int().min(1).max(50).default(10),
  expiryMonths: z.number().int().min(1).max(36).default(12),
  allowCouponStacking: z.boolean().default(false),
}).strict().refine(c => c.minimumRedeemPoints >= c.redemptionUnitPoints && c.minimumRedeemPoints % c.redemptionUnitPoints === 0, "Minimum redemption must be a multiple of the redemption unit");
export type LoyaltyConfig = z.infer<typeof loyaltyConfigSchema>;
export function parseLoyaltyConfig(document: unknown): LoyaltyConfig {
  const value = document && typeof document === "object" && !Array.isArray(document) ? (document as Record<string, unknown>).loyalty : undefined;
  const parsed = loyaltyConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { ...loyaltyConfigSchema.parse({}), enabled: false };
}
export function loyaltyExpiry(now: Date, months: number) {
  const result = new Date(now); const day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const end = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, end)); return result;
}
export function maximumRedeemPoints(c: LoyaltyConfig, balance: number, subtotalCents: number) {
  const budget = Math.floor(Math.max(0, subtotalCents) * c.maximumRedeemPercent / 100);
  const units = Math.min(Math.floor(Math.max(0, balance) / c.redemptionUnitPoints), Math.floor(budget / c.redemptionUnitCents));
  const points = units * c.redemptionUnitPoints;
  return points >= c.minimumRedeemPoints ? points : 0;
}
export function redemptionCents(c: LoyaltyConfig, points: number) {
  if (!Number.isSafeInteger(points) || points < c.minimumRedeemPoints || points % c.redemptionUnitPoints !== 0) throw new Error("Choose points in the permitted redemption units");
  return points / c.redemptionUnitPoints * c.redemptionUnitCents;
}
export function proportionalPoints(points: number, refundedCents: number, paidCents: number) {
  return paidCents > 0 ? Math.min(points, Math.floor(points * Math.max(0, refundedCents) / paidCents)) : 0;
}
