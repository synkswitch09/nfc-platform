import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";

const internalHref = z
  .string()
  .trim()
  .regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+#-]*$/);
const httpsHref = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"));
const linkHref = internalHref.or(httpsHref);
const optionalImage = z
  .string()
  .trim()
  .refine(isSafeImageSource)
  .or(z.literal(""));
const optionalColour = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i)
  .or(z.literal(""));
const navLinkSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  label: z.string().trim().min(1).max(40),
  href: internalHref,
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(100).default(30),
  audience: z.enum(["ALL", "GUEST", "AUTHENTICATED"]).default("ALL"),
});

export const headerConfigSchema = z.object({
  logoUrl: optionalImage.default(""),
  homeLabel: z.string().trim().min(1).max(40).default("Home"),
  faqLabel: z.string().trim().min(1).max(40).default("FAQs"),
  faqHref: internalHref.default("/faq"),
  categoriesLabel: z.string().trim().min(1).max(40).default("Categories"),
  shopHref: internalHref.default("/shop"),
  signInHref: internalHref.default("/login"),
  accountHref: internalHref.default("/dashboard"),
  shopLabel: z.string().trim().min(1).max(40).default("Shop"),
  signInLabel: z.string().trim().min(1).max(40).default("Sign in"),
  accountLabel: z.string().trim().min(1).max(40).default("My Products"),
  showHome: z.boolean().default(true),
  showFaq: z.boolean().default(true),
  showCart: z.boolean().default(true),
  showCategories: z.boolean().default(true),
  showLanguage: z.boolean().default(true),
  homeOrder: z.number().int().min(0).max(100).default(10),
  categoriesOrder: z.number().int().min(0).max(100).default(20),
  faqOrder: z.number().int().min(0).max(100).default(40),
  cartOrder: z.number().int().min(0).max(100).default(50),
  customLinks: z.array(navLinkSchema).max(12).default([]),
  backgroundColour: optionalColour.default(""),
  textColour: optionalColour.default(""),
  activeColour: optionalColour.default(""),
  shopBackgroundColour: optionalColour.default(""),
  shopTextColour: optionalColour.default(""),
  accountBackgroundColour: optionalColour.default(""),
  accountTextColour: optionalColour.default(""),
  accountBorderColour: optionalColour.default(""),
});

const footerLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: linkHref,
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(100).default(0),
});

export const footerConfigSchema = z.object({
  logoUrl: optionalImage.default(""),
  copyright: z.string().trim().max(160).default(""),
  tagline: z
    .string()
    .trim()
    .max(240)
    .default("Thoughtful products, designed and made in Australia."),
  termsLabel: z.string().trim().min(1).max(60).default("Terms of Service"),
  privacyLabel: z.string().trim().min(1).max(60).default("Privacy Policy"),
  showTerms: z.boolean().default(true),
  showPrivacy: z.boolean().default(true),
  customLinks: z.array(footerLinkSchema).max(12).default([]),
  backgroundColour: optionalColour.default(""),
  textColour: optionalColour.default(""),
  linkColour: optionalColour.default(""),
  borderColour: optionalColour.default(""),
});

export type HeaderConfig = z.infer<typeof headerConfigSchema>;
export type FooterConfig = z.infer<typeof footerConfigSchema>;

export function parseHeaderConfig(value: unknown): HeaderConfig {
  return headerConfigSchema.parse(value);
}

export function parseFooterConfig(value: unknown): FooterConfig {
  return footerConfigSchema.parse(value);
}

export function parseFooterLinks(value: string) {
  return value
    .split("\n")
    .map((line, order) => {
      const [label = "", href = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { label, href, visible: true, order };
    })
    .filter((link) => link.label && link.href);
}

export function isNavigationActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const path = href.split(/[?#]/, 1)[0];
  return (
    Boolean(path) && (pathname === path || pathname.startsWith(`${path}/`))
  );
}
