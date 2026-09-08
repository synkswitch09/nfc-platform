export function calculateOrderTotals(items: Array<{ unitPriceCents: number; quantity: number }>, shipping = { flatRateCents: 900, freeOverCents: 6000 }) {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const shippingCents = subtotalCents >= shipping.freeOverCents ? 0 : shipping.flatRateCents;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
