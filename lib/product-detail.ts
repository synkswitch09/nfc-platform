import { z } from "zod";
import { contentIconKeys } from "@/lib/content-icons";
import { isSafeImageSource } from "@/lib/image-source";

const text = (max: number) => z.string().trim().max(max);
const colour = (fallback: string) => z.preprocess(value => value === "" || value == null ? fallback : value, z.string().regex(/^#[a-f\d]{6}$/i, "Use a six-digit hex colour, such as #243247."));
export const productDetailSchema = z.object({
  showDescription: z.boolean().default(true),
  showHighlights: z.boolean().default(true),
  showDetails: z.boolean().default(true),
  showRecommendations: z.boolean().default(true),
  showTrust: z.boolean().default(true),
  buttons: z.object({
    cartBackground: colour("#243247"), cartText: colour("#ffffff"),
    buyBackground: colour("#E8CB67"), buyText: colour("#243247"),
  }).prefault({ cartBackground: undefined, cartText: undefined, buyBackground: undefined, buyText: undefined }),
  highlights: z.array(z.object({
    title: text(80).default(""), text: text(240).default(""),
    icon: z.enum(contentIconKeys).default("sparkles"),
    visible: z.boolean().default(true),
  })).max(8).default([]),
  video: z.object({
    enabled: z.boolean().default(false),
    url: text(1000).refine(value => !value || /^https:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[^\s]+$/i.test(value), "Use an HTTPS Instagram reel or post link.").default(""),
    imageUrl: text(2000).refine(value => !value || isSafeImageSource(value), "Select an uploaded image or a valid image URL.").default(""),
    title: text(100).default("See it in action"), text: text(300).default(""),
    ctaLabel: text(80).default("Watch on Instagram"),
  }).prefault({}),
  sections: z.array(z.object({ title: text(100).default(""), text: text(8000).default(""), visible: z.boolean().default(true) })).max(12).default([]),
});
export type ProductDetailConfig = z.infer<typeof productDetailSchema>;
export function parseProductDetail(value: unknown): ProductDetailConfig {
  const parsed = productDetailSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : productDetailSchema.parse({});
}
export function visibleProductBlocks(config: ProductDetailConfig) {
  return {
    highlights: config.showHighlights ? config.highlights.filter(item => item.visible && item.title.trim()) : [],
    sections: config.showDetails ? config.sections.filter(item => item.visible && item.title.trim() && item.text.trim()) : [],
    video: config.video.enabled && config.video.url && config.video.title.trim() ? config.video : null,
  };
}
/** Called once per server render, so option changes never reshuffle the cards. */
export function recommendedProducts<T extends { id: string }>(candidates: T[], currentId: string, random = Math.random): T[] {
  const pool = [...new Map(candidates.filter(item => item.id !== currentId).map(item => [item.id, item])).values()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4);
}

/** Keep category labels legible when a merchant chooses a dark accent. */
export function categoryTextColour(background: string): string {
  const values = (background.match(/[a-f\d]{2}/gi) ?? ["e8", "cb", "67"]).slice(0, 3).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const luminance = .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
  return luminance > .3 ? "#243247" : "#ffffff";
}
