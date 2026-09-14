import { StoreCapability } from "@prisma/client";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { db } from "@/lib/db";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { getRequestLocale } from "@/lib/request-locale";
import { localizeContentPage } from "@/lib/i18n";

export default async function TermsPage() {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const page = process.env.DATABASE_URL
    ? await db.contentPage
        .findFirst({
          where: {
            storeId: store.id,
            kind: "LEGAL",
            slug: "terms",
            status: "PUBLISHED",
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
    <article className="section article-page">
      <h1>Terms of service</h1>
      <p className="lead">
        <strong>LEGAL REVIEW REQUIRED BEFORE PRODUCTION.</strong> This
        placeholder must be reviewed by an Australian legal professional before
        accepting live orders.
      </p>
    </article>
  );
}
