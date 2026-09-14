import type { Metadata } from "next";
import { LandingSectionType, StoreCapability } from "@prisma/client";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { categoryFaq } from "@/lib/category-content";
import { db } from "@/lib/db";
import { localizeContentPage, localizeSections } from "@/lib/i18n";
import { modularFaq } from "@/lib/landing-sections";
import { getRequestLocale } from "@/lib/request-locale";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default async function FaqPage() {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const [page, categories] = process.env.DATABASE_URL
    ? await Promise.all([
        db.contentPage.findFirst({
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
        }),
        db.productCategory.findMany({
          where: {
            storeId: store.id,
            status: "PUBLISHED",
            showLanding: true,
          },
          select: {
            id: true,
            faq: true,
            landingSections: {
              where: { visible: true },
              include: { translations: { where: { locale } } },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        }),
      ]).catch(() => [null, []] as const)
    : ([null, []] as const);
  const localized = page
    ? localizeContentPage(page, locale, store.defaultLocale)
    : null;
  const categoryItems = categories.flatMap((category) => {
    const sections = localizeSections(
      category.landingSections,
      locale,
      store.defaultLocale,
    );
    return sections.length ? modularFaq(sections) : categoryFaq(category.faq);
  });
  const uniqueCategoryItems = Array.from(
    new Map(
      categoryItems.map((item) => [`${item.question}\u0000${item.answer}`, item]),
    ).values(),
  );
  const categoryFaqSection = uniqueCategoryItems.length
    ? [
        {
          id: "category-faqs",
          type: LandingSectionType.FAQ,
          name: "Category FAQs",
          visible: true,
          content: {
            eyebrow: "From our categories",
            headline: "Frequently asked questions",
            items: uniqueCategoryItems.map((item, order) => ({
              id: `category-faq-${order}`,
              question: item.question,
              answer: item.answer,
              visible: true,
              order,
            })),
          },
        },
      ]
    : [];
  const sections = [...(localized?.sections ?? []), ...categoryFaqSection];
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
