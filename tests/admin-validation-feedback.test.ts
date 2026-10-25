import { expect, it } from "vitest";
import { z } from "zod";
import { validationIssues } from "@/lib/admin-validation-feedback";
import { blankLandingSection, validateLandingSections } from "@/lib/landing-sections";
import { footerConfigSchema } from "@/lib/site-chrome";
import { integrationConfigSchema } from "@/lib/integration-config";

it("reports all invalid fields with full nested paths and corrections without input values", () => {
  const parsed = z.object({ groups: z.array(z.object({ title: z.string().min(3), limit: z.number().max(50), email: z.email() })) }).safeParse({ groups: [{ title: "x", limit: 51, email: "private-invalid" }] });
  expect(parsed.success).toBe(false);
  if (parsed.success) return;
  const issues = validationIssues(parsed.error);
  expect(issues.map(issue => issue.path)).toEqual(["groups.0.title", "groups.0.limit", "groups.0.email"]);
  expect(issues[0].message).toContain("at least 3 characters");
  expect(issues[1].message).toContain("no more than 50");
  expect(issues[2].message).toContain("valid email address");
  expect(JSON.stringify(issues)).not.toContain("private-invalid");
});

it("accepts optional empty footer overrides and disabled integration identifiers", () => {
  const footer = footerConfigSchema.parse({});
  expect(footerConfigSchema.safeParse(JSON.parse(JSON.stringify(footer))).success).toBe(true);
  expect(integrationConfigSchema.safeParse({ ga4MeasurementId: "", clarityProjectId: "", metaPixelId: "", metaCatalogId: "" }).success).toBe(true);
});

it("keeps every landing row index and field when multiple sections fail", () => {
  const first = blankLandingSection("CTA_BANNER");
  const second = blankLandingSection("CTA_BANNER");
  first.content.headlineTypography = { sizePx: 0 };
  second.content.headlineTypography = { sizePx: 100 };
  try {
    validateLandingSections([first, second]);
    throw new Error("Expected invalid typography");
  } catch (error) {
    expect(error).toBeInstanceOf(z.ZodError);
    const issues = validationIssues(error as z.ZodError);
    expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining(["0.content.headlineTypography.sizePx", "1.content.headlineTypography.sizePx"]));
  }
});
it("explains formats and preserves explicit domain-specific corrections", () => {
  const parsed = z.object({ accentColour: z.string().regex(/^#[0-9a-f]{6}$/i), hsCode: z.string().regex(/^[0-9]{4,10}$/, "Use a 4–10 digit HS code") }).safeParse({ accentColour: "pink", hsCode: "x" });
  if (parsed.success) throw new Error("Expected invalid formats");
  const issues = validationIssues(parsed.error);
  expect(issues[0].message).toContain("#243247");
  expect(issues[1].message).toContain("4–10 digit HS code");
});
