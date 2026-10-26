import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { KosykinHomeSection } from '@/components/kosykin-home-section';
import { KosykinProductCard, type StorefrontCardProduct } from '@/components/kosykin-product-card';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} /> }));
const product: StorefrontCardProduct & { featured: boolean } = {
  id: 'tray', slug: 'mini-tray', name: 'Mini Tray', description: 'Small things.', shortDescription: null, featured: true,
  variants: [{ priceCents: 1295 }], images: [{ url: '/first.png', altText: 'Tray' }, { url: '/second.png', altText: 'Tray side' }],
  options: [{ code: 'colour', type: 'COLOUR', required: true, priceDeltaCents: 0, values: ['Pink', 'Blue', 'Peach', 'Lavender'].map(label => ({ id: label, label, value: label, swatchHex: '#ffffff', priceDeltaCents: 0 })) }],
};
describe('shared Home and Shop product cards', () => {
  it('uses the shared card with product navigation on Home and a View product action on Home', () => {
    const shop = renderToStaticMarkup(<KosykinProductCard product={product} currency="AUD" />);
    const home = renderToStaticMarkup(<KosykinHomeSection type="PRODUCT_SHOWCASE" value={{}} products={[product]} currency="AUD" />);
    expect(home).toContain('kosy-product-card-home');
    expect(home).not.toContain('Add to cart');
    expect(home).toContain('View product');
    expect(home).toContain('href="/products/mini-tray"');
    expect(shop).toContain('Add to cart');
    expect(shop).toContain('AUD $12.95');
    expect(shop).not.toContain('From ');
    expect(shop).toContain('aria-label="1 more colour">+1');
    expect(shop).toContain('class="kosy-product-hover-image"');
    expect(shop).toContain('src="/second.png"');
  });
  it('keeps a single image and no extra-colour label when no second photo or fourth colour exists', () => {
    const html = renderToStaticMarkup(<KosykinProductCard product={{ ...product, images: product.images.slice(0, 1), options: [] }} currency="AUD" />);
    expect(html).not.toContain('kosy-product-hover-image');
    expect(html).not.toContain('more colour');
  });
});
