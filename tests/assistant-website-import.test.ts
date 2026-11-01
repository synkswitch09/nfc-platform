import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ domain: vi.fn(), pages: vi.fn(), categories: vi.fn(), products: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { storeDomain: { findUnique: mocks.domain }, contentPage: { findMany: mocks.pages }, productCategory: { findMany: mocks.categories }, product: { findMany: mocks.products } } }));
import { crawlPublicWebsite, importAssistantWebsite, robotsRules } from '@/lib/assistants/website-import';
import { publicIPv4, websiteUrl, type WebsiteResponse } from '@/lib/assistants/website-http';
import { plainHtml, publicPageLink, publishedCopy, websiteDocument } from '@/lib/assistants/website-content';

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('DATABASE_URL', 'postgresql://unused'); vi.stubEnv('APP_ENV', 'production'); });
describe('public website boundaries', () => {
 it.each(['http://example.com', 'https://user:password@example.com', 'https://example.com:3000', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://server.local', 'https://example.com?token=private', 'file:///etc/passwd'])('rejects %s', value => expect(() => websiteUrl(value)).toThrow());
 it('accepts a bare public website address', () => expect(websiteUrl('kosykin.com.au').href).toBe('https://kosykin.com.au/'));
 it.each(['10.0.0.1', '127.0.0.1', '169.254.169.254', '168.63.129.16', '172.16.0.1', '192.168.0.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1'])('blocks non-public network address %s', address => expect(publicIPv4(address)).toBe(false));
 it('accepts a public IPv4 address for pinned socket lookup', () => expect(publicIPv4('93.184.216.34')).toBe(true));
 it('rejects off-site and authenticated links', () => { const root = websiteUrl('https://example.com'); expect(publicPageLink('https://other.example/faq', root)).toBeNull(); expect(publicPageLink('/account/orders', root)).toBeNull(); expect(publicPageLink('/products/widget?token=secret', root)).toBeNull(); expect(publicPageLink('/products/widget', root)).toBe('https://example.com/products/widget'); });
});
describe('published customer-facing content', () => {
 it('extracts main content, entities and FAQ structured data while omitting scripts and navigation', () => {
  const page = websiteDocument('<html><title>FAQs</title><body><nav>Private menu</nav><main><h1>Useful &amp; colourful</h1><p>Pickup in Parafield Gardens.</p><a href="/products/tray">Mini Tray</a></main><script>secret()</script><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Can I collect?","acceptedAnswer":{"text":"Yes, choose pickup."}}]}</script><footer>Repeated footer</footer></body></html>', websiteUrl('example.com'));
  expect(page.text).toContain('Useful & colourful'); expect(page.text).toContain('Yes, choose pickup.'); expect(page.text).not.toMatch(/Private menu|secret|Repeated footer/); expect(page.links).toEqual(['https://example.com/products/tray']);
 });
 it('does not import hidden CMS items or configuration values', () => {
  const copy = publishedCopy({ headline: 'Public information', items: [{ visible: false, question: 'Hidden question', answer: 'Hidden answer' }, { question: 'Delivery?', answer: 'Australia.' }], apiKey: 'secret', internalNotes: 'private', imageUrl: 'storage-secret' }).join('\n');
  expect(copy).toContain('Delivery?'); expect(copy).not.toMatch(/Hidden|secret|private/);
 });
 it('removes executable HTML from source text', () => expect(plainHtml('<p>Hello</p><script>bad()</script><iframe>hidden</iframe>')).toBe('Hello'));
 it('honours crawler rules, including allow overrides and specific user agents', () => {
  const allowed = robotsRules('User-agent: *\nDisallow: /\nUser-agent: BusinessAssistantImporter\nDisallow: /private\nAllow: /private/public');
  expect(allowed('/faq')).toBe(true); expect(allowed('/private/page')).toBe(false); expect(allowed('/private/public')).toBe(true);
 });
});
function response(body: string, status = 200, type = 'text/html'): WebsiteResponse { return { body, status, type }; }
describe('external import', () => {
 it('reads FAQs and linked product pages and reports source URLs', async () => {
  const reader = vi.fn(async (url: URL) => {
   if (url.pathname === '/robots.txt') return response('User-agent: *\nDisallow: /account', 200, 'text/plain');
   if (url.pathname === '/') return response('<main><h1>Example business</h1><p>Products for your home.</p><a href="/products/tray">Tray</a></main>');
   if (url.pathname === '/faq') return response('<main><h1>Frequently asked questions</h1><p>You can collect your order in Parafield Gardens.</p></main>');
   if (url.pathname === '/products/tray') return response('<main><h1>Mini Tray</h1><p>AUD $15. Store rings and other small items.</p></main>');
   return response('Not found', 404);
  });
  const result = await crawlPublicWebsite(websiteUrl('example.com'), reader);
  expect(result.knowledge).toContain('Parafield Gardens'); expect(result.knowledge).toContain('AUD $15'); expect(result.sources.map(s => s.url)).toContain('https://example.com/products/tray'); expect(result.mode).toBe('public-website');
 });
 it('does not follow off-site redirects', async () => { const reader = vi.fn().mockResolvedValue({ ...response('', 302), location: 'https://other.example/faq' }); await expect(crawlPublicWebsite(websiteUrl('example.com'), reader)).rejects.toThrow('different address'); expect(reader).toHaveBeenCalledTimes(1); });
 it('reports a website that blocks automated reading', async () => { const reader = vi.fn(async (url: URL) => url.pathname === '/robots.txt' ? response('User-agent: *\nDisallow: /', 200, 'text/plain') : response('<main>Business information that is public but disallows crawling.</main>')); await expect(crawlPublicWebsite(websiteUrl('example.com'), reader)).rejects.toThrow('blocks automated'); });
 it('does not import non-indexable pages', async () => { const reader = vi.fn(async (url: URL) => url.pathname === '/robots.txt' ? response('', 404) : response('<meta name="robots" content="noindex"><main>Hidden from search and automatic import.</main>')); await expect(crawlPublicWebsite(websiteUrl('example.com'), reader)).rejects.toThrow('No readable'); });
 it('caps the saved knowledge and explains omitted information', async () => { const reader = vi.fn(async (url: URL) => url.pathname === '/robots.txt' ? response('', 404) : response(`<main>${'Long business information. '.repeat(2000)}</main>`)); const result = await crawlPublicWebsite(websiteUrl('example.com'), reader); expect(result.knowledge.length).toBeLessThanOrEqual(30000); expect(result.warnings.join(' ')).toMatch(/Only part/); });
});
describe('shared platform import', () => {
 it('imports only published store information and uses actual variant pricing', async () => {
  mocks.domain.mockResolvedValue({ store: { id: 'kosykin', status: 'ACTIVE', displayName: 'Kosykin', currency: 'AUD', homepage: { heroHeadline: 'Make room for Kosy' } } });
  mocks.pages.mockResolvedValue([{ slug: 'terms', name: 'Terms', sections: [{ content: { headline: 'Made to order', copy: 'Production starts after payment.' } }] }]);
  mocks.categories.mockResolvedValue([{ name: 'Stands', slug: 'stands', faq: [{ question: 'Pickup?', answer: 'Parafield Gardens.', enabled: true }], landingSections: [] }]);
  mocks.products.mockResolvedValue([{ slug: 'tray', name: 'Mini Tray', description: 'Small things, sorted.', shortDescription: null, fullDescription: '85 × 85 × 35 mm', detailConfig: {}, personalisationMode: 'NONE', lengthMm: 85, widthMm: 85, heightMm: 35, variants: [{ name: 'Pink', priceCents: 1500, colour: 'Milky Pink', size: null, material: 'PLA', optionSelection: {} }], options: [] }]);
  const result = await importAssistantWebsite('kosykin.com.au');
  expect(result.mode).toBe('published-store'); expect(result.knowledge).toContain('Parafield Gardens'); expect(result.knowledge).toContain('AUD $15.00'); expect(result.knowledge).not.toContain('From AUD'); expect(result.knowledge).toContain('85 × 85 × 35 mm');
  expect(mocks.pages.mock.calls[0][0].where).toMatchObject({ storeId: 'kosykin', status: 'PUBLISHED' }); expect(mocks.products.mock.calls[0][0].where).toEqual({ storeId: 'kosykin', status: 'ACTIVE', shopVisible: true }); expect(mocks.products.mock.calls[0][0].select).not.toHaveProperty('inventory');
 });
});
