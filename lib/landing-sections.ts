import { LandingSectionType, Prisma } from "@prisma/client";
import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";

export const landingSectionTypes = [
  "HERO",
  "FEATURE_BADGES",
  "BENEFITS",
  "STEPS",
  "PRODUCT_SHOWCASE",
  "FEATURE_LIST",
  "MEDIA_CONTENT",
  "STORY_PROCESS",
  "FAQ",
  "CTA_BANNER",
  "PRODUCT_GRID",
  "CATEGORY_GRID",
  "RICH_TEXT",
  "TRUST_STRIP",
  "STATS",
] satisfies LandingSectionType[];

export const landingSectionRegistry: Record<
  LandingSectionType,
  {
    label: string;
    group:
      "Hero" | "Content" | "Features" | "Process" | "Commerce" | "Conversion";
    description: string;
  }
> = {
  HERO: {
    label: "Hero — text, features and image",
    group: "Hero",
    description:
      "Opening section with headline, feature icons, large media and two actions.",
  },
  MEDIA_CONTENT: {
    label: "Content — text and image split",
    group: "Content",
    description: "Editorial copy with an image on either side.",
  },
  RICH_TEXT: {
    label: "Content — structured text",
    group: "Content",
    description: "Long-form structured copy without arbitrary HTML.",
  },
  FEATURE_BADGES: {
    label: "Cards — icon feature grid",
    group: "Features",
    description:
      "Independent cards with icon, title, copy, image and optional link.",
  },
  BENEFITS: {
    label: "Benefits — horizontal icon row",
    group: "Features",
    description: "Compact benefit blocks with strong icon tiles.",
  },
  FEATURE_LIST: {
    label: "Showcase — copy, image and checklist",
    group: "Features",
    description:
      "Editorial product presentation with central media and a checklist.",
  },
  TRUST_STRIP: {
    label: "Trust — reassurance strip",
    group: "Features",
    description: "A compact row of short reassurance items.",
  },
  STATS: {
    label: "Highlights — facts or numbers",
    group: "Features",
    description: "Short numerical or factual highlights.",
  },
  STEPS: {
    label: "Steps — numbered image cards",
    group: "Process",
    description:
      "Numbered cards with an optional floating image and section action.",
  },
  STORY_PROCESS: {
    label: "Process — illustrated story panel",
    group: "Process",
    description:
      "Rounded story panel with illustrated moments and supporting media.",
  },
  PRODUCT_SHOWCASE: {
    label: "Product showcase",
    group: "Commerce",
    description: "Featured products selected from the current context.",
  },
  PRODUCT_GRID: {
    label: "Product grid",
    group: "Commerce",
    description: "A responsive product collection grid.",
  },
  CATEGORY_GRID: {
    label: "Category grid",
    group: "Commerce",
    description: "A responsive grid of Store categories.",
  },
  FAQ: {
    label: "FAQ — accordion row",
    group: "Conversion",
    description: "Accessible expandable questions and answers.",
  },
  CTA_BANNER: {
    label: "CTA — panoramic image banner",
    group: "Conversion",
    description: "Image-backed closing call to action.",
  },
};

export const landingColourThemes = [
  "INHERIT",
  "CORAL",
  "SKY",
  "MIDNIGHT",
  "VIOLET",
  "AMBER",
] as const;
export const landingColourThemeLabels: Record<
  (typeof landingColourThemes)[number],
  string
> = {
  INHERIT: "Use base page or category theme",
  CORAL: "Pastel peach",
  SKY: "Pastel blue",
  MIDNIGHT: "Pastel green",
  VIOLET: "Pastel lilac",
  AMBER: "Pastel butter",
};

const safeLink = z
  .string()
  .trim()
  .regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+#-]*$/)
  .or(z.literal(""))
  .default("");
const imageUrl = z
  .string()
  .trim()
  .refine(isSafeImageSource, "Use an uploaded image or an HTTP(S) image URL")
  .default("");
const colour = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i)
  .or(z.literal(""))
  .default("");
const radius = z
  .enum(["SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE"])
  .default("LARGE");
const layoutVariant = z
  .enum(["DEFAULT", "PASTEL_EDITORIAL"])
  .default("DEFAULT");
const sectionWidth = z
  .enum(["FULL", "WIDE", "STANDARD", "NARROW"])
  .default("STANDARD");
const spacing = z.enum(["COMPACT", "STANDARD", "RELAXED"]).default("STANDARD");
const headingScale = z
  .enum(["COMPACT", "STANDARD", "LARGE"])
  .default("STANDARD");
const imageFit = z.enum(["COVER", "CONTAIN"]).default("COVER");
const columns = z.number().int().min(1).max(4).default(3);
const legacyColourTheme = z.enum(["MINT", "PEACH", "BLUSH", "LILAC", "BUTTER"]);
const legacyColourThemeMap: Partial<
  Record<string, (typeof landingColourThemes)[number]>
