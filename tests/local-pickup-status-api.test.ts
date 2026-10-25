import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ context: vi.fn(), order: vi.fn(), update: vi.fn(), notice: vi.fn(), notify: vi.fn(), release: vi.fn(), hold: vi.fn(), items: vi.fn(), history: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/admin', () => ({ getAdminApiContext: m.context, hasPermission: () => true }));
vi.mock('@/lib/http', () => ({ assertSameOrigin: () => true, jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock('@/lib/order-service', () => ({ CheckoutError: class extends Error {} }));
vi.mock('@/lib/checkout-reconciliation', () => ({ cancelStripeCheckout: vi.fn() }));
vi.mock('@/lib/order-notifications', () => ({ queueOrderNotice: m.notice, notifyPaidOrder: m.notify }));
vi.mock('@/lib/production-capacity', () => ({ releaseProduction: m.release }));
vi.mock('@/lib/support-access', () => ({ assertNoSupportHold: m.hold }));
vi.mock('@/lib/db', () => ({ db: { order: { findFirst: m.order }, $transaction: m.transaction } }));
import { POST } from '@/app/api/admin/orders/[orderId]/status/route';
const pickupSnapshot = { enabled: true, suburb: 'Adelaide', address: 'Private address', hours: 'By appointment', instructions: '' };
const order = { status: 'PROCESSING', deliveryMethod: 'PICKUP', pickupSnapshot, orderNumber: 'KOSY-123', payments: [{ status: 'SUCCEEDED' }], shipments: [] };
const request = (status: string) => new NextRequest('https://kosykin.com.au/api/admin/orders/o/status', { method: 'POST', body: JSON.stringify({ status, carrier: 'Carrier', trackingNumber: '123' }) });
const params = { params: Promise.resolve({ orderId: 'o' }) };
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue({ user: { id: 'admin' }, store: { id: 's' } });
  m.order.mockResolvedValue(order);
  m.update.mockResolvedValue({ count: 1 });
  m.items.mockResolvedValue([{ id: 'i', productName: 'Tray', quantity: 1, packedQuantity: 1, productType: 'ACCESSORY', shippingSnapshot: { production: { requiresManufacturing: false, requiresNfc: false } }, manufacturingJobs: [], tags: [] }]);
  m.history.mockResolvedValue({ id: 'history' });
  m.transaction.mockImplementation(fn => fn({ payment: { count: async () => 0 }, orderItem: { findMany: m.items }, orderGift: { count: async () => 0 }, order: { updateMany: m.update }, orderStatusHistory: { create: m.history }, auditLog: { create: vi.fn() } }));
});
describe('pickup operational lifecycle', () => {
  it('queues the private pickup address and releases manufacturing capacity when all items are ready', async () => {
    expect((await POST(request('READY_TO_SHIP'), params)).status).toBe(200);
    expect(m.release).toHaveBeenCalledWith(expect.anything(), 'o');
    expect(m.notice).toHaveBeenCalledWith(expect.anything(), 'o', 'pickup-ready:history', 'Your order is ready for pickup', expect.stringContaining(pickupSnapshot.address));
    expect(m.notify).toHaveBeenCalledWith('o');
  });
  it('does not announce readiness or release capacity for an unpacked order', async () => {
    m.items.mockResolvedValue([{ id: 'i', productName: 'Tray', quantity: 1, packedQuantity: 0, productType: 'ACCESSORY', shippingSnapshot: { production: { requiresManufacturing: false, requiresNfc: false } }, manufacturingJobs: [], tags: [] }]);
    expect((await POST(request('READY_TO_SHIP'), params)).status).toBe(409);
    expect(m.notice).not.toHaveBeenCalled();
    expect(m.release).not.toHaveBeenCalled();
  });
  it('records the handover without carrier or tracking requirements', async () => {
    m.order.mockResolvedValue({ ...order, status: 'READY_TO_SHIP' });
    const req = new NextRequest('https://kosykin.com.au/api/admin/orders/o/status', { method: 'POST', body: JSON.stringify({ status: 'COMPLETED' }) });
    expect((await POST(req, params)).status).toBe(200);
    expect(m.update.mock.calls[0][0].data).toMatchObject({ status: 'COMPLETED', collectedAt: expect.any(Date) });
    expect(m.notice.mock.calls[0][3]).toBe('Your order has been collected');
  });
  it('blocks pickup shipment transitions and duplicate readiness emails after a concurrent update', async () => {
    m.order.mockResolvedValue({ ...order, status: 'READY_TO_SHIP' });
    expect((await POST(request('SHIPPED'), params)).status).toBe(409);
    m.order.mockResolvedValue(order);
    m.update.mockResolvedValue({ count: 0 });
    expect((await POST(request('READY_TO_SHIP'), params)).status).toBe(409);
    expect(m.notice).not.toHaveBeenCalled();
  });
});
