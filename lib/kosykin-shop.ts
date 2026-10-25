export type ShopQuery = { category?: string | string[]; colour?: string | string[]; min?: string; max?: string; availability?: string; sort?: string; sale?: string };
export const queryList = (value: string | string[] | undefined) => [...new Set(Array.isArray(value) ? value : value ? [value] : [])].slice(0, 20);
export const shopCategoryStyles = [
  { slug: 'stands-holders', name: 'Stands & Holders', description: 'Give your tech a happy home', colour: '#eace70' },
  { slug: 'planters-vases', name: 'Planters & Vases', description: 'A little style for every stem', colour: '#e6b49d' },
  { slug: 'home-lighting', name: 'Home & Lighting', description: 'Bright ideas for cosy corners', colour: '#b9afcf' },
  { slug: 'personalised-pieces', name: 'Personalised Pieces', description: 'Made with your personal twist', colour: '#d4a6a9' },
  { slug: 'seasonal-specials', name: 'Seasonal Specials', description: 'A little Kosy for every occasion', colour: '#a9c2cc' },
];
/** Legacy catalogue groups belong to the single personalised collection. */
export function kosykinCollectionSlug(slug: string) {
  return ['personalised-3d-prints', 'personalized-3d-prints', 'tags'].includes(slug) ? 'personalised-pieces' : slug;
}
type CollectionItem = { title?: string; categorySlug?: string; description?: string; visible?: boolean; iconBackgroundColour?: string; imageUrl?: string; icon?: string; iconUrl?: string };
export type KosykinCollectionCategory = { id: string; slug: string; name: string; shortDescription?: string | null; status?: string; showOnHomepage?: boolean; showInShop?: boolean; cardTitle?: string | null; cardText?: string | null; cardImageUrl?: string | null; icon?: string | null };
export function kosykinShopCollections(categories: KosykinCollectionCategory[], items: CollectionItem[] = [], surface: 'home' | 'shop' = 'shop') {
  const slugs = [...new Set(categories.map(category => kosykinCollectionSlug(category.slug)))];
  return slugs.flatMap(slug => {
    const members = categories.filter(category => kosykinCollectionSlug(category.slug) === slug);
    const category = members.find(category => category.slug === slug) ?? members.find(category => (!category.status || category.status === 'PUBLISHED') && category.showInShop !== false && (surface !== 'home' || category.showOnHomepage !== false)) ?? members[0];
    const style = shopCategoryStyles.find(style => style.slug === slug);
    const item = items.find(item => item.categorySlug === slug) ?? items.find(item => item.categorySlug && kosykinCollectionSlug(item.categorySlug) === slug) ?? items.find(item => item.title?.toLowerCase() === category.name.toLowerCase());
    if ((category.status && category.status !== 'PUBLISHED') || category.showInShop === false || (surface === 'home' && category.showOnHomepage === false) || item?.visible === false) return [];
    const highlightColour = /^#[\da-f]{6}$/i.test(item?.iconBackgroundColour ?? '') ? item!.iconBackgroundColour! : style?.colour ?? '#243247';
    return [{ id: category.id, slug, name: item?.title || (category.slug === slug ? category.cardTitle || category.name : style?.name || category.name), shortDescription: item?.description || category.cardText || category.shortDescription || style?.description || null, highlightColour, imageUrl: item?.imageUrl || category.cardImageUrl || '', icon: item?.icon || category.icon || 'shapes', iconUrl: item?.iconUrl || '', categoryIds: members.filter(member => !member.status || member.status === 'PUBLISHED').map(member => member.id) }];
  });
}
export function shopCategoryStyle(category: { slug: string; name: string; shortDescription?: string | null; highlightColour?: string }) {
  const style = shopCategoryStyles.find(item => item.slug === category.slug || item.name.toLowerCase() === category.name.toLowerCase());
  return { colour: category.highlightColour || style?.colour || '#243247', description: category.shortDescription || style?.description || 'Find your kind of Kosy' };
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
export function shopProductVariants<T extends { priceCents: number; compareAtPriceCents?: number | null; colour?: string | null; optionSelection?: unknown }>(product: { variants: T[]; options: { code: string; type?: string; values: { value: string; label: string }[] }[] }, query: ShopQuery, available: (variant: T) => boolean) {
  const colours = queryList(query.colour);
  const colourOptions = product.options.filter(option => !option.type || option.type === "COLOUR");
  const colourCodes = colourOptions.map(option => option.code);
  const mapped = product.variants.some(variant => variant.colour || (variant.optionSelection && typeof variant.optionSelection === 'object' && Object.keys(variant.optionSelection).some(code => colourCodes.includes(code))));
  const configurable = !mapped && colours.length > 0 && colourOptions.some(option => option.values.some(value => colours.some(colour => colour.toLowerCase() === value.value.toLowerCase() || colour.toLowerCase() === value.label.toLowerCase())));
  return product.variants.filter(variant => shopVariantMatches(variant, configurable ? { ...query, colour: undefined } : query) && (query.availability !== 'available' || available(variant)));
}
