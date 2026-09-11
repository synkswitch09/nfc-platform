import { LandingSectionType, Prisma } from "@prisma/client";
import { z } from "zod";

const safePath = z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+-]*$/).or(z.literal("")).default("");
const imageUrl = z.string().trim().url().refine(value => /^https?:\/\//i.test(value)).or(z.literal("")).default("");
const baseCopy = {
  eyebrow: z.string().trim().max(100).default(""),
  headline: z.string().trim().max(180).default(""),
  copy: z.string().trim().max(3_000).default(""),
  imageUrl,
  imageAlt: z.string().trim().max(180).default(""),
  ctaLabel: z.string().trim().max(60).default(""),
  ctaHref: safePath,
};
const narrativeSchema = z.object({ ...baseCopy, layout: z.enum(["IMAGE_LEFT", "IMAGE_RIGHT", "TEXT_ONLY", "CENTRED"]).default("IMAGE_RIGHT"), bullets: z.array(z.string().trim().min(1).max(240)).max(12).default([]) });
const itemSchema = z.object({ icon: z.string().trim().max(40).default("sparkles"), title: z.string().trim().min(1).max(120), description: z.string().trim().max(700).default(""), imageUrl, imageAlt: z.string().trim().max(180).default(""), ctaLabel: z.string().trim().max(60).default(""), ctaHref: safePath });
const itemsSchema = z.object({ ...baseCopy, items: z.array(itemSchema).max(16).default([]) });
const faqSchema = z.object({ ...baseCopy, items: z.array(z.object({ question: z.string().trim().min(3).max(200), answer: z.string().trim().min(5).max(1_500) })).max(30).default([]) });
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
  const names: Record<LandingSectionType, string> = { HERO: "Hero", FEATURE_BADGES: "Feature badges", BENEFITS: "Benefits", STEPS: "How it works", PRODUCT_SHOWCASE: "Featured products", FEATURE_LIST: "Features", MEDIA_CONTENT: "Image and text", STORY_PROCESS: "Our process", FAQ: "FAQ", CTA_BANNER: "Call to action", PRODUCT_GRID: "Products", CATEGORY_GRID: "Categories", RICH_TEXT: "Story", TRUST_STRIP: "Trust", STATS: "Highlights" };
  const schema = contentSchemas[type];
  const seed = ["FAQ"].includes(type) ? { items: [] } : ["FEATURE_BADGES", "BENEFITS", "STEPS", "FEATURE_LIST", "STORY_PROCESS", "TRUST_STRIP", "STATS"].includes(type) ? { items: [] } : ["PRODUCT_SHOWCASE", "PRODUCT_GRID", "CATEGORY_GRID"].includes(type) ? { limit: 6, featuredOnly: false } : {};
  return { type, name: names[type], visible: true, content: schema.parse(seed) as Record<string, unknown> };
}

export function modularFaq(sections: Array<{ type: LandingSectionType; visible: boolean; content: Prisma.JsonValue }>) {
  return sections.flatMap(section => {
    if (!section.visible || section.type !== "FAQ") return [];
    const content = parseLandingContent(section.type, section.content);
    return (content?.items as Array<{ question: string; answer: string }> | undefined) ?? [];
  });
}

export function modularHeroImage(sections: Array<{ type: LandingSectionType; visible: boolean; content: Prisma.JsonValue }>) {
  const hero = sections.find(section => section.visible && section.type === "HERO");
  const content = hero ? parseLandingContent(hero.type, hero.content) : null;
  return typeof content?.imageUrl === "string" && content.imageUrl ? content.imageUrl : null;
}
