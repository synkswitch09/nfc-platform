import { describe, expect, it } from 'vitest';
import { productCardPriceLabel, productCardPriceRange } from '@/lib/product-card-price';
const option = (overrides = {}) => ({ code: 'size', type: 'SELECT', required: true, priceDeltaCents: 0, values: [{ priceDeltaCents: 0 }, { priceDeltaCents: 300 }], ...overrides });
describe('storefront card prices', () => {
  it('shows a fixed AUD price for any number of equal-priced colour variants', () => {
    expect(productCardPriceLabel({ variants: [3595, 3595, 3595, 3595].map(priceCents => ({ priceCents })) }, 'AUD')).toBe('AUD $35.95');
  });
  it('uses the cheapest price regardless of variant order and prefixes only differing prices', () => {
    expect(productCardPriceLabel({ variants: [{ priceCents: 5500 }, { priceCents: 3500 }] }, 'AUD')).toBe('From AUD $35.00');
  });
  it('includes configurable size and hardware surcharges with one made-to-order variant', () => {
    expect(productCardPriceRange({ variants: [{ priceCents: 1195 }], options: [option(), option({ code: 'hardware', values: [{ priceDeltaCents: 200 }, { priceDeltaCents: 500 }] })] })).toEqual({ min: 1395, max: 1995, varies: true });
  });
  it('does not charge mapped variant options twice or label equal option prices as variable', () => {
    expect(productCardPriceLabel({ variants: [{ priceCents: 1500, optionSelection: { size: 'large' } }], options: [option()] }, 'AUD')).toBe('AUD $15.00');
    expect(productCardPriceLabel({ variants: [{ priceCents: 1500 }], options: [option({ values: [{ priceDeltaCents: 200 }, { priceDeltaCents: 200 }] })] }, 'AUD')).toBe('AUD $17.00');
  });
  it('accounts for optional add-ons and ignores inactive prices', () => {
    expect(productCardPriceRange({ variants: [{ priceCents: 1200 }], options: [option({ required: false, values: [{ priceDeltaCents: 400 }, { priceDeltaCents: 900, active: false }] }), option({ active: false })] })).toEqual({ min: 1200, max: 1600, varies: true });
  });
  it('returns no price for products without active variants', () => {
    expect(productCardPriceLabel({ variants: [] }, 'AUD')).toBe('');
  });
});
