type CardImage = { id?: string; url: string; altText: string; optionValueId?: string | null; variantId?: string | null };
type ColourProduct = {
  images: CardImage[];
  options?: { code: string; type: string; values: { id: string; value: string; label: string }[] }[];
  variants: { id?: string; imageId?: string | null; colour?: string | null; optionSelection?: unknown }[];
};

/** Match CMS associations only; never guess a colour from filenames or image order. */
export function cardColourImage(product: ColourProduct, value: string): CardImage | undefined {
  const option = product.options?.find(item => item.type === "COLOUR");
  const colour = option?.values.find(item => item.value === value);
  if (!option || !colour) return;
  const variants = product.variants.filter(variant => {
    const selections = variant.optionSelection;
    if (selections && typeof selections === "object" && option.code in selections) return (selections as Record<string, unknown>)[option.code] === value;
    return variant.colour?.toLowerCase() === colour.label.toLowerCase() || variant.colour?.toLowerCase() === value.toLowerCase();
  });
  return product.images.find(image => image.optionValueId === colour.id && !image.variantId)
    ?? variants.map(variant => product.images.find(image => (variant.imageId && image.id === variant.imageId) || (variant.id && image.variantId === variant.id))).find(Boolean);
}
