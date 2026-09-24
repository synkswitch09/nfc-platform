import type { Metadata } from "next";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { db } from "@/lib/db";
import { getRequestLocale } from "@/lib/request-locale";
import { getCurrentStorefront } from "@/lib/storefront";
import { canonicalForStore, nonEmpty } from "@/lib/seo";
import { languageAlternates, localizedPath } from "@/lib/i18n";

export async function reservedPageMetadata(slug: "faq" | "terms" | "privacy", fallback: string): Promise<Metadata> {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const page = process.env.DATABASE_URL ? await db.contentPage.findFirst({ where: { storeId: store.id, slug, status: "PUBLISHED", categoryId: null }, select: { name: true, seoTitle: true, seoDescription: true, ogImageUrl: true, canonicalUrl: true, indexable: true, sections: { where: { visible: true }, select: { translations: { select: { locale: true } } } }, translations: { select: { locale: true, name: true, seoTitle: true, seoDescription: true } } } }) : null;
  const translation = page?.translations.find(item => item.locale === locale);
  const title = nonEmpty(translation?.seoTitle, nonEmpty(page?.seoTitle, translation?.name || page?.name || fallback));
  const description = translation?.seoDescription || page?.seoDescription || undefined;
  const url = canonicalForStore(store.origin, localizedPath(`/${slug}`, locale, store.defaultLocale), page?.canonicalUrl);
  const translated = new Set(page?.translations.map(item => item.locale));
  const available = page?.canonicalUrl ? [store.defaultLocale] : [store.defaultLocale, ...store.enabledLocales.filter(code => translated.has(code) && page?.sections.some(section => section.translations.some(item => item.locale === code)))];
  return { title, description, alternates: { canonical: url, languages: languageAlternates(`/${slug}`, store.origin, available, store.defaultLocale) }, robots: page?.indexable && page.sections.length && searchEnginePolicy(getRuntimeConfig().appEnv).index ? { index: true, follow: true } : { index: false, follow: false }, openGraph: { type: "website", title, description, url, images: page?.ogImageUrl ? [page.ogImageUrl] : undefined } };
}
