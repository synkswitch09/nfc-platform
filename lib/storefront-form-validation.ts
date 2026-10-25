import type { z } from "zod";
import type { TypographyOverride } from "@/lib/typography";

// An absent control belongs to a hidden section: preserve its stored value.
// In particular, Number(null) would turn an inherited font size into 0.
export function typographyFromForm(form: FormData, prefix: string, fallback: TypographyOverride): TypographyOverride {
  const number = (suffix: string, previous: number | null | undefined) => {
    const value = form.get(`${prefix}-${suffix}`);
    return value === null ? previous : value === "" ? undefined : Number(value);
  };
  return {
    family: String(form.get(`${prefix}-family`) ?? fallback.family) as TypographyOverride["family"],
    weight: String(form.get(`${prefix}-weight`) ?? fallback.weight) as TypographyOverride["weight"],
    italic: String(form.get(`${prefix}-italic`) ?? fallback.italic) as TypographyOverride["italic"],
    sizePx: number("size", fallback.sizePx) ?? null,
    lineHeight: number("lineHeight", fallback.lineHeight) ?? undefined,
    letterSpacingEm: number("letterSpacingEm", fallback.letterSpacingEm) ?? undefined,
  };
}

export type StorefrontFieldIssue = { path: string; field: string; message: string };

export function storefrontFieldName(path: PropertyKey[]): string {
  const parts = path.map(String).filter(part => part !== "config");
  if (parts[0] === "socialLinks") return `legacy-${parts[1]}`;
  if (parts[0] === "socialProfiles") return `socialProfiles-${parts[1]}-${parts[2]}`;
  if (parts[0] === "iconUrls") return `icon-${parts[1]}`;
  if (parts[0] === "customLinks") return "customFooterLinks";
  if (parts[0] === "policyLinks") return "policyLinks";
  const support = parts[0] === "support";
  if (support) parts.shift();
  const prefix = support ? `support${parts[0]?.[0]?.toUpperCase()}${parts[0]?.slice(1)}` : parts[0];
  if (parts[0]?.endsWith("Typography")) return `${prefix}-${parts[1] === "sizePx" ? "size" : parts[1]}`;
  return prefix ?? "";
}

function fieldLabel(path: PropertyKey[]): string {
  const words = path.map(String).filter(part => part !== "config").map(part => /^\d+$/.test(part) ? String(Number(part) + 1) : part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/size Px/g, "size (px)").replace(/Href/g, "URL"));
  return words.join(" → ").replace(/^./, letter => letter.toUpperCase());
}

export function storefrontValidationIssues(error: z.ZodError): StorefrontFieldIssue[] {
  return error.issues.map(issue => {
    const label = fieldLabel(issue.path) || "Storefront settings";
    let correction = "Check this value and try again.";
    if (issue.code === "too_small") correction = issue.origin === "number"
      ? `Enter a value of at least ${issue.minimum}.`
      : `Enter at least ${issue.minimum} characters.`;
    else if (issue.code === "too_big") correction = issue.origin === "number"
      ? `Enter a value no greater than ${issue.maximum}.`
      : `Use no more than ${issue.maximum} characters.`;
    else if (issue.path.at(-1) === "href" || issue.path.at(-1) === "instagramHref") correction = "Enter a full https:// URL, or leave the optional URL blank.";
    else if (String(issue.path.at(-1)).endsWith("Colour")) correction = "Use a six-digit colour such as #243247, or leave it blank to inherit.";
    else if (issue.code === "invalid_type" && issue.expected === "number") correction = "Enter a valid number.";
    else if (issue.code === "invalid_value") correction = "Select one of the available options.";
    return { path: issue.path.join("."), field: storefrontFieldName(issue.path), message: `${label}: ${correction}` };
  });
}
