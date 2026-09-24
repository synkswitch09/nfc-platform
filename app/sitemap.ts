import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront, hasStoreCapability, isStoreCommerceAvailable, TAPKIN_STORE_ID } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import { languageAlternates, localizedPath } from "@/lib/i18n";
import { canonicalForStore } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getRuntimeConfig();
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE || !searchEnginePolicy(config.appEnv).index) return [];
  const { origin } = store;
  const entry = (path: string, updatedAt?: Date, translatedLocales: string[] = []): MetadataRoute.Sitemap => {
    const locales = [store.defaultLocale, ...translatedLocales.filter(locale => locale !== store.defaultLocale && store.enabledLocales.includes(locale))];
    const alternates = locales.length > 1 ? { alternates: { languages: languageAlternates(path, origin, locales, store.defaultLocale) } } : {};
    return locales.map(locale => ({ url: `${origin}${localizedPath(path, locale, store.defaultLocale)}`, ...(updatedAt ? { lastModified: updatedAt } : {}), ...alternates }));
  };
  const base = [...entry("/"), ...(isStoreCommerceAvailable(store) ? entry("/shop") : []), ...(store.id === TAPKIN_STORE_ID && hasStoreCapability(store, StoreCapability.NFC) ? [...entry("/guides"), ...entry("/guides/how-nfc-pet-tags-work", new Date("2026-09-08"))] : [])];
  if (!process.env.DATABASE_URL) return base;
  // A DB failure must not turn into an apparently valid but incomplete sitemap.
  const [products, categories, pages] = await Promise.all([
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true, indexable: true, category: { storeId: store.id, status: "PUBLISHED" } }, select: { slug: true, updatedAt: true, canonicalUrl: true } }),
    db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showLanding: true, indexable: true }, select: { slug: true, updatedAt: true, canonicalUrl: true, contentPage: { select: { translations: { select: { locale: true } } } }, landingSections: { where: { visible: true }, select: { translations: { select: { locale: true } } } } } }),
    db.contentPage.findMany({ where: { storeId: store.id, status: "PUBLISHED", indexable: true, categoryId: null, kind: { not: "HOME" }, sections: { some: { visible: true } } }, select: { slug: true, updatedAt: true, canonicalUrl: true, translations: { select: { locale: true } }, sections: { where: { visible: true }, select: { translations: { select: { locale: true } } } } } }),
  ]);
  const ownCanonical = (path: string, override: string | null) => canonicalForStore(origin, path, override) === `${origin}${path}`;
  const sectionLocales = (sections: { translations: { locale: string }[] }[]) => [...new Set(sections.flatMap(section => section.translations.map(translation => translation.locale)))];
  const pageEntries = pages.flatMap(page => {
    const path = `/${page.slug}`;
    if (!ownCanonical(path, page.canonicalUrl)) return [];
    const translated = new Set(page.translations.map(item => item.locale));
    return entry(path, page.updatedAt, page.canonicalUrl ? [] : sectionLocales(page.sections).filter(locale => translated.has(locale)));
  });
  return [
    ...base,
    ...products.flatMap(product => ownCanonical(`/products/${product.slug}`, product.canonicalUrl) ? entry(`/products/${product.slug}`, product.updatedAt) : []),
    ...categories.flatMap(category => ownCanonical(`/${category.slug}`, category.canonicalUrl) ? entry(`/${category.slug}`, category.updatedAt, category.canonicalUrl ? [] : sectionLocales(category.landingSections).filter(locale => category.contentPage?.translations.some(item => item.locale === locale))) : []),
    ...pageEntries,
  ];
}
