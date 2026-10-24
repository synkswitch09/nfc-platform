import { describe, it, expect } from 'vitest';
import { kosykinCollectionSlug, kosykinShopCollections, shopPriceRange, shopVariantMatches, shopProductVariants, queryList } from '@/lib/kosykin-shop';
describe('Kosykin design collections', () => {
 it('shows only the five design collections despite legacy CMS groups', () => {
  const collections = kosykinShopCollections([{ categorySlug: 'tags', title: 'Tags' }, { categorySlug: 'personalised-3d-prints', title: 'Personalised 3D prints' }]);
  expect(collections.map(item => item.slug)).toEqual(['stands-holders', 'planters-vases', 'home-lighting', 'personalised-pieces', 'seasonal-specials']);
 });
 it('includes legacy personalised and tag products in Personalised Pieces', () => {
  const categories = ['personalised-pieces', 'personalised-3d-prints', 'tags', 'stands-holders'];
  expect(categories.filter(slug => kosykinCollectionSlug(slug) === 'personalised-pieces')).toEqual(categories.slice(0, 3));
  expect(kosykinCollectionSlug('personalized-3d-prints')).toBe('personalised-pieces');
 });
 it('preserves authored collection copy and visibility', () => {
  const collections = kosykinShopCollections([{ categorySlug: 'stands-holders', visible: false }, { categorySlug: 'personalised-pieces', title: 'Personalised Pieces', description: 'Your own touch' }]);
  expect(collections).toHaveLength(4);
  expect(collections.find(item => item.slug === 'personalised-pieces')?.shortDescription).toBe('Your own touch');
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
