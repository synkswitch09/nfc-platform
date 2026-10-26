import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ variants: vi.fn(), campaigns: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { productVariant: { findMany: m.variants }, giftCampaign: { findMany: m.campaigns } } }));
import { cartGiftOffers } from '@/lib/cart-gift-offers';
import { GiftOfferNotice } from '@/components/cart-gift-offers';
const campaign = { id: 'c', categoryId: 'stands', giftName: 'Mini Tray', active: true, awardedCount: 49, limit: 50, category: { name: 'Stands & Holders' } };
beforeEach(() => { vi.resetAllMocks(); m.variants.mockResolvedValue([{ product: { categoryId: 'stands' } }]); m.campaigns.mockResolvedValue([campaign]); });
it('returns one configured gift for matching products regardless of duplicate variants', async () => {
  expect(await cartGiftOffers('store', ['v', 'v'])).toEqual([{ id: 'c', giftName: 'Mini Tray', categoryName: 'Stands & Holders' }]);
  expect(m.variants.mock.calls[0][0].where).toMatchObject({ id: { in: ['v'] }, active: true, product: { storeId: 'store', status: 'ACTIVE', shopVisible: true, category: { storeId: 'store', status: 'PUBLISHED' } } });
  expect(m.campaigns.mock.calls[0][0].where).toEqual({ storeId: 'store', active: true });
});
it('hides offers for an empty or unrelated cart, disabled campaigns and exhausted allowances', async () => {
  expect(await cartGiftOffers('store', [])).toEqual([]);
  expect(m.variants).not.toHaveBeenCalled();
  m.variants.mockResolvedValue([{ product: { categoryId: 'other' } }]);
  expect(await cartGiftOffers('store', ['v'])).toEqual([]);
  m.variants.mockResolvedValue([{ product: { categoryId: 'stands' } }]);
  for (const change of [{ active: false }, { awardedCount: 50 }]) {
    m.campaigns.mockResolvedValue([{ ...campaign, ...change }]);
    expect(await cartGiftOffers('store', ['v'])).toEqual([]);
  }
});
it('describes an offer before payment without promising an awarded or reserved gift', () => {
  const html = renderToStaticMarkup(<GiftOfferNotice gifts={[{ id: 'c', giftName: 'Mini Tray', categoryName: 'Stands & Holders' }]} />);
  expect(html).toContain('Eligible for 1');
  expect(html).toContain('Mini Tray');
  expect(html).toContain('confirmed after successful payment');
  expect(html).toContain('while campaign places remain available');
  expect(renderToStaticMarkup(<GiftOfferNotice gifts={[]} />)).toBe('');
});
