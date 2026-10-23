import { describe, it, expect } from 'vitest';
import { shopPriceRange, shopVariantMatches, shopProductVariants, queryList } from '@/lib/kosykin-shop';
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
