import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('AI_ASSISTANTS_ORIGIN', 'https://admin.tapkin.com.au');
});
afterEach(() => vi.unstubAllEnvs());

function ingressRequest(path = '/') {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      host: 'admin.tapkin.com.au',
      'x-forwarded-host': 'admin.tapkin.com.au',
      'x-forwarded-proto': 'https',
      'x-forwarded-port': '443',
    },
  });
}

describe('assistant routing behind Azure ingress', () => {
  it('keeps the rewrite on the internal origin instead of proxying to the public host on port 3000', async () => {
    const request = ingressRequest();
    const response = await proxy(request);
    const rewrite = new URL(response.headers.get('x-middleware-rewrite')!);
    expect(rewrite.origin).toBe(new URL(request.url).origin);
    expect(rewrite.pathname).toBe('/assistant-portal');
    expect(response.headers.get('x-middleware-request-host')).toBe('admin.tapkin.com.au');
  });
  it('preserves private page paths and query parameters', async () => {
    const response = await proxy(ingressRequest('/account?business=example'));
    const rewrite = new URL(response.headers.get('x-middleware-rewrite')!);
    expect(rewrite.origin).toBe('http://localhost:3000');
    expect(rewrite.pathname).toBe('/assistant-portal/account');
    expect(rewrite.searchParams.get('business')).toBe('example');
  });
  it('does not rewrite the internal namespace a second time', async () => {
    const response = await proxy(ingressRequest('/assistant-portal/account'));
    expect(response.headers.has('x-middleware-rewrite')).toBe(false);
  });
  it('keeps assistant APIs on the normal handler path', async () => {
    const response = await proxy(ingressRequest('/api/assistants/auth'));
    expect(response.headers.has('x-middleware-rewrite')).toBe(false);
  });
  it('does not route store pages into the assistant portal even with spoofed surface headers', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/shop', {
      headers: { host: 'kosykin.com.au', 'x-assistant-surface': 'portal' },
    }));
    expect(response.headers.has('x-middleware-rewrite')).toBe(false);
    expect(response.headers.get('x-middleware-request-x-assistant-surface')).toBe('store');
  });
  it('rejects store APIs on the assistant host', async () => {
    expect((await proxy(ingressRequest('/api/admin/stores'))).status).toBe(404);
  });
});

it('allows the explicit Meta signup SDK only on the assistant host',async()=>{
 const portal=await proxy(ingressRequest('/account'));
 expect(portal.headers.get('content-security-policy')).toContain('https://connect.facebook.net');
 expect(portal.headers.get('content-security-policy')).toContain("frame-src 'self' https://staticxx.facebook.com");
 const store=await proxy(new NextRequest('http://localhost:3000/shop',{headers:{host:'kosykin.com.au'}}));
 expect(store.headers.get('content-security-policy')).toBeNull();
});
