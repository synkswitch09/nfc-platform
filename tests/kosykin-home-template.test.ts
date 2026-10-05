import { describe, expect, it } from "vitest";
import { kosykinHomeTemplate } from "@/lib/kosykin-home-template";
import { validateLandingSections } from "@/lib/landing-sections";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import type { Prisma } from "@prisma/client";

describe("Kosykin Home design", () => {
  it("publishes both editable sections with empty media fields and local shopping links", () => {
    const sections = validateLandingSections(kosykinHomeTemplate());
    expect(sections.map((section) => section.type)).toEqual(["HERO", "FEATURE_BADGES"]);
    expect(sections[0].content).toMatchObject({ layoutVariant: "KOSYKIN_WAVY", sideLabel: "Collection" });
    expect(sections[1].content.layoutVariant).toBe("KOSYKIN_CIRCLES");
    const items = sections[1].content.items as Array<{ imageUrl: string; ctaHref: string }>;
    expect(items).toHaveLength(5);
    expect(items.every((item) => item.imageUrl === "" && item.ctaHref.startsWith("/shop"))).toBe(true);
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
