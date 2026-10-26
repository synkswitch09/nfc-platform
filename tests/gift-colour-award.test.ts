import { beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
const m = vi.hoisted(() => ({ campaigns: vi.fn(), existing: vi.fn(), eligible: vi.fn(), product: vi.fn(), increment: vi.fn(), create: vi.fn(), notice: vi.fn(), reserve: vi.fn(), consume: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/order-notifications', () => ({ queueOrderNotice: m.notice }));
vi.mock('@/lib/production-capacity', () => ({ reserveGiftProduction: m.reserve }));
vi.mock('@/lib/inventory-service', () => ({ consumeStock: m.consume }));
vi.mock('@/lib/etsy', () => ({ queueEtsyInventorySync: m.sync }));
import { awardOrderGifts } from '@/lib/gift-campaigns';
const campaign = { id: 'c', giftProductId: 'tray', giftName: 'Wavy Mini Tray', categoryId: 'stands', limit: 50, awardedCount: 1, cycle: 1 };
const variant = { id: 'blue', sku: 'TRAY-BLUE', name: 'Blue', colour: 'Blue', material: 'PLA', trackInventory: false, inventory: 0, reservedInventory: 0, backorderPolicy: 'DENY', productionMinutes: 20, optionSelection: { colour: 'bb' } };
const product = { name: 'Wavy Mini Tray', variants: [variant], options: [{ code: 'colour', values: [{ value: 'bb', label: 'Baby Blue', swatchHex: '#a4dbe8' }] }] };
const tx = { giftCampaign: { findMany: m.campaigns, updateMany: m.increment }, orderGift: { findUnique: m.existing, create: m.create }, orderItem: { count: m.eligible }, product: { findFirst: m.product } } as unknown as Prisma.TransactionClient;
beforeEach(() => { vi.resetAllMocks(); m.campaigns.mockResolvedValue([campaign]); m.eligible.mockResolvedValue(1); m.product.mockResolvedValue(product); m.increment.mockResolvedValue({ count: 1 }); });
it('snapshots one real SKU and colour and reserves only its actual gift print time', async () => {
  await awardOrderGifts(tx, 'order', 'store');
  expect(m.product.mock.calls[0][0].where).toEqual({ id: 'tray', storeId: 'store', status: 'ACTIVE' });
  expect(m.create.mock.calls[0][0].data).toMatchObject({ orderId: 'order', variantId: 'blue', colour: 'Baby Blue', colourHex: '#a4dbe8', sku: 'TRAY-BLUE', requiresPrinting: true, productionMinutes: 20 });
  expect(m.reserve).toHaveBeenCalledWith(tx, 'order', 20);
  expect(m.consume).not.toHaveBeenCalled();
  expect(m.notice.mock.calls[0][4]).toContain('Baby Blue');
});
it('never reassigns a colour or capacity when the payment notification is repeated', async () => {
  m.existing.mockResolvedValue({ id: 'already-awarded', colour: 'Pink' });
  await awardOrderGifts(tx, 'order', 'store');
  expect(m.product).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.reserve).not.toHaveBeenCalled();
});
it('consumes tracked gift stock instead of creating unnecessary printing work', async () => {
  m.product.mockResolvedValue({ ...product, variants: [{ ...variant, trackInventory: true, inventory: 2 }] });
  await awardOrderGifts(tx, 'order', 'store');
  expect(m.create.mock.calls[0][0].data).toMatchObject({ requiresPrinting: false, productionMinutes: 0 });
  expect(m.consume).toHaveBeenCalledWith(tx, expect.objectContaining({ variantId: 'blue', quantity: 1, held: 0, backorder: false }));
  expect(m.reserve).not.toHaveBeenCalled();
});
it('does not consume a campaign place when the linked gift has no available colour', async () => {
  m.product.mockResolvedValue({ ...product, variants: [] });
  await awardOrderGifts(tx, 'order', 'store');
  expect(m.increment).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
});
