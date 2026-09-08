export function calculateOrderTotals(items: Array<{ unitPriceCents: number; quantity: number }>) {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const shippingCents = subtotalCents >= 6000 ? 0 : 900;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
