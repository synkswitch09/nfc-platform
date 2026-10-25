type PriceOption = { code: string; type: string; required: boolean; active?: boolean; priceDeltaCents: number; values: { priceDeltaCents: number; active?: boolean }[] };
export type CardPriceProduct = { variants: { priceCents: number; optionSelection?: unknown }[]; options?: PriceOption[]; personalisationMode?: string };

/** Use the same variant/option charging rules as checkout; mapped options are already priced in the variant. */
export function productCardPriceRange(product: CardPriceProduct) {
  const ranges = product.variants.map(variant => {
    let min = variant.priceCents, max = variant.priceCents;
    const mapped = variant.optionSelection && typeof variant.optionSelection === "object" ? variant.optionSelection : {};
    for (const option of product.options ?? []) {
      if (option.active === false || option.code in mapped) continue;
      const selection = ["SELECT", "RADIO", "COLOUR"].includes(option.type);
      if (!selection && product.personalisationMode === "NONE") continue;
      const values = option.values.filter(value => value.active !== false);
      const charges = selection ? values.map(value => option.priceDeltaCents + value.priceDeltaCents) : [option.priceDeltaCents];
      if (!option.required || option.type === "CHECKBOX" || (!selection && product.personalisationMode === "OPTIONAL")) charges.push(0);
      if (!charges.length) continue;
      min += Math.min(...charges);
      max += Math.max(...charges);
    }
    return { min, max };
  });
  if (!ranges.length) return null;
  const min = Math.min(...ranges.map(range => range.min));
  const max = Math.max(...ranges.map(range => range.max));
  return { min, max, varies: min !== max };
}
export function storefrontMoney(cents: number, currency: string) {
  const formatted = new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
  return currency.toUpperCase() === "AUD" ? `AUD ${formatted}` : formatted;
}
export function productCardPriceLabel(product: CardPriceProduct, currency: string) {
  const range = productCardPriceRange(product);
  return range ? `${range.varies ? "From " : ""}${storefrontMoney(range.min, currency)}` : "";
}
