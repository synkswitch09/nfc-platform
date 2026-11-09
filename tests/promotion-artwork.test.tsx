import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KosykinPromotions } from '@/components/kosykin-promotions';
import { experienceSchema } from '@/lib/store-experience';
import { validateLandingSections } from '@/lib/landing-sections';
const id = '00000000-0000-4000-8000-000000000001';
const slide = { id, title: 'Launch gift', description: 'Free Mini Tray', imageUrl: '/images/kosykin/launch-gift.webp', ctaLabel: 'Get yours', ctaHref: '/shop?category=stands-holders', ctaBackground: '#ffffff', ctaTextColour: '#243247', ctaBorderColour: '#ffffff', ctaPositionX: 72.5, ctaPositionY: 70 };
const render = (patch = {}) => renderToStaticMarkup(createElement(KosykinPromotions, { slides: [{ ...slide, ...patch }] }));
describe('artwork promotion actions', () => {
  it('renders a real configured button alongside artwork without wrapping it in another link', () => {
    const html = render();
    expect(html).toContain('kosy-promotion-carousel has-artwork'); expect(html).toContain('kosy-promotion-cta'); expect(html).toContain('Get yours'); expect(html).toContain('href="/shop?category=stands-holders"');
    expect(html.match(/<a /g)).toHaveLength(1); expect(html).toContain('--promo-cta-x:72.5%'); expect(html).toContain('--promo-cta-y:70%'); expect(html).toContain('--promo-cta-background:#ffffff');
  });
  it('honours hidden buttons and preserves artwork-only links when no label is supplied', () => {
    expect(render({ ctaVisible: false })).not.toContain('<a ');
    const html = render({ ctaLabel: '' }); expect(html).toContain('kosy-promotion-artwork-link'); expect(html).not.toContain('class="kosy-promotion-cta"');
  });
  it('keeps ordinary text slides and carousel controls working', () => {
    const html = renderToStaticMarkup(createElement(KosykinPromotions, { slides: [{ ...slide, imageUrl: '' }, { ...slide, id: 'second' }] }));
    expect(html).toContain('<h2>Launch gift</h2>'); expect(html).toContain('Get yours'); expect(html).toContain('Next promotion'); expect(html).toContain('Show promotion 2');
  });
  it('retains action settings through both admin schemas and supplies defaults for existing banners', () => {
    const config = experienceSchema.parse({ groups: [{ id, name: 'Launch gift', slides: [slide] }] });
    expect(config.groups[0].slides[0]).toMatchObject(slide);
    const sections = validateLandingSections([{ type: 'CTA_BANNER', name: 'Gift', visible: true, content: { layoutVariant: 'KOSYKIN_PROMOTIONS', items: [slide] } }]);
    expect(sections[0].content.items).toMatchObject([{ ctaPositionX: 72.5, ctaPositionY: 70, ctaVisible: true }]);
    const old = experienceSchema.parse({ groups: [{ id, name: 'Gift', slides: [{ id, title: 'Gift', description: '' }] }] });
    expect(old.groups[0].slides[0].ctaPositionX).toBe(72.5);
    expect(experienceSchema.safeParse({ groups: [{ id, name: 'Gift', slides: [{ ...slide, ctaPositionX: 150 }] }] }).success).toBe(false);
  });
});
