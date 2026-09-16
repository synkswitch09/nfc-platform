import type { LandingSectionDraft } from "@/lib/landing-sections";
import type { StorefrontHomepage } from "@/lib/storefront";

type HomeSectionInput = Pick<
  StorefrontHomepage,
  | "heroEyebrow"
  | "heroHeadline"
  | "heroDescription"
  | "primaryCtaLabel"
  | "primaryCtaHref"
>;

/**
 * Converts the legacy, settings-backed home into the same structured blocks
 * used by category pages. It intentionally preserves the live hero values so
 * a Store can begin editing Home without rebuilding the page from scratch.
 */
export function defaultHomeSections(
  homepage: HomeSectionInput,
  nfcEnabled: boolean,
): LandingSectionDraft[] {
  const story = nfcEnabled
    ? {
        eyebrow: "Built around real use cases",
        headline: "One platform. Many useful connections.",
        copy: "Choose the product that fits the moment. Every category has its own purpose, content and configurable experience.",
        steps: [
          ["Choose and personalise", "Select a product, material, colour and the details you want manufactured."],
          ["Receive and activate", "Your printed product arrives with a separate one-time activation credential."],
          ["Stay in control", "Update the profile, destination or status without reprogramming the NFC chip."],
        ],
        closing: "Products designed around real life.",
        closingCopy: "Clear materials, thoughtful personalisation and straightforward support from a store that keeps you in control.",
        closingCta: "Explore practical guides",
        closingHref: "/guides",
      }
    : {
        eyebrow: "Made to settle into real life",
        headline: "Useful forms for calmer everyday spaces.",
        copy: "Explore purpose-built objects designed around desks, organisation and the routines that happen every day.",
        steps: [
          ["Choose a useful form", "Start with an everyday problem and select the size, finish and colour that fits."],
          ["Made in small batches", "Your product moves through 3D printing, finishing and practical quality checks."],
          ["Put it straight to work", "Unpack a durable object designed for a clear job and a considered space."],
        ],
        closing: "Small objects. Noticeably better routines.",
        closingCopy: "Thoughtful proportions, useful materials and straightforward support from design through delivery.",
        closingCta: "Explore the collection",
        closingHref: "/shop",
      };

  return [
    {
      type: "HERO",
      name: "Hero",
      visible: true,
      content: {
        layout: "IMAGE_RIGHT",
        eyebrow: homepage.heroEyebrow,
        headline: homepage.heroHeadline,
        copy: homepage.heroDescription,
        imageUrl: "",
        imageAlt: "",
        ctaLabel: homepage.primaryCtaLabel,
        ctaHref: homepage.primaryCtaHref,
        secondaryCtaLabel: nfcEnabled ? "Activate a product" : "",
        secondaryCtaHref: nfcEnabled ? "/activate" : "",
        bullets: [],
        textBlocks: [],
        features: [],
      },
    },
    {
      type: "CATEGORY_GRID",
      name: "Collections",
      visible: true,
      content: {
        eyebrow: story.eyebrow,
        headline: story.headline,
        copy: story.copy,
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "",
        ctaHref: "",
        limit: 8,
        featuredOnly: false,
      },
    },
    {
      type: "STEPS",
      name: "How it works",
      visible: true,
      content: {
        eyebrow: "Simple by design",
        headline: nfcEnabled
          ? "From idea to one useful tap."
          : "From useful idea to finished object.",
        copy: "",
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "",
        ctaHref: "",
        items: story.steps.map(([title, description], order) => ({
          id: crypto.randomUUID(),
          icon: "sparkles",
          title,
          description,
          supportingText: "",
          imageUrl: "",
          imageAlt: "",
          ctaLabel: "",
          ctaHref: "",
          visible: true,
          order,
        })),
      },
    },
    {
      type: "CTA_BANNER",
      name: "Closing call to action",
      visible: true,
      content: {
        layout: "CENTRED",
        eyebrow: "Designed for trust",
        headline: story.closing,
        copy: story.closingCopy,
        imageUrl: "",
        imageAlt: "",
        ctaLabel: story.closingCta,
        ctaHref: story.closingHref,
        bullets: [],
        textBlocks: [],
        features: [],
      },
    },
  ];
}
