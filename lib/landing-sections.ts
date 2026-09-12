import { LandingSectionType, Prisma } from "@prisma/client";
import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";

export const landingSectionTypes = ["HERO", "FEATURE_BADGES", "BENEFITS", "STEPS", "PRODUCT_SHOWCASE", "FEATURE_LIST", "MEDIA_CONTENT", "STORY_PROCESS", "FAQ", "CTA_BANNER", "PRODUCT_GRID", "CATEGORY_GRID", "RICH_TEXT", "TRUST_STRIP", "STATS"] satisfies LandingSectionType[];

export const landingSectionRegistry: Record<LandingSectionType, { label: string; group: "Hero" | "Content" | "Features" | "Process" | "Commerce" | "Conversion"; description: string }> = {
  HERO: { label: "Hero", group: "Hero", description: "Large introduction with text blocks, feature icons, media and two actions." },
  MEDIA_CONTENT: { label: "Media content", group: "Content", description: "Image and editorial copy in a controlled split layout." },
  RICH_TEXT: { label: "Rich text", group: "Content", description: "Structured story copy without arbitrary HTML." },
  FEATURE_BADGES: { label: "Feature badges", group: "Features", description: "Compact icon and label highlights." },
  BENEFITS: { label: "Benefits", group: "Features", description: "Wide icon blocks with titles and supporting copy." },
  FEATURE_LIST: { label: "Feature showcase", group: "Features", description: "Copy, central media and a configurable checklist." },
  TRUST_STRIP: { label: "Trust strip", group: "Features", description: "A compact row of reassurance items." },
  STATS: { label: "Highlights", group: "Features", description: "Short numerical or factual highlights." },
  STEPS: { label: "Step cards", group: "Process", description: "Numbered cards with floating images and a section action." },
  STORY_PROCESS: { label: "Story process", group: "Process", description: "Rounded scenario panel with story items and supporting media." },
  PRODUCT_SHOWCASE: { label: "Product showcase", group: "Commerce", description: "Featured products selected from the current context." },
  PRODUCT_GRID: { label: "Product grid", group: "Commerce", description: "A responsive product collection grid." },
  CATEGORY_GRID: { label: "Category grid", group: "Commerce", description: "A responsive grid of Store categories." },
  FAQ: { label: "FAQ accordion", group: "Conversion", description: "Accessible expandable questions and answers." },
  CTA_BANNER: { label: "Promo banner", group: "Conversion", description: "Image-backed closing call to action." },
};

