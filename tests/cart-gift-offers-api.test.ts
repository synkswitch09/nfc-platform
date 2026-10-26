import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ origin: vi.fn(), limit: vi.fn(), store: vi.fn(), offers: vi.fn() }));
vi.mock('@/lib/http', () => ({ assertSameOrigin: m.origin, getClientIp: () => 'ip', jsonError: (error: string, status = 400) => Response.json({ error }, { status }) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.limit }));
vi.mock('@/lib/storefront', () => ({ getCurrentStorefront: m.store, isStoreCommerceAvailable: (store: { status: string }) => store.status === 'ACTIVE' }));
vi.mock('@/lib/cart-gift-offers', () => ({ cartGiftOffers: m.offers }));
import { POST } from '@/app/api/cart/gifts/route';
const id = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown) => new NextRequest('https://kosykin.com.au/api/cart/gifts', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); m.origin.mockReturnValue(true); m.limit.mockResolvedValue({ allowed: true }); m.store.mockResolvedValue({ id: 'kosykin', status: 'ACTIVE' }); m.offers.mockResolvedValue([]); });
it('uses the server-resolved store and returns uncached eligibility without requiring an account', async () => {
  const response = await POST(request({ variantIds: [id], storeId: 'another-store' }));
  expect(response.status).toBe(200);
  expect(m.offers).toHaveBeenCalledWith('kosykin', [id]);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('rejects invalid, oversized, cross-origin and rate-limited lookups', async () => {
  expect((await POST(request({ variantIds: ['bad'] }))).status).toBe(400);
  expect((await POST(request({ variantIds: Array(101).fill(id) }))).status).toBe(400);
  m.origin.mockReturnValue(false);
  expect((await POST(request({ variantIds: [id] }))).status).toBe(403);
  m.origin.mockReturnValue(true); m.limit.mockResolvedValue({ allowed: false });
  expect((await POST(request({ variantIds: [id] }))).status).toBe(429);
  expect(m.offers).not.toHaveBeenCalled();
});
