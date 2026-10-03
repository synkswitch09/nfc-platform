import type { Promotion } from "@prisma/client";

export type PromotionLine = { productId: string; unitPriceCents: number; quantity: number; weightGrams: number };
export function calculatePromotion(promotion: Promotion, lines: PromotionLine[], shippingCents: number, destinationCountry: string) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  if (subtotal < promotion.minimumSubtotalCents) return 0;
  const eligible = lines.filter(line => !promotion.productId || promotion.productId === line.productId);
  if (!eligible.length) return 0;
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  if (promotion.kind === "PERCENT") return Math.min(eligibleSubtotal, Math.floor(eligibleSubtotal * (promotion.percent ?? 0) / 100));
  if (promotion.kind === "FIXED") return Math.min(eligibleSubtotal, promotion.amountCents ?? 0);
  if (destinationCountry !== "AU") return 0;
  const totalWeight = lines.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0);
  if (promotion.maxShippingWeightGrams !== null && totalWeight > promotion.maxShippingWeightGrams) return 0;
  const eligibleWeight = eligible.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0);
  const share = promotion.productId && totalWeight ? Math.floor(shippingCents * eligibleWeight / totalWeight) : shippingCents;
  return Math.min(share, promotion.maxShippingDiscountCents ?? shippingCents);
}
