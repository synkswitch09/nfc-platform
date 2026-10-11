import type { LandingSectionType, Prisma } from "@prisma/client";
import { parseLandingContent } from "@/lib/landing-sections";
import { faqQuestionKey } from "@/lib/faq-proposals";

// Category answers take priority on the combined FAQ page. Preserve CMS rows;
// remove repeated visible questions only from the public view and its JSON-LD.
export function uniqueFaqSections<T extends { type: LandingSectionType; visible: boolean; content: Prisma.JsonValue }>(sections: T[]): T[] {
  const seen = new Set<string>();
  return sections.flatMap(section => {
    if (!section.visible || section.type !== "FAQ") return [];
    const content = parseLandingContent("FAQ", section.content);
    const items = (Array.isArray(content?.items) ? content.items : []) as { question: string; answer: string; visible: boolean; order: number }[];
    const unique = items.filter(item => item.visible !== false).sort((left, right) => left.order - right.order).filter(item => {
      const key = faqQuestionKey(item.question);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    return unique.length ? [{ ...section, content: { ...content, items: unique } as Prisma.JsonObject }] : [];
  });
}
