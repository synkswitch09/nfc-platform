import { ContentPageKind, CategoryStatus } from "@prisma/client";
import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";

const reservedSlugs = new Set(["activate", "admin", "api", "cart", "categories", "checkout", "claim-order", "dashboard", "forgot-password", "guides", "login", "order", "products", "register", "reset-password", "shop", "t", "verify-email"]);
const optionalImage = z.string().trim().refine(isSafeImageSource, "Use an uploaded image or an HTTP(S) image URL").or(z.literal(""));
const optionalCanonical = z.string().trim().url().refine(value => value.startsWith("https://"), "Use an HTTPS canonical URL").or(z.literal(""));

export const contentPageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).refine(value => !reservedSlugs.has(value), "That slug is reserved by the application"),
  kind: z.nativeEnum(ContentPageKind).refine(kind => kind !== ContentPageKind.CATEGORY, "Category pages are managed from Categories"),
  status: z.nativeEnum(CategoryStatus),
  sortOrder: z.number().int().min(0).max(10_000),
  seoTitle: z.string().trim().max(70).or(z.literal("")),
  seoDescription: z.string().trim().max(170).or(z.literal("")),
  ogImageUrl: optionalImage,
  canonicalUrl: optionalCanonical,
  indexable: z.boolean(),
});

export type ContentPageInput = z.infer<typeof contentPageSchema>;
