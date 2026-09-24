export function validCanonicalOverride(value: string | null | undefined, origin: string) {
  if (!value?.trim()) return true;
  try {
    const url = new URL(value);
    const site = new URL(origin);
    return url.origin === site.origin && url.protocol === site.protocol && !url.username && !url.password && !url.search && !url.hash && url.pathname.startsWith("/");
  } catch { return false; }
}

export function canonicalForStore(origin: string, path: string, override?: string | null) {
  return validCanonicalOverride(override, origin) && override?.trim() ? override.trim() : new URL(path, origin).toString();
}

export function nonEmpty(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

type VariantOffer = { sku: string; priceCents: number; inventory: number; reservedInventory: number; trackInventory: boolean; backorderPolicy: string; optionSelection: unknown };
type PriceOption = { code: string; type: string; required: boolean; active: boolean; priceDeltaCents: number; values: { value: string; active: boolean; priceDeltaCents: number }[] };

export function variantOfferPrice(variant: VariantOffer, options: PriceOption[], personalisationMode: string) {
  const selected = variant.optionSelection && typeof variant.optionSelection === "object" && !Array.isArray(variant.optionSelection) ? variant.optionSelection as Record<string, unknown> : {};
  let surcharge = 0;
  for (const option of options.filter(item => item.active)) {
    if (["SELECT", "RADIO", "COLOUR"].includes(option.type)) {
      const matching = typeof selected[option.code] === "string" ? option.values.find(item => item.active && item.value === selected[option.code]) : null;
      if (selected[option.code] && !matching) return null;
      if (matching) surcharge += option.priceDeltaCents + matching.priceDeltaCents;
      else if (option.required) {
        const values = option.values.filter(item => item.active);
        if (!values.length) return null;
        surcharge += option.priceDeltaCents + Math.min(...values.map(item => item.priceDeltaCents));
      }
    } else if (personalisationMode === "REQUIRED" && option.required && option.type !== "CHECKBOX") surcharge += option.priceDeltaCents;
  }
  return ((variant.priceCents + surcharge) / 100).toFixed(2);
}

export function productOffers(variants: VariantOffer[], options: PriceOption[], personalisationMode: string, currency: string, url: string) {
  return variants.flatMap(variant => {
    const price = variantOfferPrice(variant, options, personalisationMode);
    if (price === null) return [];
    return [{ "@type": "Offer", sku: variant.sku, priceCurrency: currency, price,
      availability: !variant.trackInventory || variant.inventory > variant.reservedInventory ? "https://schema.org/InStock" : variant.backorderPolicy === "ALLOW" ? "https://schema.org/BackOrder" : "https://schema.org/OutOfStock",
      url }];
  });
}
