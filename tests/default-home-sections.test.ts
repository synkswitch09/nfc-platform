import { describe, expect, it } from "vitest";
import { defaultHomeSections } from "@/lib/default-home-sections";

describe("defaultHomeSections", () => {
  const homepage = {
    heroEyebrow: "More than a pet tag",
    heroHeadline: "Peace of mind, wherever they wander.",
    heroDescription: "A personalised smart tag with NFC.",
    primaryCtaLabel: "Shop pet tags",
    primaryCtaHref: "/shop",
  };

  it("adopts the existing live hero into editable Home sections", () => {
    const sections = defaultHomeSections(homepage, true);

    expect(sections.map((section) => section.type)).toEqual([
      "HERO",
      "CATEGORY_GRID",
      "STEPS",
      "CTA_BANNER",
    ]);
    expect(sections[0].content).toMatchObject({
      eyebrow: homepage.heroEyebrow,
      headline: homepage.heroHeadline,
      copy: homepage.heroDescription,
      ctaLabel: homepage.primaryCtaLabel,
      ctaHref: homepage.primaryCtaHref,
      secondaryCtaLabel: "Activate a product",
    });
  });

  it("uses the non-NFC story and collection call to action when NFC is unavailable", () => {
    const sections = defaultHomeSections(homepage, false);

    expect(sections[0].content).toMatchObject({ secondaryCtaLabel: "" });
    expect(sections[3].content).toMatchObject({
      ctaLabel: "Explore the collection",
      ctaHref: "/shop",
    });
  });
});
