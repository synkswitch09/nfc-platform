import type { Metadata } from "next";
import { StoreCapability } from "@prisma/client";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { db } from "@/lib/db";
import { localizeContentPage } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default async function FaqPage() {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const page = process.env.DATABASE_URL
    ? await db.contentPage
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
        .catch(() => null)
    : null;
  if (page?.sections.length) {
    const localized = localizeContentPage(page, locale, store.defaultLocale);
    return (
      <ModularPageRenderer
        name={localized.name}
        sections={localized.sections}
        products={[]}
        categories={[]}
        store={{
          displayName: store.displayName,
          currency: store.currency,
          nfcEnabled: hasStoreCapability(store, StoreCapability.NFC),
        }}
        theme={localized.visualTheme.toLowerCase()}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: localized.name }]}
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
