import type { Metadata } from "next";
import {
  CategoryStatus,
  LandingSectionType,
  StoreCapability,
} from "@prisma/client";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { categoryFaq } from "@/lib/category-content";
import { db } from "@/lib/db";
import { localizeContentPage } from "@/lib/i18n";
import { modularFaq } from "@/lib/landing-sections";
import { getRequestLocale } from "@/lib/request-locale";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default async function FaqPage() {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const page = await db.contentPage
    .findFirst({
      where: {
        storeId: store.id,
        slug: "faq",
        status: "PUBLISHED",
        categoryId: null,
      },
      include: {
        translations: { where: { locale } },
        sections: {
          where: { visible: true },
          include: { translations: { where: { locale } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    })
    .catch(() => null);
  const categories = await db.productCategory
    .findMany({
      where: {
        storeId: store.id,
        status: CategoryStatus.PUBLISHED,
      },
      select: {
        id: true,
        name: true,
        faq: true,
        landingSections: {
          where: { visible: true, type: LandingSectionType.FAQ },
          select: { type: true, visible: true, content: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    })
    .catch(() => []);
  const localized = page
    ? localizeContentPage(page, locale, store.defaultLocale)
    : null;
  const categoryFaqSections = categories.flatMap((category) => {
    // Keep the older category FAQ field available while a category is being
    // migrated to modular sections. A malformed modular section must never
    // make the category's valid questions disappear from /faq.
    const seen = new Set<string>();
    const items = [
      ...modularFaq(category.landingSections),
      ...categoryFaq(category.faq),
    ].filter((item) => {
      const key = `${item.question}\u0000${item.answer}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!items.length) return [];
    return [
      {
        id: `category-faqs-${category.id}`,
        type: LandingSectionType.FAQ,
        name: `${category.name} FAQs`,
        visible: true,
        content: {
          eyebrow: `${category.name} FAQs`,
          headline: `About ${category.name}`,
          items: items.map((item, order) => ({
            question: item.question,
            answer: item.answer,
            visible: true,
            order,
          })),
        },
      },
    ];
  });
  // Only FAQ sections belong on this route. In particular, older generic
  // Content Page sections can be incomplete while they are edited; rendering
  // them here used to leave the page visually empty even though /faq existed.
  const generalFaqSections = (localized?.sections ?? []).filter(
    (section) =>
      section.type === LandingSectionType.FAQ &&
      modularFaq([section]).length > 0,
  );
  // Category FAQs are always shown first, followed by the dedicated general
  // FAQ questions configured in Admin → Content → Pages → FAQs.
  const sections = [...categoryFaqSections, ...generalFaqSections];
  if (sections.length) {
    return (
      <ModularPageRenderer
        name={localized?.name ?? "Frequently asked questions"}
        sections={sections}
        products={[]}
        categories={[]}
        store={{
          displayName: store.displayName,
          currency: store.currency,
          nfcEnabled: hasStoreCapability(store, StoreCapability.NFC),
        }}
        theme={localized?.visualTheme.toLowerCase() ?? "coral"}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: localized?.name ?? "Frequently asked questions" },
        ]}
      />
    );
  }
  return (
    <article className="section article-page" id="faqs">
      <span className="eyebrow">Support</span>
      <h1 className="page-title">Frequently asked questions</h1>
      <p className="lead">
        Answers will appear here once the FAQ page is published from Content →
        Pages.
      </p>
    </article>
  );
}
