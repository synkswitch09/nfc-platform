import { z } from "zod";

const optionalUrl = z.string().trim().url().refine(value => /^https?:\/\//i.test(value)).or(z.literal("")).optional();
const optionalInternalPath = z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+-]*$/, "Use a safe internal path beginning with /").or(z.literal("")).optional();
const optionValueSchema = z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(80), priceDeltaCents: z.number().int().min(0).max(100_000), active: z.boolean().default(true) });
const optionSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), type: z.enum(["SHORT_TEXT", "LONG_TEXT", "SELECT", "RADIO", "CHECKBOX", "COLOUR", "IMAGE"]), required: z.boolean().default(false), maxLength: z.number().int().min(1).max(2_000).nullable().optional(), priceDeltaCents: z.number().int().min(0).max(100_000), helpText: z.string().trim().max(200).nullable().optional(), active: z.boolean().default(true), values: z.array(optionValueSchema).max(50).default([]) });
const variantSchema = z.object({ id: z.string().uuid().optional(), sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]{2,49}$/), name: z.string().trim().min(1).max(100), colour: z.string().trim().max(50).nullable().optional(), size: z.string().trim().max(50).nullable().optional(), material: z.string().trim().max(50).nullable().optional(), priceCents: z.number().int().min(0).max(100_000_000), compareAtPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(), costCents: z.number().int().min(0).max(100_000_000).nullable().optional(), inventory: z.number().int().min(0).max(1_000_000), trackInventory: z.boolean().default(true), lowStockThreshold: z.number().int().min(0).max(100_000), backorderPolicy: z.enum(["DENY", "ALLOW"]), active: z.boolean().default(true) });

export const adminProductSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  description: z.string().trim().min(10).max(500),
  fullDescription: z.string().trim().max(20_000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  type: z.enum(["PET", "CHILD", "EMERGENCY", "SOCIAL", "BUSINESS", "LUGGAGE", "REVIEW", "CUSTOM", "ACCESSORY"]),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "OUT_OF_STOCK", "ARCHIVED"]),
  featured: z.boolean().default(false),
  shopVisible: z.boolean().default(true),
  brand: z.string().trim().min(1).max(80).default("Tapkin"),
  gstInclusive: z.boolean().default(true),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  ogImageUrl: optionalUrl,
  canonicalUrl: optionalUrl,
  indexable: z.boolean().default(true),
  variants: z.array(variantSchema).min(1).max(50),
  options: z.array(optionSchema).max(20),
}).superRefine((value, context) => {
  if (new Set(value.variants.map(variant => variant.sku)).size !== value.variants.length) context.addIssue({ code: "custom", message: "Variant SKUs must be unique", path: ["variants"] });
  if (new Set(value.options.map(option => option.code)).size !== value.options.length) context.addIssue({ code: "custom", message: "Personalisation codes must be unique", path: ["options"] });
});

export const adminCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  shortDescription: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  icon: z.string().trim().regex(/^[a-z][a-z0-9-]{1,39}$/).nullable().optional(),
  imageUrl: optionalUrl,
  cardTitle: z.string().trim().max(100).nullable().optional(),
  cardText: z.string().trim().max(240).nullable().optional(),
  cardImageUrl: optionalUrl,
  heroEyebrow: z.string().trim().max(80).nullable().optional(),
  heroHeadline: z.string().trim().max(160).nullable().optional(),
  heroDescription: z.string().trim().max(1_000).nullable().optional(),
  heroImageUrl: optionalUrl,
  secondaryImageUrl: optionalUrl,
  ctaLabel: z.string().trim().max(60).nullable().optional(),
  ctaHref: optionalInternalPath,
  secondaryCtaLabel: z.string().trim().max(60).nullable().optional(),
  secondaryCtaHref: optionalInternalPath,
  sortOrder: z.number().int().min(0).max(10_000),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
  showOnHomepage: z.boolean(),
  showInNavigation: z.boolean(),
  showInShop: z.boolean(),
  showLanding: z.boolean(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  ogImageUrl: optionalUrl,
  canonicalUrl: optionalUrl,
  indexable: z.boolean(),
  benefits: z.array(z.object({ icon: z.string().trim().max(40), title: z.string().trim().min(2).max(100), description: z.string().trim().min(5).max(500), order: z.number().int().min(0).max(100), visible: z.boolean() })).max(12).default([]),
  howItWorks: z.array(z.object({ title: z.string().trim().min(2).max(100), description: z.string().trim().min(5).max(500), imageUrl: optionalUrl, ctaLabel: z.string().trim().max(60).nullable().optional(), ctaHref: optionalInternalPath, order: z.number().int().min(0).max(100), visible: z.boolean() })).max(10).default([]),
  contentSections: z.array(z.object({ layout: z.enum(["IMAGE_LEFT", "IMAGE_RIGHT", "TEXT_ONLY"]), eyebrow: z.string().trim().max(80).nullable().optional(), heading: z.string().trim().min(2).max(160), copy: z.string().trim().min(10).max(2_000), bulletPoints: z.array(z.string().trim().min(2).max(200)).max(10).default([]), imageUrl: optionalUrl, ctaLabel: z.string().trim().max(60).nullable().optional(), ctaHref: optionalInternalPath, order: z.number().int().min(0).max(100), visible: z.boolean() })).max(12).default([]),
  faq: z.array(z.object({ question: z.string().trim().min(5).max(180), answer: z.string().trim().min(10).max(1_000), order: z.number().int().min(0).max(100), enabled: z.boolean() })).max(20).default([]),
});

export const activationRegenerationSchema = z.object({
  reason: z.enum(["CUSTOMER_LOST_CODE", "REPLACEMENT", "SUPPORT_REQUEST", "OTHER"]),
  note: z.string().trim().min(5).max(300),
  confirmedIdentity: z.literal(true),
});

export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(300),
});
