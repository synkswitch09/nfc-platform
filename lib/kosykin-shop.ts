export type ShopQuery = { category?: string | string[]; colour?: string | string[]; min?: string; max?: string; availability?: string; sort?: string; sale?: string };
export const queryList = (value: string | string[] | undefined) => [...new Set(Array.isArray(value) ? value : value ? [value] : [])].slice(0, 20);
export const shopCategoryStyles = [
  { slug: 'stands-holders', name: 'Stands & Holders', description: 'Give your tech a happy home', colour: '#eace70' },
  { slug: 'planters-vases', name: 'Planters & Vases', description: 'A little style for every stem', colour: '#e6b49d' },
  { slug: 'home-lighting', name: 'Home & Lighting', description: 'Bright ideas for cosy corners', colour: '#b9afcf' },
  { slug: 'personalised-pieces', name: 'Personalised Pieces', description: 'Made with your personal twist', colour: '#d4a6a9' },
  { slug: 'seasonal-specials', name: 'Seasonal Specials', description: 'A little Kosy for every occasion', colour: '#a9c2cc' },
];
export function shopCategoryStyle(category: { slug: string; name: string; shortDescription?: string | null }) {
  const style = shopCategoryStyles.find(item => item.slug === category.slug || item.name.toLowerCase() === category.name.toLowerCase());
  return { colour: style?.colour ?? '#243247', description: category.shortDescription || style?.description || 'Find your kind of Kosy' };
}
const price = (input: string | undefined) => typeof input === 'string' && input.trim() && Number.isFinite(Number(input)) ? Math.round(Math.max(0, Number(input)) * 100) : undefined;
export function shopPriceRange(query: ShopQuery) {
  const min = price(query.min) ?? 0;
  const max = price(query.max) ?? Infinity;
  return { min, max: Math.max(min, max) };
}
export function shopVariantMatches(variant: { priceCents: number; compareAtPriceCents?: number | null; colour?: string | null; optionSelection?: unknown }, query: ShopQuery) {
  const range = shopPriceRange(query);
  const colours = queryList(query.colour);
  const selection = variant.optionSelection && typeof variant.optionSelection === 'object' ? Object.values(variant.optionSelection) : [];
  return variant.priceCents >= range.min && variant.priceCents <= range.max
    && (query.sale !== '1' || (variant.compareAtPriceCents ?? 0) > variant.priceCents)
    && (!colours.length || colours.some(colour => variant.colour?.toLowerCase() === colour.toLowerCase() || selection.some(value => typeof value === 'string' && value.toLowerCase() === colour.toLowerCase())));
}

/** Personalised products can offer colours as configuration, without a variant per colour. */
export function shopProductVariants<T extends { priceCents: number; compareAtPriceCents?: number | null; colour?: string | null; optionSelection?: unknown }>(product: { variants: T[]; options: { code: string; values: { value: string; label: string }[] }[] }, query: ShopQuery, available: (variant: T) => boolean) {
  const colours = queryList(query.colour);
  const colourCodes = product.options.map(option => option.code);
  const mapped = product.variants.some(variant => variant.colour || (variant.optionSelection && typeof variant.optionSelection === 'object' && Object.keys(variant.optionSelection).some(code => colourCodes.includes(code))));
  const configurable = !mapped && colours.length > 0 && product.options.some(option => option.values.some(value => colours.some(colour => colour.toLowerCase() === value.value.toLowerCase() || colour.toLowerCase() === value.label.toLowerCase())));
  return product.variants.filter(variant => shopVariantMatches(variant, configurable ? { ...query, colour: undefined } : query) && (query.availability !== 'available' || available(variant)));
}
