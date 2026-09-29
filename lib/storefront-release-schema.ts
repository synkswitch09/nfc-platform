import { z } from "zod";
import { isSafeStorageKey } from "@/lib/storage/keys";

// Explicit allowlists: never pass Prisma relations, IDs or operational settings from a release.
// Unknown legacy fields are stripped so v1 packages remain readable without granting write access.
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const text = z.string().max(100_000);
const integer = z.number().int().min(0).max(2_147_483_647);
const json = z.json();

export const STOREFRONT_RELEASE_KIND = "tapkin-storefront-release";
export const STOREFRONT_RELEASE_VERSION = 1;
export const MAX_RELEASE_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_RELEASE_REQUEST_BYTES = 40 * 1024 * 1024;

export const releaseStoreFields = z.object({
  displayName: text.optional(),
  legalName: text.nullable().optional(),
  logoUrl: text.nullable().optional(),
  faviconUrl: text.nullable().optional(),
  supportEmail: text.nullable().optional(),
  theme: json.optional(),
  homepage: json.optional(),
  seoTitle: text.optional(),
  seoDescription: text.optional(),
  socialImageUrl: text.nullable().optional(),
  organization: json.optional(),
  socialLinks: json.optional(),
  headerConfig: json.optional(),
  footerConfig: json.optional(),
  petProfileConfig: json.optional(),
  defaultLocale: text.optional(),
  enabledLocales: z.array(text).max(200).optional(),
});

export const releaseProductCategoryFields = z.object({
  slug: slug,
  legacySlugs: z.array(text).max(200).optional(),
  name: z.string().min(1).max(200),
  shortDescription: text.nullable().optional(),
  description: text.nullable().optional(),
  icon: text.nullable().optional(),
  imageUrl: text.nullable().optional(),
  cardTitle: text.nullable().optional(),
  cardText: text.nullable().optional(),
  cardImageUrl: text.nullable().optional(),
  cardImageAlt: text.nullable().optional(),
  heroEyebrow: text.nullable().optional(),
  heroHeadline: text.nullable().optional(),
  heroDescription: text.nullable().optional(),
  heroImageUrl: text.nullable().optional(),
  heroImageAlt: text.nullable().optional(),
  secondaryImageUrl: text.nullable().optional(),
  ctaLabel: text.nullable().optional(),
  ctaHref: text.nullable().optional(),
  secondaryCtaLabel: text.nullable().optional(),
  secondaryCtaHref: text.nullable().optional(),
  benefits: json.optional(),
  useCases: json.optional(),
  howItWorks: json.optional(),
  contentSections: json.optional(),
  faq: json.optional(),
  finalCtaEyebrow: text.nullable().optional(),
  finalCtaHeadline: text.nullable().optional(),
  finalCtaDescription: text.nullable().optional(),
  finalCtaLabel: text.nullable().optional(),
  finalCtaHref: text.nullable().optional(),
  visualTheme: z.enum(["CORAL","SKY","MIDNIGHT","VIOLET","AMBER"]).optional(),
  landingLayout: z.enum(["EDITORIAL","ASSURANCE","EXECUTIVE","MOMENTUM","JOURNEY"]).optional(),
  status: z.enum(["DRAFT","PUBLISHED","HIDDEN","ARCHIVED"]).optional(),
  sortOrder: integer.optional(),
  showOnHomepage: z.boolean().optional(),
  showInNavigation: z.boolean().optional(),
  showInShop: z.boolean().optional(),
  showLanding: z.boolean().optional(),
  seoTitle: text.nullable().optional(),
  seoDescription: text.nullable().optional(),
  ogImageUrl: text.nullable().optional(),
  canonicalUrl: text.nullable().optional(),
  indexable: z.boolean().optional(),
});

export const releaseContentPageFields = z.object({
  kind: z.enum(["HOME","CATEGORY","CAMPAIGN","COLLECTION","LEGAL"]),
  slug: slug,
  name: z.string().min(1).max(200),
  status: z.enum(["DRAFT","PUBLISHED","HIDDEN","ARCHIVED"]).optional(),
  sortOrder: integer.optional(),
  showInHeader: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  headerLabel: text.nullable().optional(),
  footerLabel: text.nullable().optional(),
  navigationOrder: integer.optional(),
  visualTheme: z.enum(["CORAL","SKY","MIDNIGHT","VIOLET","AMBER"]).optional(),
  defaultLocale: text.optional(),
  seoTitle: text.nullable().optional(),
  seoDescription: text.nullable().optional(),
  ogImageUrl: text.nullable().optional(),
  canonicalUrl: text.nullable().optional(),
  indexable: z.boolean().optional(),
});

export const releaseContentPageTranslationFields = z.object({
  locale: z.string().min(1).max(200),
  name: z.string().min(1).max(200).nullable().optional(),
  seoTitle: text.nullable().optional(),
  seoDescription: text.nullable().optional(),
});

export const releaseLandingPageSectionFields = z.object({
  type: z.enum(["HERO","FEATURE_BADGES","BENEFITS","STEPS","PRODUCT_SHOWCASE","FEATURE_LIST","MEDIA_CONTENT","STORY_PROCESS","FAQ","CTA_BANNER","PRODUCT_GRID","CATEGORY_GRID","RICH_TEXT","TRUST_STRIP","STATS"]),
  name: z.string().min(1).max(200),
  visible: z.boolean().optional(),
  sortOrder: integer.optional(),
  content: json.optional(),
});

export const releaseLandingPageSectionTranslationFields = z.object({
  locale: z.string().min(1).max(200),
  content: json.optional(),
});

