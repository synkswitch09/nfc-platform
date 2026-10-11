import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kosykinContent } from "@/lib/kosykin-content";
import { validateLandingSections, modularFaq } from "@/lib/landing-sections";
import { faqQuestionKey } from "@/lib/faq-proposals";
import { businessAbnSchema, validAbn } from "@/lib/business-identity";
import type { Prisma } from "@prisma/client";
import { uniqueFaqSections } from "@/lib/public-faq";

describe("Kosykin CMS editorial release", () => {
  it("can save every topic through the existing structured CMS editor", () => {
    for (const page of kosykinContent) {
      expect(page.description.length).toBeLessThanOrEqual(170);
      const saved = validateLandingSections(page.sections.map(section => ({ ...section, visible: true })));
      expect(saved).toHaveLength(page.sections.length);
    }
  });
  it("supplies useful unique questions without exceeding CMS topic limits", () => {
    const page = kosykinContent.find(page => page.slug === "faq")!;
    const sections = validateLandingSections(page.sections.map(section => ({ ...section, visible: true })));
    const items = modularFaq(sections.map(section => ({ ...section, content: section.content as Prisma.JsonObject })));
    expect(items.length).toBeGreaterThanOrEqual(80);
    expect(new Set(items.map(item => faqQuestionKey(item.question))).size).toBe(items.length);
    expect(items.some(item => /food contact/i.test(item.question))).toBe(true);
    expect(items.some(item => /ChatGPT/.test(item.question))).toBe(true);
  });
  it("ships the same authored content in the data migration", () => {
    const sql = readFileSync("prisma/migrations/20261014000000_kosykin_policies_faq/migration.sql", "utf8");
    const shipped = JSON.parse(sql.split("$content$")[1]);
    expect(shipped.map((page: {slug: string}) => page.slug)).toEqual(kosykinContent.map(page => page.slug));
    for (const [index, page] of kosykinContent.entries()) {
      expect(shipped[index].sections.map((section: {content: Record<string,unknown>}) => section.content.copy)).toEqual(page.sections.map(section => section.content.copy));
      expect(shipped[index].sections.flatMap((section: {content: {items?: {question: string; answer: string}[]}}) => section.content.items?.map(item => [item.question, item.answer]) ?? [])).toEqual(page.sections.flatMap(section => (section.content.items as {question: string; answer: string}[] | undefined)?.map(item => [item.question, item.answer]) ?? []));
    }
  });
});
describe("Public Australian seller identity", () => {
  it("validates an ABN checksum and normalises human-readable spaces", () => {
    expect(validAbn("84884117384")).toBe(true);
    expect(businessAbnSchema.parse("84 884 117 384")).toBe("84884117384");
    expect(businessAbnSchema.safeParse("84884117385").success).toBe(false);
    expect(businessAbnSchema.parse("")).toBe("");
    expect(validAbn("11111111111")).toBe(false);
  });
});
it("shows one category-priority answer and keeps hidden questions out of JSON-LD", () => {
  const section = (question: string, answer: string, visible = true) => ({ type: "FAQ" as const, visible: true, content: { items: [{ question, answer, visible }] } });
  const sections = uniqueFaqSections([
    section("Will it fit my phone?", "Category-specific dimensions."),
    section("WILL it fit my phone ?", "Generic answer should not replace the category."),
    section("What is hidden?", "This answer is hidden.", false),
    section("What is hidden?", "This published answer is visible."),
  ]);
  expect(modularFaq(sections)).toEqual([
    { question: "Will it fit my phone?", answer: "Category-specific dimensions." },
    { question: "What is hidden?", answer: "This published answer is visible." },
  ]);
});
