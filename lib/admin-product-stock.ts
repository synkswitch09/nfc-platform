type VariantStock = { trackInventory: boolean; inventory: number; reservedInventory: number };

export function adminProductStock(variants: VariantStock[]) {
  const stocked = variants.filter(variant => variant.trackInventory);
  const madeToOrder = variants.some(variant => !variant.trackInventory);
  const available = stocked.reduce((sum, variant) => sum + Math.max(0, variant.inventory - variant.reservedInventory), 0);
  return {
    label: !stocked.length && madeToOrder ? "Made to order" : `${available}${madeToOrder ? " + made to order" : ""}`,
    low: stocked.length > 0 && available <= 5,
  };
}
