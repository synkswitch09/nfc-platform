import { z } from "zod";
const colour = z.string().regex(/^#[\da-f]{6}$/i).or(z.literal("")).default("");
/** Shared by standalone CMS promotions and shared Home/Shop banners. */
export const promotionActionFields = {
  ctaVisible: z.boolean().default(true),
  ctaBackground: colour,
  ctaTextColour: colour,
  ctaBorderColour: colour,
  ctaPositionX: z.number().min(5).max(95).default(72.5),
  ctaPositionY: z.number().min(5).max(95).default(70),
};
export type PromotionAction = {
  ctaVisible?: boolean;
  ctaBackground?: string;
  ctaTextColour?: string;
  ctaBorderColour?: string;
  ctaPositionX?: number;
  ctaPositionY?: number;
};
