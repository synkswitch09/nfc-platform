import { describe, expect, it } from "vitest";
import {
  blankLandingSection,
  duplicateLandingSection,
  landingColourThemes,
  landingSectionTypes,
  modularFaq,
  parseLandingContent,
  validateLandingSections,
} from "@/lib/landing-sections";

describe("typed modular landing content", () => {
  it("accepts ordered structured sections without arbitrary HTML", () => {
    const sections = validateLandingSections([
      {
        type: "HERO",
        name: "Pet hero",
        visible: true,
        content: {
          eyebrow: "More than a tag",
          headline: "Help them get home",
          copy: "NFC and QR make contact easier.",
          ctaLabel: "Shop pet tags",
          ctaHref: "/shop?category=pet",
          layout: "IMAGE_RIGHT",
        },
      },
    ]);
    expect(sections[0]?.content.headline).toBe("Help them get home");
    expect(sections[0]?.content).not.toHaveProperty("html");
  });

  it("rejects external and protocol-relative CTA injection", () => {
    expect(() =>
      validateLandingSections([
        {
          type: "CTA_BANNER",
          name: "Unsafe",
          visible: true,
          content: { ctaHref: "https://evil.example" },
        },
      ]),
    ).toThrow();
    expect(() =>
      validateLandingSections([
        {
          type: "CTA_BANNER",
          name: "Unsafe",
          visible: true,
          content: { ctaHref: "//evil.example" },
        },
      ]),
    ).toThrow();
  });

  it("accepts Store-scoped uploaded media paths and rejects unrelated internal image paths", () => {
    const imageUrl =
      "/api/media/development-tapkin-550e8400-e29b-41d4-a716-446655440000.webp";
    expect(
      validateLandingSections([
        {
          type: "HERO",
          name: "Uploaded hero",
          visible: true,
          content: { imageUrl },
        },
      ])[0]?.content.imageUrl,
    ).toBe(imageUrl);
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Unsafe image",
          visible: true,
          content: { imageUrl: "/api/admin/users" },
        },
      ]),
    ).toThrow();
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Label is not an image",
          visible: true,
          content: {
            imageUrl:
              "/api/media/development-tapkin-550e8400-e29b-41d4-a716-446655440000.pdf",
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Unsafe image",
          visible: true,
          content: { imageUrl: "javascript:alert(1)" },
        },
      ]),
    ).toThrow();
  });

  it("ignores invalid persisted content instead of rendering it", () => {
    expect(
      parseLandingContent("HERO", { ctaHref: "javascript:alert(1)" }),
    ).toBeNull();
  });

  it("extracts only visible modular FAQ entries for structured data", () => {
    const visible = {
      type: "FAQ" as const,
      visible: true,
      content: {
        items: [
          {
            question: "Hidden item",
            answer: "This item must stay out of structured data.",
            visible: false,
            order: 0,
          },
          {
            question: "Can I update it?",
            answer: "Yes, update the profile without replacing the tag.",
            visible: true,
            order: 2,
          },
          {
            question: "Does it need an app?",
            answer: "No, a compatible browser opens the page.",
            visible: true,
            order: 1,
          },
        ],
      },
    };
    const hidden = {
      type: "FAQ" as const,
      visible: false,
      content: {
        items: [
          { question: "Hidden question", answer: "This must not be indexed." },
        ],
      },
    };
    expect(modularFaq([visible, hidden])).toEqual([
      {
        question: "Does it need an app?",
        answer: "No, a compatible browser opens the page.",
      },
      {
        question: "Can I update it?",
        answer: "Yes, update the profile without replacing the tag.",
      },
    ]);
  });

  it("accepts controlled colours and rejects CSS injection", () => {
    const [section] = validateLandingSections([
      {
        type: "HERO",
        name: "Styled hero",
        visible: true,
        content: {
          backgroundColour: "#fffaf5",
          textColour: "#17212b",
          eyebrowColour: "#5f6866",
          headlineColour: "#111111",
          copyColour: "#67716f",
          radius: "EXTRA_LARGE",
          layoutVariant: "PASTEL_EDITORIAL",
          colourTheme: "MINT",
          sectionWidth: "WIDE",
          spacing: "COMPACT",
          headingScale: "LARGE",
          imageFit: "CONTAIN",
          columns: 4,
          anchorId: "pet-hero",
        },
      },
    ]);
    expect(section?.content).toMatchObject({
      backgroundColour: "#fffaf5",
      textColour: "#17212b",
      eyebrowColour: "#5f6866",
      headlineColour: "#111111",
      copyColour: "#67716f",
      radius: "EXTRA_LARGE",
      layoutVariant: "PASTEL_EDITORIAL",
      colourTheme: "MIDNIGHT",
      sectionWidth: "WIDE",
      spacing: "COMPACT",
      headingScale: "LARGE",
      imageFit: "CONTAIN",
      columns: 4,
      anchorId: "pet-hero",
    });
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Unsafe style",
          visible: true,
          content: {
            backgroundColour: "red; background:url(javascript:alert(1))",
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Unsafe anchor",
          visible: true,
          content: { anchorId: "bad anchor" },
        },
      ]),
    ).toThrow();
    expect(() =>
      validateLandingSections([
        {
          type: "FAQ",
          name: "Too many columns",
          visible: true,
          content: { columns: 12 },
        },
      ]),
    ).toThrow();
  });

  it("offers inheritable pastel themes with per-element colour overrides", () => {
    expect(landingColourThemes).toEqual([
      "INHERIT",
      "CORAL",
      "SKY",
      "MIDNIGHT",
      "VIOLET",
      "AMBER",
    ]);
    const [section] = validateLandingSections([
      {
        type: "FEATURE_BADGES",
        name: "Editable cards",
        visible: true,
        content: {
          colourTheme: "BLUSH",
          cardBackgroundColour: "#fff8f8",
          cardTextColour: "#292323",
          cardBorderColour: "#efdada",
          items: [
            {
              title: "Custom card",
              textColour: "#222222",
              backgroundColour: "#ffeeee",
              ctaLabel: "Open",
              ctaHref: "/shop",
              ctaBackground: "#333333",
              ctaTextColour: "#ffffff",
              ctaBorderColour: "#333333",
            },
          ],
        },
      },
    ]);
    expect(section?.content).toMatchObject({
      colourTheme: "VIOLET",
      cardBackgroundColour: "#fff8f8",
      cardTextColour: "#292323",
      cardBorderColour: "#efdada",
      items: [
        expect.objectContaining({
          textColour: "#222222",
          backgroundColour: "#ffeeee",
          ctaBackground: "#333333",
          ctaTextColour: "#ffffff",
        }),
      ],
    });
    expect(() =>
      validateLandingSections([
        {
          type: "HERO",
          name: "Unknown theme",
          visible: true,
          content: { colourTheme: "NEON" },
        },
      ]),
    ).toThrow();
  });

  it("keeps ordered item visibility as typed data", () => {
    const [section] = validateLandingSections([
      {
        type: "STEPS",
        name: "Steps",
        visible: true,
        content: {
          items: [
            { title: "Second", visible: true, order: 1 },
            { title: "Hidden", visible: false, order: 0 },
          ],
        },
      },
    ]);
    expect(section?.content.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Second", visible: true, order: 1 }),
        expect.objectContaining({ title: "Hidden", visible: false, order: 0 }),
      ]),
    );
  });

  it("assigns stable unique identities when labels and titles repeat", () => {
    const [hero, benefits, steps, story, faq] = validateLandingSections([
      {
        type: "HERO",
        name: "Hero",
        visible: true,
        content: {
          features: [
            { label: "Same", order: 0 },
            { label: "Same", order: 1 },
          ],
        },
      },
      {
        type: "BENEFITS",
        name: "Benefits",
        visible: true,
        content: {
          items: [
            { title: "Same", order: 0 },
            { title: "Same", order: 1 },
          ],
        },
      },
      {
        type: "STEPS",
        name: "Steps",
        visible: true,
        content: {
          items: [
            { title: "Same", order: 0 },
            { title: "Same", order: 1 },
          ],
        },
      },
      {
        type: "STORY_PROCESS",
        name: "Story",
        visible: true,
        content: {
          items: [
            { title: "Same", order: 0 },
            { title: "Same", order: 1 },
          ],
        },
      },
      {
        type: "FAQ",
        name: "FAQ",
        visible: true,
        content: {
          items: [
            {
              question: "Same question?",
              answer: "Same valid answer.",
              order: 0,
            },
            {
              question: "Same question?",
              answer: "Same valid answer.",
              order: 1,
            },
          ],
        },
      },
    ]);
    for (const section of [hero, benefits, steps, story, faq]) {
      const entries = (section?.content.items ??
        section?.content.features) as Array<{ id: string }>;
      expect(new Set(entries.map((item) => item.id)).size).toBe(entries.length);
    }
    const duplicate = duplicateLandingSection(benefits!);
    expect(duplicate.id).toBeUndefined();
    expect(
      (duplicate.content.items as Array<{ id: string }>).map((item) => item.id),
    ).not.toEqual(
      (benefits!.content.items as Array<{ id: string }>).map((item) => item.id),
    );
  });

  it("provides safe typed defaults for newly added sections", () => {
    expect(blankLandingSection("PRODUCT_GRID")).toMatchObject({
      type: "PRODUCT_GRID",
      visible: true,
      content: { limit: 6, featuredOnly: false },
    });
    expect(
      landingSectionTypes.map((type) => blankLandingSection(type).type),
    ).toEqual(landingSectionTypes);
  });

  it("prevents multiple visible heroes from creating multiple H1 headings", () => {
    const hero = {
      type: "HERO" as const,
      name: "Hero",
      visible: true,
      content: {},
    };
    expect(() =>
      validateLandingSections([hero, { ...hero, name: "Second hero" }]),
    ).toThrow("only one visible Hero");
    expect(
      validateLandingSections([
        hero,
        { ...hero, name: "Hidden hero", visible: false },
      ]),
    ).toHaveLength(2);
  });
});