const safeLink = z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+-]*$/).or(z.literal("")).default("");
const imageUrl = z.string().trim().refine(isSafeImageSource, "Use an uploaded image or an HTTP(S) image URL").default("");
const colour = z.string().trim().regex(/^#[0-9a-f]{6}$/i).or(z.literal("")).default("");
const radius = z.enum(["SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE"]).default("LARGE");
const order = z.number().int().min(0).max(100).default(0);
const textBlockSchema = z.object({ type: z.enum(["EYEBROW", "HEADING", "SUBHEADING", "PARAGRAPH", "SUPPORTING_TEXT"]), text: z.string().trim().max(2_000), visible: z.boolean().default(true), order });
const featureSchema = z.object({ icon: z.string().trim().max(40).default("sparkles"), label: z.string().trim().min(1).max(100), supportingText: z.string().trim().max(200).default(""), backgroundColour: colour, iconColour: colour, visible: z.boolean().default(true), order });
const baseCopy = {
  eyebrow: z.string().trim().max(100).default(""),
  headline: z.string().trim().max(180).default(""),
  copy: z.string().trim().max(3_000).default(""),
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
  radius,
};
const narrativeSchema = z.object({ ...baseCopy, layout: z.enum(["IMAGE_LEFT", "IMAGE_RIGHT", "TEXT_ONLY", "CENTRED"]).default("IMAGE_RIGHT"), textBlocks: z.array(textBlockSchema).max(12).default([]), features: z.array(featureSchema).max(8).default([]), bullets: z.array(z.string().trim().min(1).max(240)).max(12).default([]), mobileImageUrl: imageUrl, imagePosition: z.enum(["LEFT", "CENTRE", "RIGHT"]).default("CENTRE"), overlay: z.enum(["NONE", "LIGHT", "DARK"]).default("NONE"), contentPosition: z.enum(["LEFT", "CENTRE", "RIGHT"]).default("LEFT") });
const itemSchema = z.object({ icon: z.string().trim().max(40).default("sparkles"), title: z.string().trim().min(1).max(120), description: z.string().trim().max(700).default(""), supportingText: z.string().trim().max(200).default(""), imageUrl, imageAlt: z.string().trim().max(180).default(""), ctaLabel: z.string().trim().max(60).default(""), ctaHref: safeLink, backgroundColour: colour, iconBackgroundColour: colour, iconColour: colour, imagePosition: z.number().min(-20).max(20).default(0), visible: z.boolean().default(true), order });
const itemsSchema = z.object({ ...baseCopy, items: z.array(itemSchema).max(16).default([]) });
const faqSchema = z.object({ ...baseCopy, items: z.array(z.object({ question: z.string().trim().min(3).max(200), answer: z.string().trim().min(5).max(1_500), visible: z.boolean().default(true), order })).max(30).default([]) });
const gridSchema = z.object({ ...baseCopy, limit: z.number().int().min(1).max(24).default(6), featuredOnly: z.boolean().default(false) });

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

const sectionSchema = z.object({ id: z.string().uuid().optional(), type: z.nativeEnum(LandingSectionType), name: z.string().trim().min(1).max(100), visible: z.boolean(), content: z.unknown() });

export type LandingSectionDraft = { id?: string; type: LandingSectionType; name: string; visible: boolean; content: Record<string, unknown> };

export function validateLandingSections(value: unknown): LandingSectionDraft[] {
  const rows = z.array(sectionSchema).max(30).parse(value);
  return rows.map(row => ({ ...row, content: contentSchemas[row.type].parse(row.content) as Record<string, unknown> }));
}

export function parseLandingContent(type: LandingSectionType, value: Prisma.JsonValue) {
  const parsed = contentSchemas[type].safeParse(value);
  return parsed.success ? parsed.data as Record<string, unknown> : null;
}

export function blankLandingSection(type: LandingSectionType): LandingSectionDraft {
  const schema = contentSchemas[type];
  const seed = ["FAQ"].includes(type) ? { items: [] } : ["FEATURE_BADGES", "BENEFITS", "STEPS", "FEATURE_LIST", "STORY_PROCESS", "TRUST_STRIP", "STATS"].includes(type) ? { items: [] } : ["PRODUCT_SHOWCASE", "PRODUCT_GRID", "CATEGORY_GRID"].includes(type) ? { limit: 6, featuredOnly: false } : {};
  return { type, name: landingSectionRegistry[type].label, visible: true, content: schema.parse(seed) as Record<string, unknown> };
}

export function modularFaq(sections: Array<{ type: LandingSectionType; visible: boolean; content: Prisma.JsonValue }>) {
  return sections.flatMap(section => {
    if (!section.visible || section.type !== "FAQ") return [];
    const content = parseLandingContent(section.type, section.content);
    return ((content?.items as Array<{ question: string; answer: string; visible?: boolean; order?: number }> | undefined) ?? []).filter(item => item.visible !== false).sort((left, right) => (left.order ?? 0) - (right.order ?? 0)).map(({ question, answer }) => ({ question, answer }));
  });
}

export function modularHeroImage(sections: Array<{ type: LandingSectionType; visible: boolean; content: Prisma.JsonValue }>) {
  const hero = sections.find(section => section.visible && section.type === "HERO");
  const content = hero ? parseLandingContent(hero.type, hero.content) : null;
  return typeof content?.imageUrl === "string" && content.imageUrl ? content.imageUrl : null;
}
