import { describe, expect, it } from "vitest";
import { blankLandingSection, landingSectionTypes, modularFaq, parseLandingContent, validateLandingSections } from "@/lib/landing-sections";

describe("typed modular landing content", () => {
  it("accepts ordered structured sections without arbitrary HTML", () => {
    const sections = validateLandingSections([{ type: "HERO", name: "Pet hero", visible: true, content: { eyebrow: "More than a tag", headline: "Help them get home", copy: "NFC and QR make contact easier.", ctaLabel: "Shop pet tags", ctaHref: "/shop?category=pet", layout: "IMAGE_RIGHT" } }]);
    expect(sections[0]?.content.headline).toBe("Help them get home");
    expect(sections[0]?.content).not.toHaveProperty("html");
  });

  it("rejects external and protocol-relative CTA injection", () => {
    expect(() => validateLandingSections([{ type: "CTA_BANNER", name: "Unsafe", visible: true, content: { ctaHref: "https://evil.example" } }])).toThrow();
    expect(() => validateLandingSections([{ type: "CTA_BANNER", name: "Unsafe", visible: true, content: { ctaHref: "//evil.example" } }])).toThrow();
  });

  it("ignores invalid persisted content instead of rendering it", () => {
    expect(parseLandingContent("HERO", { ctaHref: "javascript:alert(1)" })).toBeNull();
  });

  it("extracts only visible modular FAQ entries for structured data", () => {
    const visible = { type: "FAQ" as const, visible: true, content: { items: [{ question: "Does it need an app?", answer: "No, a compatible browser opens the page." }] } };
    const hidden = { type: "FAQ" as const, visible: false, content: { items: [{ question: "Hidden question", answer: "This must not be indexed." }] } };
    expect(modularFaq([visible, hidden])).toEqual([{ question: "Does it need an app?", answer: "No, a compatible browser opens the page." }]);
  });

  it("provides safe typed defaults for newly added sections", () => {
    expect(blankLandingSection("PRODUCT_GRID")).toMatchObject({ type: "PRODUCT_GRID", visible: true, content: { limit: 6, featuredOnly: false } });
    expect(landingSectionTypes.map(type => blankLandingSection(type).type)).toEqual(landingSectionTypes);
  });
});
