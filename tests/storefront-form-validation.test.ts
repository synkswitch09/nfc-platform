import { expect, it } from "vitest";
import { footerConfigSchema, headerConfigSchema } from "@/lib/site-chrome";
import { typographyFromForm, storefrontValidationIssues } from "@/lib/storefront-form-validation";

it("preserves hidden inherited typography instead of serialising null as zero", () => {
  const footer = footerConfigSchema.parse({});
  const typography = typographyFromForm(new FormData(), "taglineTypography", footer.taglineTypography);
  expect(typography.sizePx).toBeNull();
  expect(footerConfigSchema.safeParse({ ...footer, taglineTypography: typography }).success).toBe(true);
  expect(typographyFromForm(new FormData(), "hidden", { ...typography, sizePx: 24, lineHeight: 1.5, letterSpacingEm: .1 })).toEqual({ ...typography, sizePx: 24, lineHeight: 1.5, letterSpacingEm: .1 });
});

it("clears visible overrides to inherit while preserving valid numeric input", () => {
  const fallback = footerConfigSchema.parse({}).support.headlineTypography;
  const form = new FormData();
  form.set("heading-size", "");
  form.set("heading-lineHeight", "");
  form.set("heading-letterSpacingEm", "0");
  expect(typographyFromForm(form, "heading", { ...fallback, sizePx: 20, lineHeight: 1.4 })).toEqual({ ...fallback, sizePx: null, lineHeight: undefined, letterSpacingEm: 0 });
  form.set("heading-size", "32");
  expect(typographyFromForm(form, "heading", fallback).sizePx).toBe(32);
});

it("returns actionable messages and exact control names for every invalid footer field", () => {
  const parsed = footerConfigSchema.safeParse({ textSizePx: 0, support: { headlineTypography: { sizePx: 7 }, instagramHref: "http://example.com" }, socialProfiles: [{ id: crypto.randomUUID(), label: "Instagram", href: "bad url", iconUrl: "", visible: true, order: 0 }] });
  expect(parsed.success).toBe(false);
  if (parsed.success) return;
  const issues = storefrontValidationIssues(parsed.error);
  expect(issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "textSizePx", message: expect.stringContaining("at least 8") }),
    expect.objectContaining({ field: "supportHeadlineTypography-size", message: expect.stringContaining("at least 8") }),
    expect.objectContaining({ field: "supportInstagramHref", message: expect.stringContaining("https://") }),
    expect.objectContaining({ field: "socialProfiles-0-href", message: expect.stringContaining("https://") }),
  ]));
  expect(issues.some(issue => issue.message.includes("Too small"))).toBe(false);
});

it("maps header typography validation to its size control", () => {
  const parsed = headerConfigSchema.safeParse({ brandTypography: { sizePx: 100 } });
  expect(parsed.success).toBe(false);
  if (!parsed.success) expect(storefrontValidationIssues(parsed.error)).toEqual([expect.objectContaining({ field: "brandTypography-size", message: expect.stringContaining("no greater than 96") })]);
});
