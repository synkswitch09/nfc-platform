import { describe, it, expect } from 'vitest';
import { kosykinCollectionSlug, kosykinShopCollections, shopPriceRange, shopVariantMatches, shopProductVariants, queryList } from '@/lib/kosykin-shop';
describe('Kosykin design collections', () => {
 const category = (slug: string, overrides = {}) => ({ id: slug, slug, name: slug, status: 'PUBLISHED', showInShop: true, showOnHomepage: true, ...overrides });
 it('uses enabled CMS categories without inventing missing design categories', () => {
  const categories = [category('personalised-3d-prints'), category('tags'), category('new-collection'), category('stands-holders', { showInShop: false }), category('planters-vases', { status: 'DRAFT' })];
  const collections = kosykinShopCollections(categories);
  expect(collections.map(item => item.slug)).toEqual(['personalised-pieces', 'new-collection']);
  expect(collections[0].categoryIds).toEqual(['personalised-3d-prints', 'tags']);
 });
 it('includes legacy personalised and tag products in Personalised Pieces', () => {
  const categories = ['personalised-pieces', 'personalised-3d-prints', 'tags', 'stands-holders'];
  expect(categories.filter(slug => kosykinCollectionSlug(slug) === 'personalised-pieces')).toEqual(categories.slice(0, 3));
  expect(kosykinCollectionSlug('personalized-3d-prints')).toBe('personalised-pieces');
 });
 it('preserves authored collection copy and visibility', () => {
  const collections = kosykinShopCollections([category('stands-holders'), category('personalised-pieces')], [{ categorySlug: 'stands-holders', visible: false }, { categorySlug: 'personalised-pieces', title: 'Personalised Pieces', description: 'Your own touch' }]);
  expect(collections).toHaveLength(1);
  expect(collections.find(item => item.slug === 'personalised-pieces')?.shortDescription).toBe('Your own touch');
 });
 it('shares editable colours and links with Home, including a legacy production category', () => {
  const categories = [category('personalised-3d-prints'), category('stands-holders', { showOnHomepage: false })];
  const items = [{ categorySlug: 'personalised-pieces', iconBackgroundColour: '#123abc', imageUrl: '/collection.png' }];
  const home = kosykinShopCollections(categories, items, 'home');
  const shop = kosykinShopCollections(categories, items);
  expect(home).toHaveLength(1);
  expect(shop).toHaveLength(2);
  expect(home[0]).toEqual(shop[0]);
  expect(home[0]).toMatchObject({ slug: 'personalised-pieces', highlightColour: '#123abc', imageUrl: '/collection.png' });
 });
 it('does not let legacy categories resurrect a disabled canonical collection', () => {
  const categories = [category('tags'), category('personalised-pieces', { showInShop: false })];
  expect(kosykinShopCollections(categories)).toEqual([]);
  expect(kosykinShopCollections(categories, [], 'home')).toEqual([]);
 });
 it('uses category content for enabled collections without a Home card', () => {
  const collections = kosykinShopCollections([category('new-collection', { cardTitle: 'New collection', cardImageUrl: '/new.png' })], [], 'home');
  expect(collections[0]).toMatchObject({ name: 'New collection', imageUrl: '/new.png' });
 });
});
describe('Shop variant filters', () => {
 it('combines price, colour and sale on the same variant', () => {
  const query = { min: '20', max: '40', colour: ['blue'], sale: '1' };
  expect(shopVariantMatches({priceCents: 3000, compareAtPriceCents: 4000, colour: 'Blue'},query)).toBe(true);
  expect(shopVariantMatches({priceCents: 5000, compareAtPriceCents: 6000, colour: 'Blue'},query)).toBe(false);
  expect(shopVariantMatches({priceCents: 3000, colour: 'Blue'},query)).toBe(false);
  expect(shopVariantMatches({priceCents: 3000, compareAtPriceCents: 4000, colour: 'Peach'},query)).toBe(false);
 });
 it('supports option selections without requiring a colour label', () => {
  expect(shopVariantMatches({ priceCents: 2400, optionSelection: { colour: 'baby-blue' } },{colour:'baby-blue'})).toBe(true);
 });
 it('treats blank and nonfinite prices as unbounded and normalises reversed bounds', () => {
  expect(shopPriceRange({min:' ',max:'NaN'})).toEqual({min:0,max:Infinity});
  expect(shopPriceRange({min:'30',max:'20'})).toEqual({min:3000,max:3000});
  expect(shopPriceRange({min:'-1',max:'24.99'})).toEqual({min:0,max:2499});
 });
 it('filters configurable colours without inventing separate variants', () => {
  const product = { variants: [{priceCents:2400}], options: [{code:'base-colour',values:[{value:'blue',label:'Blue'}]}] };
  expect(shopProductVariants(product,{colour:'blue'},()=>true)).toHaveLength(1);
  expect(shopProductVariants(product,{colour:'red'},()=>true)).toHaveLength(0);
  expect(shopProductVariants(product,{colour:'blue',availability:'available'},()=>false)).toHaveLength(0);
 });
 it('deduplicates repeated filters and bounds selection size', () => {
  expect(queryList(['blue','blue','peach'])).toEqual(['blue','peach']);
  expect(queryList(Array.from({length:30},(_,i)=>String(i)))).toHaveLength(20);
 });
});