> = {
  MINT: "MIDNIGHT",
  PEACH: "CORAL",
  BLUSH: "VIOLET",
  LILAC: "VIOLET",
  BUTTER: "AMBER",
};
const colourTheme = z
  .union([z.enum(landingColourThemes), legacyColourTheme])
  .transform((value) => legacyColourThemeMap[value] ?? value)
  .pipe(z.enum(landingColourThemes))
  .default("INHERIT");
const order = z.number().int().min(0).max(100).default(0);
const contentItemId = z
  .string()
  .uuid()
  .default(() => crypto.randomUUID());
const textBlockSchema = z.object({
  id: contentItemId,
  type: z.enum([
    "EYEBROW",
    "HEADING",
    "SUBHEADING",
    "PARAGRAPH",
    "SUPPORTING_TEXT",
  ]),
  text: z.string().trim().max(2_000),
  visible: z.boolean().default(true),
  order,
});
const featureSchema = z.object({
  id: contentItemId,
  icon: z.string().trim().max(40).default("sparkles"),
  label: z.string().trim().min(1).max(100),
  supportingText: z.string().trim().max(200).default(""),
  backgroundColour: colour,
  iconColour: colour,
  visible: z.boolean().default(true),
  order,
});
const baseCopy = {
  eyebrow: z.string().trim().max(100).default(""),
  eyebrowColour: colour,
  anchorId: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]*$/)
    .or(z.literal(""))
    .default(""),
  headline: z.string().trim().max(180).default(""),
  headlineColour: colour,
  copy: z.string().trim().max(3_000).default(""),
  copyColour: colour,
  imageUrl,
  imageAlt: z.string().trim().max(180).default(""),
  ctaLabel: z.string().trim().max(60).default(""),
  ctaHref: safeLink,
  ctaVisible: z.boolean().default(true),
  ctaBackground: colour,
  ctaTextColour: colour,
  ctaBorderColour: colour,
  secondaryCtaLabel: z.string().trim().max(60).default(""),
  secondaryCtaHref: safeLink,
  secondaryCtaVisible: z.boolean().default(true),
  secondaryCtaBackground: colour,
  secondaryCtaTextColour: colour,
  secondaryCtaBorderColour: colour,
  backgroundColour: colour,
  textColour: colour,
  cardBackgroundColour: colour,
  cardTextColour: colour,
  cardBorderColour: colour,
  radius,
  layoutVariant,
  sectionWidth,
  spacing,
  headingScale,
  imageFit,
  columns,
  colourTheme,
};
const narrativeSchema = z.object({
  ...baseCopy,
  layout: z
    .enum(["IMAGE_LEFT", "IMAGE_RIGHT", "TEXT_ONLY", "CENTRED"])
    .default("IMAGE_RIGHT"),
  textBlocks: z.array(textBlockSchema).max(12).default([]),
  features: z.array(featureSchema).max(8).default([]),
  bullets: z.array(z.string().trim().min(1).max(240)).max(12).default([]),
  mobileImageUrl: imageUrl,
  imagePosition: z.enum(["LEFT", "CENTRE", "RIGHT"]).default("CENTRE"),
  overlay: z.enum(["NONE", "LIGHT", "DARK"]).default("NONE"),
  contentPosition: z.enum(["LEFT", "CENTRE", "RIGHT"]).default("LEFT"),
});
const itemSchema = z.object({
  id: contentItemId,
  icon: z.string().trim().max(40).default("sparkles"),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(700).default(""),
  supportingText: z.string().trim().max(200).default(""),
  imageUrl,
  imageAlt: z.string().trim().max(180).default(""),
  ctaLabel: z.string().trim().max(60).default(""),
  ctaHref: safeLink,
  ctaBackground: colour,
  ctaTextColour: colour,
  ctaBorderColour: colour,
  backgroundColour: colour,
  textColour: colour,
  iconBackgroundColour: colour,
  iconColour: colour,
  imagePosition: z.number().min(-20).max(20).default(0),
  visible: z.boolean().default(true),
  order,
});
const itemsSchema = z.object({
  ...baseCopy,
  items: z.array(itemSchema).max(16).default([]),
});
const faqSchema = z.object({
  ...baseCopy,
  items: z
    .array(
      z.object({
        id: contentItemId,
        question: z.string().trim().min(3).max(200),
        answer: z.string().trim().min(5).max(1_500),
        visible: z.boolean().default(true),
        order,
      }),
    )
    .max(30)
    .default([]),
});
const gridSchema = z.object({
  ...baseCopy,
  limit: z.number().int().min(1).max(24).default(6),
  featuredOnly: z.boolean().default(false),
});

