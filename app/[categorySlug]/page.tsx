import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryLanding } from "@/components/category-landing";
import { categoryFaq } from "@/lib/category-content";
import { categoryPublicPath, getPublicCategory } from "@/lib/category-query";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";
import { hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";
import { LandingSectionRenderer } from "@/components/landing-section-renderer";
import { ModularPageRenderer } from "@/components/landing-section-renderer";
import { modularFaq, modularHeroImage } from "@/lib/landing-sections";
import { db } from "@/lib/db";
import { getRequestLocale } from "@/lib/request-locale";
import { languageAlternates, localizedPath, localizeContentPage, localizeSections } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const slug = (await params).categorySlug; const category = await getPublicCategory(slug);
  if (!category) {
    const store = await getCurrentStorefront(); const locale = await getRequestLocale(store); const page = await db.contentPage.findFirst({ where: { storeId: store.id, slug, status: "PUBLISHED", categoryId: null, kind: { not: "HOME" } }, include: { translations: { where: { locale } }, sections: { where: { visible: true }, include: { translations: { where: { locale } } }, orderBy: { sortOrder: "asc" } } } });
    if (!page) return { robots: { index: false, follow: false } };
    const localized = localizeContentPage(page, locale, store.defaultLocale); const title = localized.seoTitle ?? localized.name; const description = localized.seoDescription ?? undefined; const path = `/${page.slug}`;
    return { title, description, alternates: { canonical: page.canonicalUrl ?? localizedPath(path, locale, store.defaultLocale), languages: languageAlternates(path, store.origin, store.enabledLocales, store.defaultLocale) }, robots: page.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false }, openGraph: { title, description, type: "website", locale: locale.replace("-", "_"), images: page.ogImageUrl ? [page.ogImageUrl] : modularHeroImage(localized.sections) ? [modularHeroImage(localized.sections)!] : undefined } };
  }
  const store = await getCurrentStorefront(); const locale = await getRequestLocale(store); const pageTranslation = category.contentPage?.translations.find(item => item.locale === locale); const localizedSections = localizeSections(category.landingSections, locale, store.defaultLocale); const title = pageTranslation?.seoTitle ?? category.seoTitle ?? category.heroHeadline ?? pageTranslation?.name ?? category.name;
  const description = pageTranslation?.seoDescription ?? category.seoDescription ?? category.shortDescription ?? category.description;
  return {
    title,
    description,
    alternates: { canonical: category.canonicalUrl ?? localizedPath(categoryPublicPath(category.slug), locale, store.defaultLocale), languages: languageAlternates(categoryPublicPath(category.slug), store.origin, store.enabledLocales, store.defaultLocale) },
    robots: category.indexable && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description: description ?? undefined, type: "website", locale: locale.replace("-", "_"), images: category.ogImageUrl ? [category.ogImageUrl] : modularHeroImage(localizedSections) ? [modularHeroImage(localizedSections)!] : category.heroImageUrl ? [category.heroImageUrl] : undefined },
  };
}

export default async function PublicCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  const category = await getPublicCategory(categorySlug);
  if (!category) {
    const store = await getCurrentStorefront(); const locale = await getRequestLocale(store);
    const [page, categories, products] = await Promise.all([
      db.contentPage.findFirst({ where: { storeId: store.id, slug: categorySlug, status: "PUBLISHED", categoryId: null, kind: { not: "HOME" } }, include: { translations: { where: { locale } }, sections: { where: { visible: true }, include: { translations: { where: { locale } } }, orderBy: { sortOrder: "asc" } } } }),
      db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showLanding: true }, select: { id: true, slug: true, name: true, shortDescription: true, cardTitle: true, cardText: true, cardImageUrl: true, cardImageAlt: true, icon: true }, orderBy: { sortOrder: "asc" } }),
      db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true }, select: { id: true, slug: true, name: true, description: true, shortDescription: true, featured: true, images: { where: { isPrimary: true }, select: { url: true, altText: true }, take: 1 }, variants: { where: { active: true }, select: { priceCents: true }, orderBy: { priceCents: "asc" }, take: 1 } }, orderBy: [{ featured: "desc" }, { name: "asc" }] }),
    ]);
    if (!page) notFound();
    const localized = localizeContentPage(page, locale, store.defaultLocale);
    return <ModularPageRenderer name={localized.name} sections={localized.sections} products={products} categories={categories} store={{ displayName: store.displayName, currency: store.currency, nfcEnabled: hasStoreCapability(store, StoreCapability.NFC) }} breadcrumbs={[{ label: "Home", href: "/" }, { label: localized.name }]} />;
  }
  if (categorySlug !== category.slug) permanentRedirect(categoryPublicPath(category.slug));

  const store = await getCurrentStorefront(); const locale = await getRequestLocale(store);
  const localizedCategory = { ...category, name: category.contentPage?.translations.find(item => item.locale === locale)?.name ?? category.name, landingSections: localizeSections(category.landingSections, locale, store.defaultLocale) };
  const origin = store.origin;
  const faq = localizedCategory.landingSections.length ? modularFaq(localizedCategory.landingSections) : categoryFaq(category.faq);
  const products = category.showInShop ? category.products : [];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/shop` }, { "@type": "ListItem", position: 3, name: category.name, item: `${origin}${categoryPublicPath(category.slug)}` }] },
      { "@type": "CollectionPage", name: category.seoTitle ?? category.name, description: category.seoDescription ?? category.shortDescription, url: `${origin}${categoryPublicPath(category.slug)}`, mainEntity: { "@type": "ItemList", itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: `${origin}/products/${product.slug}`, name: product.name })) } },
      ...(faq.length ? [{ "@type": "FAQPage", mainEntity: faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }] : []),
    ],
  };

  const storefront = { displayName: store.displayName, currency: store.currency, nfcEnabled: hasStoreCapability(store, StoreCapability.NFC) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />{localizedCategory.landingSections.length ? <LandingSectionRenderer category={localizedCategory} store={storefront} /> : <CategoryLanding category={localizedCategory} store={storefront} />}</>;
}