export const releaseProductFields = z.object({
  slug: slug,
  name: z.string().min(1).max(200),
  description: text,
  shortDescription: text.nullable().optional(),
  fullDescription: text.nullable().optional(),
  type: z.enum(["PET","CHILD","EMERGENCY","SOCIAL","BUSINESS","LUGGAGE","REVIEW","CUSTOM","ACCESSORY"]),
  status: z.enum(["DRAFT","ACTIVE","HIDDEN","OUT_OF_STOCK","ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  shopVisible: z.boolean().optional(),
  seoTitle: text.nullable().optional(),
  seoDescription: text.nullable().optional(),
  ogImageUrl: text.nullable().optional(),
  canonicalUrl: text.nullable().optional(),
  indexable: z.boolean().optional(),
  brand: text,
  gstInclusive: z.boolean().optional(),
  personalisationMode: z.enum(["NONE","OPTIONAL","REQUIRED"]).optional(),
  weightGrams: integer.nullable().optional(),
  lengthMm: integer.nullable().optional(),
  widthMm: integer.nullable().optional(),
  heightMm: integer.nullable().optional(),
  shipsSeparately: z.boolean().optional(),
  specialHandling: text.nullable().optional(),
  countryOfOrigin: text.nullable().optional(),
  customsDescription: text.nullable().optional(),
  hsCode: text.nullable().optional(),
  customsValueCents: integer.nullable().optional(),
  dutiesHandling: z.enum(["UNDETERMINED","RECIPIENT_PAYS","SENDER_PAYS"]).optional(),
  restrictedItem: z.boolean().optional(),
});

export const releaseProductVariantFields = z.object({
  sku: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  colour: text.nullable().optional(),
  size: text.nullable().optional(),
  material: text.nullable().optional(),
  priceCents: integer,
  compareAtPriceCents: integer.nullable().optional(),
  costCents: integer.nullable().optional(),
  trackInventory: z.boolean().optional(),
  lowStockThreshold: integer.optional(),
  backorderPolicy: z.enum(["DENY","ALLOW"]).optional(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  optionSelection: z.record(z.string(), z.string()).optional(),
  weightGrams: integer.nullable().optional(),
  lengthMm: integer.nullable().optional(),
  widthMm: integer.nullable().optional(),
  heightMm: integer.nullable().optional(),
});

export const releaseProductOptionFields = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(200),
  type: z.enum(["SHORT_TEXT","LONG_TEXT","SELECT","RADIO","CHECKBOX","COLOUR","IMAGE"]),
  required: z.boolean().optional(),
  maxLength: integer.nullable().optional(),
  priceDeltaCents: z.number().int().min(-100_000_000).max(100_000_000).optional(),
  sortOrder: integer.optional(),
  active: z.boolean().optional(),
  helpText: text.nullable().optional(),
});

export const releaseProductOptionValueFields = z.object({
  label: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  priceDeltaCents: z.number().int().min(-100_000_000).max(100_000_000).optional(),
  sortOrder: integer.optional(),
  active: z.boolean().optional(),
  swatchHex: text.nullable().optional(),
  swatchHexSecondary: text.nullable().optional(),
  swatchImageUrl: text.nullable().optional(),
});

export const releaseProductImageFields = z.object({
  storageKey: z.string().refine(isSafeStorageKey, "Invalid storage key"),
  url: text,
  altText: text,
  mimeType: text,
  byteSize: integer,
  width: integer.nullable().optional(),
  height: integer.nullable().optional(),
  sortOrder: integer.optional(),
  isPrimary: z.boolean().optional(),
});

export const releaseCategoryImageFields = z.object({
  storageKey: z.string().refine(isSafeStorageKey, "Invalid storage key"),
  url: text,
  altText: text.nullable().optional(),
  purpose: text.optional(),
  mimeType: text,
  byteSize: integer,
  width: integer,
  height: integer,
});

const section = releaseLandingPageSectionFields.extend({
  translations: z.array(releaseLandingPageSectionTranslationFields).max(100).default([]),
});
const page = releaseContentPageFields.extend({
  sections: z.array(section).max(200).default([]),
  translations: z.array(releaseContentPageTranslationFields).max(100).default([]),
});
const category = releaseProductCategoryFields.extend({ page: page.nullable().optional() });
const image = releaseProductImageFields.extend({
  optionValue: z.object({ code: text, value: text }).nullable().optional(),
});
const product = releaseProductFields.extend({
  categorySlug: slug.nullable().optional(),
  variants: z.array(releaseProductVariantFields.extend({ imageStorageKey: text.nullable().optional() })).max(2_000).default([]),
  options: z.array(releaseProductOptionFields.extend({ values: z.array(releaseProductOptionValueFields).max(500).default([]) })).max(100).default([]),
  images: z.array(image).max(500).default([]),
});

export const storefrontReleaseSchema = z.object({
  kind: z.literal(STOREFRONT_RELEASE_KIND),
  version: z.literal(STOREFRONT_RELEASE_VERSION),
  generatedAt: z.string().datetime(),
  source: z.object({ storeSlug: slug }),
  store: releaseStoreFields,
  categories: z.array(category).max(200),
  pages: z.array(page).max(200),
  products: z.array(product).max(2_000),
  categoryImages: z.array(releaseCategoryImageFields.extend({
    categorySlug: slug.nullable().optional(), pageSlug: slug.nullable().optional(),
  })).max(5_000),
  assets: z.array(z.object({
    storageKey: z.string().refine(isSafeStorageKey, "Invalid media storage key"),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    byteSize: z.number().int().min(1).max(5 * 1024 * 1024),
    width: z.number().int().min(1).max(10_000),
    height: z.number().int().min(1).max(10_000),
    bytesBase64: z.string().min(1).max(4 * Math.ceil(5 * 1024 * 1024 / 3)),
  })).max(1_000),
});

export type StorefrontRelease = z.infer<typeof storefrontReleaseSchema>;
