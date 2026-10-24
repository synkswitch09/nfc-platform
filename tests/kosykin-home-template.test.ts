import { describe, expect, it } from "vitest";
import { kosykinHomeTemplate, upgradeKosykinHome } from "@/lib/kosykin-home-template";
import { validateLandingSections } from "@/lib/landing-sections";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import type { Prisma } from "@prisma/client";

describe("Kosykin Home design", () => {
  it("renders CMS-enabled categories with the shared highlight colour and hides disabled categories", () => {
    const section = validateLandingSections(kosykinHomeTemplate())[1];
    const base = { shortDescription: null, cardTitle: null, cardText: null, cardImageUrl: null, cardImageAlt: null, icon: null, status: 'PUBLISHED', showInShop: true, showOnHomepage: true };
    const html = renderToStaticMarkup(createElement(ModularPageRenderer, {
      name: 'Home', sections: [{ id: 'collections', type: section.type, name: section.name, visible: true, content: { ...section.content, items: [{ id: '11111111-1111-4111-8111-111111111111', categorySlug: 'personalised-pieces', title: 'Custom collection', iconBackgroundColour: '#123abc' }] } as Prisma.JsonValue }], products: [],
      categories: [{ ...base, id: 'legacy', slug: 'personalised-3d-prints', name: 'Personalised 3D prints' }, { ...base, id: 'hidden', slug: 'stands-holders', name: 'Hidden stands', showOnHomepage: false }, { ...base, id: 'new', slug: 'new-pieces', name: 'New pieces' }],
      store: { displayName: 'Kosykin', currency: 'AUD', nfcEnabled: false },
    }));
    expect(html).toContain('/shop?category=personalised-pieces');
    expect(html).toContain('background-color:#123abc');
    expect(html).toContain('Custom collection');
    expect(html).toContain('New pieces');
    expect(html).not.toContain('Hidden stands');
    expect(html).not.toContain('Planters &amp; Vases');
  });
  it("provides the editable home with launch promotion and clearly labelled example reviews", () => {
    const sections = validateLandingSections(kosykinHomeTemplate());
    expect(sections.map((section) => section.type)).toEqual(["HERO", "FEATURE_BADGES", "PRODUCT_SHOWCASE", "CTA_BANNER", "FEATURE_LIST", "MEDIA_CONTENT", "FEATURE_BADGES", "FAQ", "CTA_BANNER"]);
    expect(sections[0].content).toMatchObject({ layoutVariant: "KOSYKIN_WAVY", sideLabel: "Collection" });
    expect(sections[1].content.layoutVariant).toBe("KOSYKIN_CIRCLES");
    const items = sections[1].content.items as Array<{ imageUrl: string; ctaHref: string }>;
    expect(items).toHaveLength(5);
    expect(sections.find(section => section.content.layoutVariant === "KOSYKIN_REVIEWS")?.visible).toBe(true);
    expect(sections.find(section => section.content.layoutVariant === "KOSYKIN_PROMOTIONS")?.visible).toBe(true);
    const reviews = sections.find(section => section.content.layoutVariant === "KOSYKIN_REVIEWS");
    expect(reviews?.content.copy).toContain("not real customer testimonials");
    expect(reviews?.content.items).toHaveLength(3);
    expect(items.every((item) => item.imageUrl.startsWith("/images/kosykin/") && item.ctaHref.startsWith("/shop"))).toBe(true);
  });

  it("upgrades an existing CMS home without losing identities, edits or custom sections", () => {
    const hero = { ...kosykinHomeTemplate()[0], id: "11111111-1111-4111-8111-111111111111", content: { layoutVariant: "KOSYKIN_WAVY", copy: "Our edited introduction", artworkUrl: "/images/kosykin/our-hero.webp" } };
    const custom = { type: "RICH_TEXT" as const, name: "Our announcement", visible: false, content: { copy: "Keep this" } };
    const upgraded = upgradeKosykinHome([hero, custom]);
    expect(upgraded[0].id).toBe(hero.id);
    expect(upgraded[0].content).toMatchObject(hero.content);
    expect(upgraded.at(-1)).toEqual(custom);
    expect(upgradeKosykinHome(upgraded)).toEqual(upgraded);
    expect(validateLandingSections(upgraded)).toHaveLength(10);
  });

  it("renders the title as real text and routes matching collections to the shop filter", () => {
    const sections = validateLandingSections(kosykinHomeTemplate()).map((section, index) => ({
      id: String(index), type: section.type, name: section.name, visible: true,
      content: (index === 0 ? { ...section.content, imageUrl: "/images/test-hero.png" } : section.content) as Prisma.JsonValue,
    }));
    const html = renderToStaticMarkup(createElement(ModularPageRenderer, {
      name: "Home", sections, products: [],
      categories: [{ id: "stands", slug: "stands", name: "Stands & Holders", shortDescription: null, cardTitle: null, cardText: null, cardImageUrl: null, cardImageAlt: null, icon: null }],
      store: { displayName: "Kosykin", currency: "AUD", nfcEnabled: false },
    }));
    expect(html).toContain('aria-label="The wavy Collection"');
    expect(html).toContain('/shop?category=stands');
    expect(html).toContain('kosy-hero-object');
  });
});
