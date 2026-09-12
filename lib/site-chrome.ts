import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";

const internalHref = z.string().trim().regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+#-]*$/);
const httpsHref = z.string().trim().url().refine(value => value.startsWith("https://"));
const linkHref = internalHref.or(httpsHref);
const optionalImage = z.string().trim().refine(isSafeImageSource).or(z.literal(""));

export const headerConfigSchema = z.object({
  logoUrl: optionalImage.default(""),
  homeLabel: z.string().trim().min(1).max(40).default("Home"),
  faqLabel: z.string().trim().min(1).max(40).default("FAQs"),
  faqHref: internalHref.default("/#faqs"),
  shopLabel: z.string().trim().min(1).max(40).default("Shop"),
  signInLabel: z.string().trim().min(1).max(40).default("Sign in"),
  accountLabel: z.string().trim().min(1).max(40).default("My Products"),
  showHome: z.boolean().default(true),
  showFaq: z.boolean().default(true),
  showCart: z.boolean().default(true),
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
  tagline: z.string().trim().max(240).default("Thoughtful products, designed and made in Australia."),
  termsLabel: z.string().trim().min(1).max(60).default("Terms of Service"),
  privacyLabel: z.string().trim().min(1).max(60).default("Privacy Policy"),
  showTerms: z.boolean().default(true),
  showPrivacy: z.boolean().default(true),
  customLinks: z.array(footerLinkSchema).max(12).default([]),
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
  return value.split("\n").map((line, order) => {
    const [label = "", href = ""] = line.split("|").map(part => part.trim());
    return { label, href, visible: true, order };
  }).filter(link => link.label && link.href);
}

export function isNavigationActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const path = href.split(/[?#]/, 1)[0];
  return Boolean(path) && (pathname === path || pathname.startsWith(`${path}/`));
}
