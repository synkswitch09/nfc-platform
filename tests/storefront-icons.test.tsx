import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorefrontIcon, StorefrontIconsProvider } from '@/components/storefront-icon';
import { parseHeaderConfig } from '@/lib/site-chrome';
import { kosykinIconDefaults, storefrontIconSource } from '@/lib/storefront-icons';
import { validateLandingSections } from '@/lib/landing-sections';
import { kosykinHomeTemplate } from '@/lib/kosykin-home-template';
import { KosykinHomeSection } from '@/components/kosykin-home-section';
import { KosykinTrustRow } from '@/components/kosykin-trust-row';
import { CategoryIcon } from '@/components/category-icon';
import { ContentIconSelect } from '@/components/content-icon-select';
import { contentIconKeys, lucideIconKey } from '@/lib/content-icons';
import { productDetailSchema } from '@/lib/product-detail';
import { contentLucideIcons } from '@/components/content-lucide-icon';
import { existsSync } from 'node:fs';

describe('Storefront icon configuration', () => {
  it('keeps uploaded icons when saving CMS config and rejects unsafe sources and unknown controls', () => {
    const iconUrls = { cart: '/api/media/staging-kosykin-11111111-1111-4111-8111-111111111111.png', menu: 'https://cdn.example.com/menu.png' };
    expect(parseHeaderConfig({ iconUrls }).iconUrls).toEqual(iconUrls);
    expect(parseHeaderConfig({}).iconUrls).toEqual({});
    expect(() => parseHeaderConfig({ iconUrls: { cart: 'javascript:alert(1)' } })).toThrow();
    expect(() => parseHeaderConfig({ iconUrls: { unknownControl: '/images/icon.png' } })).toThrow();
  });
  it('uses section uploads before global overrides and scopes original brand assets to Kosykin', () => {
    expect(storefrontIconSource('cart', {}, true)).toBe(kosykinIconDefaults.cart);
    expect(storefrontIconSource('cart', {}, false)).toBe('');
    expect(storefrontIconSource('cart', { cart: '/images/custom.png' }, true)).toBe('/images/custom.png');
    expect(storefrontIconSource('cart', { cart: '/images/custom.png' }, true, '/images/section.png')).toBe('/images/section.png');
    expect(Object.values(kosykinIconDefaults).every(src => lucideIconKey(src) || existsSync(`public${src}`))).toBe(true);
  });
  it('renders decorative images without replacing button labels or the fallback for other stores', () => {
    const render = (kosykin: boolean) => renderToStaticMarkup(<StorefrontIconsProvider kosykin={kosykin} overrides={{}}><button aria-label="Cart"><StorefrontIcon name="cart" fallback={<svg data-fallback="true" />} /></button></StorefrontIconsProvider>);
    expect(render(true)).toContain('lucide-shopping-bag');
    expect(render(true)).not.toContain('<img');
    expect(render(true)).toContain('aria-label="Cart"');
    expect(render(true)).toContain('aria-hidden="true"');
    expect(render(false)).toContain('data-fallback="true"');
    expect(render(false)).not.toContain('/images/kosykin');
  });
  it('retains individual feature and item icon uploads through section validation', () => {
    const template = kosykinHomeTemplate();
    const hero = template[0];
    hero.content.features = [{ id: '11111111-1111-4111-8111-111111111111', icon: 'package', label: 'Delivery', iconUrl: '/images/delivery.png' }];
    const why = template.find(section => section.type === 'FEATURE_LIST')!;
    why.content.items = [{ id: '22222222-2222-4222-8222-222222222222', title: 'Details', icon: 'sparkles', iconUrl: '/images/details.png' }];
    const validated = validateLandingSections(template);
    expect(validated[0].content.features).toMatchObject([{ iconUrl: '/images/delivery.png' }]);
    expect(validated.find(section => section.type === 'FEATURE_LIST')?.content.items).toMatchObject([{ iconUrl: '/images/details.png' }]);
    const html = renderToStaticMarkup(<StorefrontIconsProvider kosykin overrides={{}}><KosykinHomeSection type="FEATURE_LIST" value={validated.find(section => section.type === 'FEATURE_LIST')!.content} products={[]} currency="AUD" /></StorefrontIconsProvider>);
    expect(html).toContain('/images/details.png');
    expect(html).not.toContain('/images/kosykin/icons/why-appearance.png');
  });
  it('saves and renders Lucide selections without replacing existing configured icons', () => {
    const config = productDetailSchema.parse({ highlights: [{ title: 'Made when ordered', icon: 'scan-box' }] });
    expect(config.highlights[0].icon).toBe('scan-box');
    const render = (imageUrl?: string) => renderToStaticMarkup(<CategoryIcon name={config.highlights[0].icon} imageUrl={imageUrl} />);
    expect(render()).toContain('lucide-scan-box');
    expect(render('/images/my-icon.png')).toContain('/images/my-icon.png');
    expect(render('/images/my-icon.png')).not.toContain('/images/kosykin');
    expect(productDetailSchema.parse({ highlights: [{ icon: 'palette' }] }).highlights[0].icon).toBe('palette');
    expect([...contentIconKeys].sort()).toEqual(Object.keys(contentLucideIcons).sort());
    expect(new Set(contentIconKeys).size).toBe(contentIconKeys.length);
  });
  it('offers Lucide icons with previews and preserves legacy category selections', () => {
    const html = renderToStaticMarkup(<ContentIconSelect name="icon" defaultValue="legacy-icon" />);
    expect(html).toContain('Lucide icons');
    expect(html).toContain('value="feather"');
    expect(html).toContain('value="legacy-icon" selected');
    const preview = renderToStaticMarkup(<ContentIconSelect name="icon" value="feather" />);
    expect(preview).toContain('lucide-feather');
  });

  it('does not let a made-to-order override swallow a different selected trust icon', () => {
    const html = renderToStaticMarkup(<StorefrontIconsProvider kosykin overrides={{ madeToOrder: '/images/unrelated.png' }}><KosykinTrustRow content={{ features: [{ label: 'Materials', icon: 'feather' }] }} /></StorefrontIconsProvider>);
    expect(html).toContain('lucide-feather');
    expect(html).not.toContain('/images/unrelated.png');
  });

  it('persists known Lucide overrides and rejects invalid icon identifiers', () => {
    expect(parseHeaderConfig({ iconUrls: { cart: 'lucide:shopping-bag' } }).iconUrls.cart).toBe('lucide:shopping-bag');
    expect(() => parseHeaderConfig({ iconUrls: { cart: 'lucide:not-an-icon' } })).toThrow();
    expect(() => parseHeaderConfig({ logoUrl: 'lucide:shopping-bag' })).toThrow();
    const html = renderToStaticMarkup(<StorefrontIcon imageUrl="lucide:feather" fallback={<span>Fallback</span>} />);
    expect(html).toContain('lucide-feather');
    expect(html).not.toContain('<img');
  });

});
