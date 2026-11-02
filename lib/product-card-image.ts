type CardImage = { id?: string; url: string; altText: string; optionValueId?: string | null; variantId?: string | null };
type ColourProduct = {
  images: CardImage[];
  options?: { code: string; type: string; active?: boolean; values: { id: string; value: string; label: string; active?: boolean }[] }[];
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

/** One candidate per photographed, active colour, irrespective of size variants. */
export function cardCoverImages(product: ColourProduct, colours?: string[]): CardImage[] {
  const option = product.options?.find(item => item.type === "COLOUR" && item.active !== false);
  const candidates = option
    ? option.values.filter(value => value.active !== false && (!colours?.length || colours.includes(value.value))).map(value => cardColourImage(product, value.value))
    : product.variants.map(variant => product.images.find(image => (variant.imageId && image.id === variant.imageId) || (variant.id && image.variantId === variant.id)));
  const seen = new Set<string>();
  const images = candidates.filter((image): image is CardImage => {
    if (!image?.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
  return images.length ? images : product.images.slice(0, 1);
}

export function cardCoverImage(product: ColourProduct, identity: string, seed: number | null, colours?: string[]): CardImage | undefined {
  if (seed === null && !colours?.length) return product.images[0];
  const images = cardCoverImages(product, colours);
  let hash = 2166136261;
  for (const char of `${seed}:${identity}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return images[(hash >>> 0) % images.length];
}

/** Hover is a second view of the cover colour, not another random choice. */
export function cardHoverImage(product: ColourProduct, primary?: CardImage): CardImage | undefined {
  if (!primary) return;
  const different = (image: CardImage) => image.url !== primary.url;
  const option = product.options?.find(item => item.type === "COLOUR" && item.active !== false);
  if (option) {
    const colours = option.values.filter(value => value.active !== false);
    const belongs = (image: CardImage, colour: typeof colours[number]) => {
      if (image.optionValueId) return image.optionValueId === colour.id;
      return product.variants.some(variant => {
        const selections = variant.optionSelection;
        const matches = selections && typeof selections === "object" && option.code in selections
          ? (selections as Record<string, unknown>)[option.code] === colour.value
          : variant.colour?.toLowerCase() === colour.label.toLowerCase() || variant.colour?.toLowerCase() === colour.value.toLowerCase();
        return matches && ((variant.id && image.variantId === variant.id) || (variant.imageId && image.id === variant.imageId));
      });
    };
    const colour = colours.find(value => belongs(primary, value));
    if (colour) {
      const secondView = product.images.find(image => different(image) && belongs(image, colour));
      if (secondView) return secondView;
      return colours.filter(value => value.id !== colour.id).map(value => cardColourImage(product, value.value)).find(image => image && different(image));
    }
  }
  // Legacy galleries can identify colour through their variant without a colour option.
  const variant = product.variants.find(item => (item.id && primary.variantId === item.id) || (item.imageId && primary.id === item.imageId));
  if (variant) {
    const sameColour = product.variants.filter(item => variant.colour ? item.colour?.toLowerCase() === variant.colour.toLowerCase() : item.id === variant.id);
    const secondView = product.images.find(image => different(image) && sameColour.some(item => (item.id && image.variantId === item.id) || (item.imageId && image.id === item.imageId)));
    if (secondView) return secondView;
    return product.variants.filter(item => !sameColour.includes(item)).map(item => product.images.find(image => (item.imageId && image.id === item.imageId) || (item.id && image.variantId === item.id))).find(image => image && different(image));
  }
  // Unassociated galleries retain their original first/second photo interaction.
  return product.images.find(different);
}