const contentSchemas: Record<LandingSectionType, z.ZodTypeAny> = {
  HERO: narrativeSchema,
  FEATURE_BADGES: itemsSchema,
  BENEFITS: itemsSchema,
  STEPS: itemsSchema,
  PRODUCT_SHOWCASE: gridSchema,
  FEATURE_LIST: itemsSchema,
  MEDIA_CONTENT: narrativeSchema,
  STORY_PROCESS: itemsSchema,
  FAQ: faqSchema,
  CTA_BANNER: narrativeSchema,
  PRODUCT_GRID: gridSchema,
  CATEGORY_GRID: gridSchema,
  RICH_TEXT: narrativeSchema,
  TRUST_STRIP: itemsSchema,
  STATS: itemsSchema,
};

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.nativeEnum(LandingSectionType),
  name: z.string().trim().min(1).max(100),
  visible: z.boolean(),
  content: z.unknown(),
});

export type LandingSectionDraft = {
  id?: string;
  clientKey?: string;
  type: LandingSectionType;
  name: string;
  visible: boolean;
  content: Record<string, unknown>;
};

export function validateLandingSections(value: unknown): LandingSectionDraft[] {
  const rows = z.array(sectionSchema).max(30).parse(value);
  const sections = rows.map((row) => ({
    ...row,
    content: contentSchemas[row.type].parse(row.content) as Record<
      string,
      unknown
    >,
  }));
  if (
    sections.filter((section) => section.visible && section.type === "HERO")
      .length > 1
  )
    throw new Error("A page can have only one visible Hero section");
  const ids = sections.flatMap((section) => (section.id ? [section.id] : []));
  if (new Set(ids).size !== ids.length)
    throw new Error("A saved section cannot appear more than once");
  for (const section of sections) {
    for (const field of ["textBlocks", "features", "items"] as const) {
      const entries = Array.isArray(section.content[field])
        ? (section.content[field] as Array<{ id?: string }>)
        : [];
      const itemIds = entries.flatMap((item) => (item.id ? [item.id] : []));
      if (new Set(itemIds).size !== itemIds.length)
        throw new Error(`${section.name} contains duplicate item identities`);
    }
  }
  return sections;
}

export function parseLandingContent(
  type: LandingSectionType,
  value: Prisma.JsonValue,
) {
  const parsed = contentSchemas[type].safeParse(value);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}

export function blankLandingSection(
  type: LandingSectionType,
): LandingSectionDraft {
  const schema = contentSchemas[type];
  const seed = ["FAQ"].includes(type)
    ? { items: [] }
    : [
          "FEATURE_BADGES",
          "BENEFITS",
          "STEPS",
          "FEATURE_LIST",
          "STORY_PROCESS",
          "TRUST_STRIP",
          "STATS",
        ].includes(type)
      ? { items: [] }
      : ["PRODUCT_SHOWCASE", "PRODUCT_GRID", "CATEGORY_GRID"].includes(type)
        ? { limit: 6, featuredOnly: false }
        : {};
  return {
    clientKey: crypto.randomUUID(),
    type,
    name: landingSectionRegistry[type].label,
    visible: true,
    content: schema.parse(seed) as Record<string, unknown>,
  };
}

export function prepareLandingSectionDrafts(sections: LandingSectionDraft[]) {
  return sections.map((section) => ({
    ...section,
    clientKey: section.clientKey ?? crypto.randomUUID(),
    content: contentSchemas[section.type].parse(section.content) as Record<
      string,
      unknown
    >,
  }));
}

export function duplicateLandingSection(
  section: LandingSectionDraft,
): LandingSectionDraft {
  const content = structuredClone(section.content);
  for (const field of ["textBlocks", "features", "items"] as const) {
    if (Array.isArray(content[field]))
      content[field] = (content[field] as Array<Record<string, unknown>>).map(
        (item) => ({ ...item, id: crypto.randomUUID() }),
      );
  }
  return {
    ...section,
    id: undefined,
    clientKey: crypto.randomUUID(),
    name: `${section.name} copy`,
    content,
  };
}

export function modularFaq(
  sections: Array<{
    type: LandingSectionType;
    visible: boolean;
    content: Prisma.JsonValue;
  }>,
) {
  return sections.flatMap((section) => {
    if (!section.visible || section.type !== "FAQ") return [];
    const content = parseLandingContent(section.type, section.content);
    return (
      (content?.items as
        | Array<{
            question: string;
            answer: string;
            visible?: boolean;
            order?: number;
          }>
        | undefined) ?? []
    )
      .filter((item) => item.visible !== false)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map(({ question, answer }) => ({ question, answer }));
  });
}

export function modularHeroImage(
  sections: Array<{
    type: LandingSectionType;
    visible: boolean;
    content: Prisma.JsonValue;
  }>,
) {
  const hero = sections.find(
    (section) => section.visible && section.type === "HERO",
  );
  const content = hero ? parseLandingContent(hero.type, hero.content) : null;
  return typeof content?.imageUrl === "string" && content.imageUrl
    ? content.imageUrl
    : null;
}
