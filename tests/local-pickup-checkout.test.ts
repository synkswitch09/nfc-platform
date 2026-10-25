import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Storefront } from '@/lib/storefront';
const m = vi.hoisted(() => ({ variants: vi.fn(), store: vi.fn(), create: vi.fn(), quotes: vi.fn(), consume: vi.fn(), promotions: vi.fn(), reserve: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: m.transaction } }));
vi.mock('@/lib/etsy', () => ({ queueEtsyInventorySync: vi.fn() }));
vi.mock('@/lib/order-notifications', () => ({ notifyPaidOrder: vi.fn(), queueOrderNotice: vi.fn(), queuePaidOrder: vi.fn() }));
vi.mock('@/lib/production-capacity', () => ({ reserveProduction: m.reserve, releaseProduction: vi.fn(), ProductionCapacityError: class extends Error {} }));
import { createPendingOrder } from '@/lib/order-service';
const pickup = { enabled: true, suburb: 'Adelaide, SA', address: 'Private pickup address', hours: 'By appointment', instructions: 'Bring order number' };
const store = { id: 's', slug: 'kosykin', status: 'ACTIVE', capabilities: ['COMMERCE', 'PRINT_3D'], environment: 'PRODUCTION', currency: 'AUD', country: 'AU', hostname: 'kosykin.com.au', displayName: 'Kosykin', accountConfig: {} } as unknown as Storefront;
const items = [{ variantId: 'v', quantity: 2 }];
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ productVariant: { findMany: m.variants }, store: { findUnique: m.store }, shippingQuote: { findFirst: m.quotes, updateMany: m.consume }, promotion: { findMany: m.promotions }, order: { create: m.create } }));
  m.variants.mockResolvedValue([{ id: 'v', productId: 'p', priceCents: 1200, productionMinutes: 20, trackInventory: false, backorderPolicy: 'ALLOW', inventory: 0, reservedInventory: 0, optionSelection: {}, product: { name: 'Tray', slug: 'tray', type: 'ACCESSORY', personalisationMode: 'NONE', options: [] } }]);
  m.store.mockResolvedValue({ shippingConfig: { pickup } });
  m.promotions.mockResolvedValue([]);
  m.create.mockImplementation(({ data }) => ({ ...data, id: 'order', payments: [{ id: 'pay' }] }));
});
describe('local pickup order preparation', () => {
  it('prices pickup at zero on the server, snapshots private instructions and reserves normal manufacturing capacity without a delivery quote', async () => {
    const result = await createPendingOrder(items, { deliveryMethod: 'PICKUP', name: 'Alex', email: 'alex@example.com' }, store);
    expect(result.order).toMatchObject({ deliveryMethod: 'PICKUP', shippingCents: 0, subtotalCents: 2400, totalCents: 2400, shippingProviderKey: 'pickup', pickupSnapshot: pickup });
    expect(result.order.shippingLine1).toBeUndefined();
    expect(m.quotes).not.toHaveBeenCalled();
    expect(m.consume).not.toHaveBeenCalled();
    expect(m.reserve).toHaveBeenCalledWith(expect.anything(), 'PRODUCTION', 'order', 40);
  });
  it('checks the current store configuration instead of trusting a client pickup flag', async () => {
    m.store.mockResolvedValue({ shippingConfig: { pickup: { ...pickup, enabled: false } } });
    await expect(createPendingOrder(items, { deliveryMethod: 'PICKUP', name: 'Alex', email: 'alex@example.com' }, store)).rejects.toThrow('not currently available');
    expect(m.create).not.toHaveBeenCalled();
  });
  it('keeps addresses and delivery quotes mandatory for delivery', async () => {
    await expect(createPendingOrder(items, { name: 'Alex', email: 'alex@example.com' }, store)).rejects.toThrow('delivery address and delivery quote');
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it('rejects expired delivery quotes without creating an order', async () => {
    m.quotes.mockResolvedValue(null);
    await expect(createPendingOrder(items, { name: 'Alex', email: 'alex@example.com', shipping: { line1: '1 Test St', locality: 'Adelaide', administrativeArea: 'SA', postcode: '5000', country: 'AU' } }, store, 'quote-token')).rejects.toThrow('expired');
    expect(m.create).not.toHaveBeenCalled();
  });
});
