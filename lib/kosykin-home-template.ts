import type { LandingSectionDraft } from "@/lib/landing-sections";

/** Zeplin v3: every region remains editable through the existing page builder. */
export function kosykinHomeTemplate(): LandingSectionDraft[] {
  const media: Record<string, string> = { "stands-holders": "stands", "planters-vases": "planters", "home-lighting": "lighting", "personalised-pieces": "personalised", "seasonal-specials": "seasonal" };
  const category = (title: string, slug: string, description: string, background: string, order: number) => ({
    id: crypto.randomUUID(),
    icon: "sparkles",
    title,
    description,
    imageUrl: `/images/kosykin/collection-${media[slug]}.webp`,
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
    {
      type: "PRODUCT_SHOWCASE", name: "Kosykin · Favourites to discover", visible: true,
      content: { layoutVariant: "KOSYKIN_HOME", headline: "Meet your next favourite", limit: 4, featuredOnly: false, columns: 4 },
    },
    {
      type: "CTA_BANNER", name: "Kosykin · Launch promotions", visible: false,
      content: { layoutVariant: "KOSYKIN_PROMOTIONS", headline: "Launch gift", copy: "Get a FREE Wavy Mini Tray when you buy any Wavy Stand.", items: [], ctaLabel: "Explore the collection", ctaHref: "/shop", backgroundColour: "#b9afcf" },
    },
    {
      type: "FEATURE_LIST", name: "Kosykin · Why Kosy Kin", visible: true,
      content: { layoutVariant: "KOSYKIN_HOME", headline: "WHY KOSY KIN?", copy: "Useful every day. Curious at first glance.", imageUrl: "/images/kosykin/why-wavy.webp", imageAlt: "Blue Wavy stand", items: [
        { title: "Good looks. Everyday use.", description: "Function, personality and a little joy for everyday spaces.", icon: "sparkles" },
        { title: "Made when needed.", description: "Made to order, helping us avoid overproduction and unnecessary stock.", icon: "package" },
        { title: "Materials that make sense.", description: "Made from PLA, a plant-based material with a clean, lightweight finish.", icon: "hand-helping" },
        { title: "Care in every detail.", description: "From making and finishing to packing, every piece is carefully prepared in Adelaide.", icon: "heart-handshake" },
      ] },
    },
    {
      type: "MEDIA_CONTENT", name: "Kosykin · Our story", visible: true,
      content: { layoutVariant: "KOSYKIN_HOME", headline: "Made for the spaces you live in every day.", copy: "We started Kosy Kin with a simple idea: practical things can still have personality.\n\nWe believe the objects around us should do their job, feel good in our space and bring a little joy to everyday routines.\nThat’s why we focus on thoughtful function, playful forms and details worth noticing. We’re here to make everyday spaces feel a little more considered — and a little more yours.", imageUrl: "/images/kosykin/brand-story.webp", imageAlt: "Kosy Kin studio and illustrated maker", layout: "IMAGE_LEFT" },
    },
    {
      type: "FEATURE_BADGES", name: "Kosykin · Customer stories", visible: false,
      content: { layoutVariant: "KOSYKIN_REVIEWS", headline: "Made For Real Spaces. Loved In Real Life.", items: [] },
    },
    {
      type: "FAQ", name: "Kosykin · Home questions", visible: true,
      content: { layoutVariant: "KOSYKIN_HOME", headline: "Got a question?", copy: "We’ve put together the essentials about ordering, shipping, materials and product care.", ctaLabel: "View all FAQs", ctaHref: "/faq", items: [
        { question: "When will my order be ready?", answer: "Production times depend on the piece and our current workload. Check the estimated preparation time shown for your order; delivery time is additional." },
        { question: "Where do you ship and how much does it cost?", answer: "Available delivery options and shipping costs are calculated at checkout using your delivery address." },
        { question: "How should I care for my piece?", answer: "Wipe gently with a soft, damp cloth. Keep PLA pieces away from high heat, hot cars and dishwashers, and follow any care instructions on the product page." },
        { question: "What is your returns policy?", answer: "Please read our Terms & Conditions for returns and cancellations. If there is a problem with your order, contact us through Help & requests." },
      ] },
    },
    {
      type: "CTA_BANNER", name: "Kosykin · Need a hand", visible: true,
      content: { layoutVariant: "KOSYKIN_SUPPORT", headline: "Need a hand?", copy: "Questions about a product or your order? We’re here to help.", ctaLabel: "Help & requests", ctaHref: "/support", backgroundColour: "#f9f3e9" },
    },
  ];
}

/** Upgrade recognised modules without replacing CMS media, translations or unrelated sections. */
export function upgradeKosykinHome(existing: LandingSectionDraft[]): LandingSectionDraft[] {
  const remaining = [...existing];
  const result = kosykinHomeTemplate().map(template => {
    const index = remaining.findIndex(section => section.name === template.name || (template.type === "HERO" && section.type === "HERO") || (
      ["KOSYKIN_WAVY", "KOSYKIN_CIRCLES"].includes(String(template.content.layoutVariant)) && section.content.layoutVariant === template.content.layoutVariant
    ));
    if (index < 0) return template;
    const [section] = remaining.splice(index, 1);
    const content: Record<string, unknown> = { ...template.content, ...section.content, layoutVariant: template.content.layoutVariant };
    if (template.content.layoutVariant === "KOSYKIN_CIRCLES" && Array.isArray(content.items)) {
      const defaults = template.content.items as Array<Record<string, unknown>>;
      content.items = (content.items as Array<Record<string, unknown>>).map(item => {
        const original = defaults.find(row => row.categorySlug === item.categorySlug || row.title === item.title);
        return !item.imageUrl && original ? { ...item, imageUrl: original.imageUrl } : item;
      });
    }
    return { ...section, content };
  });
  return [...result, ...remaining];
}
