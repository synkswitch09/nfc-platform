import { z } from "zod";
import { isSafeImageSource } from "@/lib/image-source";
import { typographyOverrideSchema } from "@/lib/typography";

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
const headerFontFamily = z
  .enum(["INHERIT", "INTER", "SANS", "SERIF", "MONO"])
  .default("INHERIT");
const headerTextSize = z.enum(["SMALL", "STANDARD", "LARGE"]).default("STANDARD");
const textWeight = z.enum(["THIN", "LIGHT", "REGULAR", "MEDIUM", "BOLD", "BLACK"]).default("REGULAR");
const individualTypography = typographyOverrideSchema.default({
  family: "INHERIT",
  weight: "INHERIT",
  italic: "INHERIT",
  sizePx: null,
});
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
  fontFamily: headerFontFamily,
  textSize: headerTextSize,
  textSizePx: z.number().int().min(8).max(96).default(15),
  textWeight,
  textItalic: z.boolean().default(false),
  brandTypography: individualTypography,
  homeTypography: individualTypography,
  categoriesTypography: individualTypography,
  customLinksTypography: individualTypography,
  faqTypography: individualTypography,
  cartTypography: individualTypography,
  shopTypography: individualTypography,
  signInTypography: individualTypography,
  accountTypography: individualTypography,
  shopBackgroundColour: optionalColour.default(""),
  shopTextColour: optionalColour.default(""),
  shopBorderColour: optionalColour.default(""),
  accountBackgroundColour: optionalColour.default(""),
  accountTextColour: optionalColour.default(""),
  accountBorderColour: optionalColour.default(""),
});

const footerLinkSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
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
  fontFamily: headerFontFamily,
  textSizePx: z.number().int().min(8).max(96).default(15),
  textWeight,
  textItalic: z.boolean().default(false),
  taglineTypography: individualTypography,
  copyrightTypography: individualTypography,
  customLinksTypography: individualTypography,
  termsTypography: individualTypography,
  privacyTypography: individualTypography,
  socialIcons: z
    .object({
      instagram: optionalImage.default(""),
      facebook: optionalImage.default(""),
      tiktok: optionalImage.default(""),
      linkedin: optionalImage.default(""),
    })
    .default({ instagram: "", facebook: "", tiktok: "", linkedin: "" }),
});

export type HeaderConfig = z.infer<typeof headerConfigSchema>;
export type FooterConfig = z.infer<typeof footerConfigSchema>;

export function parseHeaderConfig(value: unknown): HeaderConfig {
  const config: Record<string, unknown> | null =
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : null;
  // Configurations created before the standalone FAQ page pointed to a Home
  // anchor. Keep those Stores working without requiring a manual data edit.
  if (config && config.faqHref === "/#faqs") config.faqHref = "/faq";
  return headerConfigSchema.parse(config ?? value);
}

export function parseFooterConfig(value: unknown): FooterConfig {
  return footerConfigSchema.parse(value);
}

export function parseFooterLinks(
  value: string,
  existing: FooterConfig["customLinks"] = [],
) {
  const available = [...existing].sort((a, b) => a.order - b.order);
  const used = new Set<string>();
  return value
    .split("\n")
    .map((line, order) => {
      const [label = "", href = ""] = line
        .split("|")
        .map((part) => part.trim());
      const exact = available.find(
        (link) =>
          !used.has(link.id) && link.label === label && link.href === href,
      );
      const row = available.find((link) => !used.has(link.id));
      const id = exact?.id ?? row?.id ?? crypto.randomUUID();
      used.add(id);
      return { id, label, href, visible: true, order };
    })
    .filter((link) => link.label && link.href);
}

export function parseHeaderLinks(
  value: string,
  existing: HeaderConfig["customLinks"] = [],
) {
  const available = [...existing].sort((a, b) => a.order - b.order);
  const used = new Set<string>();
  return value
    .split("\n")
    .map((line, order) => {
      const [label = "", href = "", audience = "ALL"] = line
        .split("|")
        .map((part) => part.trim());
      const exact = available.find(
        (link) =>
          !used.has(link.id) && link.label === label && link.href === href,
      );
      const row = available.find((link) => !used.has(link.id));
      const id = exact?.id ?? row?.id ?? crypto.randomUUID();
      used.add(id);
      return {
        id,
        label,
        href,
        visible: true,
        order: 30 + order,
        audience: ["ALL", "GUEST", "AUTHENTICATED"].includes(
          audience.toUpperCase(),
        )
          ? (audience.toUpperCase() as "ALL" | "GUEST" | "AUTHENTICATED")
          : ("ALL" as const),
      };
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
