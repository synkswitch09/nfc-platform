import type { LandingSectionDraft } from "@/lib/landing-sections";

/** The two completed regions in the Kosykin Zeplin home; all copy and media remain CMS fields. */
export function kosykinHomeTemplate(): LandingSectionDraft[] {
  const category = (title: string, slug: string, description: string, background: string, order: number) => ({
    id: crypto.randomUUID(),
    icon: "sparkles",
    title,
    description,
    imageUrl: "",
    imageAlt: title,
    ctaLabel: "Explore",
    ctaHref: "/shop",
    categorySlug: slug,
    iconBackgroundColour: background,
    visible: true,
    order,
  });

  return [
    {
      type: "HERO",
      name: "Kosykin · Wavy collection",
      visible: true,
      content: {
        layoutVariant: "KOSYKIN_WAVY",
        hideBreadcrumbs: true,
        eyebrow: "The",
        headline: "wavy",
        sideLabel: "Collection",
        copy: "Thoughtfully designed accessories that bring order, personality and clever function to your space.",
        imageUrl: "",
        imageAlt: "Pink ribbed phone and wireless charging stand",
        imageFit: "CONTAIN",
        ctaLabel: "Explore the collection",
        ctaHref: "/shop",
        features: [
          { id: crypto.randomUUID(), icon: "shield-check", label: "Secure checkout", supportingText: "Payments powered by Stripe", visible: true, order: 0 },
          { id: crypto.randomUUID(), icon: "package", label: "Shipping options", supportingText: "Calculated at checkout", visible: true, order: 1 },
          { id: crypto.randomUUID(), icon: "sparkles", label: "Made to order", supportingText: "Thoughtfully produced for you", visible: true, order: 2 },
        ],
      },
    },
    {
      type: "FEATURE_BADGES",
      name: "Kosykin · Collections",
      visible: true,
      content: {
        layoutVariant: "KOSYKIN_CIRCLES",
        headline: "Good taste. Everyday purpose. A little more you.",
        items: [
          category("Stands & Holders", "stands-holders", "Give your tech a happy home", "#eace70", 0),
          category("Planters & Vases", "planters-vases", "A little style for your leafy friends", "#e6b49d", 1),
          category("Home & Lighting", "home-lighting", "Bright ideas for cosy corners", "#b9afcf", 2),
          category("Personalised Pieces", "personalised-pieces", "Made with your personal twist", "#d4a6a9", 3),
          category("Seasonal Specials", "seasonal-specials", "A Kosy touch for every occasion", "#a9c2cc", 4),
        ],
      },
    },
  ];
}
