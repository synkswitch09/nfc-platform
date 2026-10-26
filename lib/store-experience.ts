import { availableGiftChoices } from "@/lib/gift-variants";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { isSafeImageSource } from "@/lib/image-source";

const colour = z.string().regex(/^#[\da-f]{6}$/i);
const image = z.string().refine(isSafeImageSource).default("");
const slide = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  supportingText: z.string().trim().max(400).default(""),
  visible: z.boolean().default(true),
  imageUrl: image,
  imageAlt: z.string().max(180).default(""),
  backgroundColour: colour.default("#b9afcf"),
  textColour: colour.default("#243247"),
  ctaLabel: z.string().max(60).default(""),
  ctaHref: z
    .string()
    .regex(/^\/(?!\/)[\w/?&=.%+#-]*$/)
    .or(z.literal(""))
    .default(""),
  campaignKey: z
    .string()
    .regex(/^[a-z0-9-]*$/)
    .max(80)
    .default(""),
  titleFont: z.enum(["INTER", "BEBAS_NEUE", "CAVEAT"]).default("BEBAS_NEUE"),
  copyFont: z.enum(["INTER", "BEBAS_NEUE", "CAVEAT"]).default("CAVEAT"),
});
export const experienceSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        enabled: z.boolean().default(true),
        home: z.boolean().default(false),
        homePosition: z.number().int().min(0).max(100).default(3),
        shop: z.boolean().default(false),
        shopPosition: z
          .enum(["TOP", "BEFORE_PRODUCTS", "AFTER_PRODUCTS", "BOTTOM"])
          .default("TOP"),
        slides: z.array(slide).max(20),
      }),
    )
    .max(20)
    .default([]),
  reviewsEnabled: z.boolean().default(true),
  showExampleReviews: z.boolean().default(true),
  reviewsLimit: z.number().int().min(1).max(12).default(3),
});
export type ExperienceConfig = z.infer<typeof experienceSchema>;
export type BannerGroup = ExperienceConfig["groups"][number];
export function parseExperience(value: unknown): ExperienceConfig {
  return experienceSchema.parse(value ?? {});
}
export const getExperience = cache(async (storeId: string) => {
  const record = await db.storeExperience.findUnique({ where: { storeId } });
  return {
    configured: Boolean(record),
    config: parseExperience(record?.config),
  };
});
export function campaignAvailable(campaign: {
  active: boolean;
  awardedCount: number;
  limit: number;
  giftProductId?: string | null;
  giftProduct?: (Parameters<typeof availableGiftChoices>[0] & { status: string }) | null;
}) {
  return campaign.active && campaign.awardedCount < campaign.limit && (!campaign.giftProductId || Boolean(campaign.giftProduct?.status === "ACTIVE" && availableGiftChoices(campaign.giftProduct).length));
}
export const publicBannerGroups = cache(async (storeId: string) => {
  const [{ config }, campaigns] = await Promise.all([
    getExperience(storeId),
    db.giftCampaign.findMany({
      where: { storeId },
      include: { category: { select: { name: true, slug: true } }, giftProduct: { include: { variants: { where: { active: true } }, options: { where: { active: true, type: "COLOUR" }, take: 1, include: { values: { where: { active: true } } } } } } },
    }),
  ]);
  return config.groups
    .filter((group) => group.enabled)
    .map((group) => ({
      ...group,
      slides: group.slides.flatMap((slide) => {
        if (!slide.visible) return [];
        if (!slide.campaignKey) return [slide];
        const campaign = campaigns.find(
          (c) => c.key === slide.campaignKey && campaignAvailable(c),
        );
        if (!campaign) return [];
        const expand = (text: string) =>
          text
            .replaceAll("{limit}", String(campaign.limit))
            .replaceAll("{gift}", campaign.giftName)
            .replaceAll(
              "{category}",
              campaign.category?.name || "the eligible collection",
            );
        return [
          {
            ...slide,
            title: expand(slide.title).slice(0, 120),
            description: expand(slide.description).slice(0, 2000),
            supportingText: expand(slide.supportingText).slice(0, 400),
            ctaHref:
              slide.ctaHref ||
              (campaign.category?.slug
                ? `/shop?category=${encodeURIComponent(campaign.category.slug)}`
                : ""),
          },
        ];
      }),
    }))
    .filter((group) => group.slides.length);
});

// Existing sections become references to a shared group; the content stays in
// one place while each placement keeps its own order and section presentation.
export type ExperienceSection = {
  id: string;
  type: import("@prisma/client").LandingSectionType;
  name: string;
  visible?: boolean;
  content: import("@prisma/client").Prisma.JsonValue;
};
export async function prepareExperienceSections(
  storeId: string,
  sections: ExperienceSection[],
) {
  const { configured, config } = await getExperience(storeId);
  const groups = await publicBannerGroups(storeId);
  const reviews = config.reviewsEnabled
    ? await db.productReview.findMany({
        where: {
          storeId,
          status: "PUBLISHED",
          product: { status: "ACTIVE", shopVisible: true },
        },
        orderBy: { createdAt: "desc" },
        take: config.reviewsLimit,
        include: { product: { select: { name: true, slug: true } } },
      })
    : [];
  const referenced = new Set(
    sections
      .map((s) => (s.content as Record<string, unknown> | null)?.sharedBlockId)
      .filter(Boolean),
  );
  const result = sections.flatMap((section) => {
    const content = section.content as Record<string, unknown> | null;
    if (!content || typeof content !== "object" || Array.isArray(content))
      return [section];
    if (content.sharedBlockId) {
      const group = groups.find((g) => g.id === content.sharedBlockId);
      return group
        ? [
            {
              ...section,
              content: {
                ...content,
                layoutVariant: "KOSYKIN_PROMOTIONS",
                sharedBlockId: group.id,
              } as import("@prisma/client").Prisma.JsonValue,
            },
          ]
        : [];
    }
    if (configured && content.layoutVariant === "KOSYKIN_PROMOTIONS") return [];
    if (content.layoutVariant !== "KOSYKIN_REVIEWS") return [section];
    if (
      !config.reviewsEnabled ||
      (!reviews.length && !config.showExampleReviews)
    )
      return [];
    if (!reviews.length) return [section];
    return [
      {
        ...section,
        content: {
          ...content,
          copy: "Reviews from verified purchases.",
          items: reviews.map((review) => ({
            id: review.id,
            title: review.displayName,
            description: review.body,
            supportingText: `${review.rating}/5 · Verified purchase · ${review.product.name}`,
            ctaLabel: review.product.name,
            ctaHref: `/products/${review.product.slug}`,
            visible: true,
          })),
        } as import("@prisma/client").Prisma.JsonValue,
      },
    ];
  });
  for (const group of groups
    .filter((g) => g.home && !referenced.has(g.id))
    .sort((a, b) => b.homePosition - a.homePosition)) {
    result.splice(Math.min(group.homePosition, result.length), 0, {
      id: group.id,
      type: "CTA_BANNER",
      name: group.name,
      visible: true,
      content: { layoutVariant: "KOSYKIN_PROMOTIONS", sharedBlockId: group.id },
    });
  }
  return result;
}
