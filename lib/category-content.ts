import { z } from "zod";

const benefitSchema = z.object({ icon: z.string(), title: z.string(), description: z.string(), order: z.number(), visible: z.boolean() });
const stepSchema = z.object({ title: z.string(), description: z.string(), imageUrl: z.string().optional().nullable(), ctaLabel: z.string().optional().nullable(), ctaHref: z.string().optional().nullable(), order: z.number(), visible: z.boolean() });
const sectionSchema = z.object({ layout: z.enum(["IMAGE_LEFT", "IMAGE_RIGHT", "TEXT_ONLY"]), eyebrow: z.string().optional().nullable(), heading: z.string(), copy: z.string(), bulletPoints: z.array(z.string()).default([]), imageUrl: z.string().optional().nullable(), ctaLabel: z.string().optional().nullable(), ctaHref: z.string().optional().nullable(), order: z.number(), visible: z.boolean() });
const faqSchema = z.object({ question: z.string(), answer: z.string(), order: z.number().default(0), enabled: z.boolean().default(true) });

function parseList<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = z.array(schema).safeParse(value);
  return parsed.success ? parsed.data.sort((a, b) => (a as { order: number }).order - (b as { order: number }).order) : [];
}

export const allCategoryBenefits = (value: unknown) => parseList(benefitSchema, value);
export const allCategorySteps = (value: unknown) => parseList(stepSchema, value);
export const allCategorySections = (value: unknown) => parseList(sectionSchema, value);
export const allCategoryFaq = (value: unknown) => parseList(faqSchema, value);
export const categoryBenefits = (value: unknown) => allCategoryBenefits(value).filter(item => item.visible);
export const categorySteps = (value: unknown) => allCategorySteps(value).filter(item => item.visible);
export const categorySections = (value: unknown) => allCategorySections(value).filter(item => item.visible);
export const categoryFaq = (value: unknown) => allCategoryFaq(value).filter(item => item.enabled);

export type CategoryBenefit = z.infer<typeof benefitSchema>;
export type CategoryStep = z.infer<typeof stepSchema>;
export type CategorySection = z.infer<typeof sectionSchema>;
export type CategoryFaq = z.infer<typeof faqSchema>;
