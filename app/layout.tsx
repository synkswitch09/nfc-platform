import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getStoreSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import {
  getCurrentStorefront,
  hasStoreCapability,
  isStoreCommerceAvailable,
  storeThemeStyle,
} from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import { AnalyticsConsent } from "@/components/commerce-analytics";
import { getRequestLocale } from "@/lib/request-locale";
import {
  compactLocaleName,
  getSystemCopy,
} from "@/lib/i18n";
import { canonicalForStore, nonEmpty } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const store = await getCurrentStorefront();
  const settings = await getStoreSettings(store);
  const config = getRuntimeConfig();
  const locale = await getRequestLocale(store);
  const home = process.env.DATABASE_URL ? await db.contentPage.findFirst({ where: { storeId: store.id, kind: "HOME", status: "PUBLISHED" }, select: { seoTitle: true, seoDescription: true, ogImageUrl: true, canonicalUrl: true, translations: { where: { locale }, select: { seoTitle: true, seoDescription: true } } } }) : null;
  const title = nonEmpty(home?.translations[0]?.seoTitle, nonEmpty(home?.seoTitle, settings.siteTitle));
  const description = nonEmpty(home?.translations[0]?.seoDescription, nonEmpty(home?.seoDescription, settings.siteDescription));
  const canonical = canonicalForStore(store.origin, locale === store.defaultLocale ? "/" : `/?locale=${locale}`, home?.canonicalUrl);
  const socialImage = home?.ogImageUrl || settings.defaultSocialImageUrl;
  return {
    metadataBase: new URL(store.origin),
    robots:
      store.status === StoreStatus.ACTIVE
        ? searchEnginePolicy(config.appEnv)
        : { index: false, follow: false },
    title: {
      default: title,
      template: `%s · ${settings.storeName}`,
    },
    description,
    applicationName: settings.storeName,
    alternates: { canonical },
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
    openGraph: {
      siteName: settings.storeName,
      title,
      description,
      type: "website",
      locale: locale.replace("-", "_"),
      url: store.origin,
      images: socialImage
        ? [socialImage]
        : [],
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title,
      description,
      images: socialImage
        ? [socialImage]
        : [],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await getCurrentStorefront();
  const locale = await getRequestLocale(store);
  const copy = getSystemCopy(locale);
  const [user, settings, categories, pageNavigation] = await Promise.all([
    getCurrentUser(),
    getStoreSettings(store),
    process.env.DATABASE_URL && store.status === StoreStatus.ACTIVE
      ? db.productCategory
          .findMany({
            where: {
              storeId: store.id,
              status: "PUBLISHED",
              showInNavigation: true,
            },
            select: {
              name: true,
              slug: true,
              contentPage: {
                select: {
                  translations: { where: { locale }, select: { name: true } },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            take: 6,
          })
          .then((rows) =>
            rows.map((row) => ({
              name: row.contentPage?.translations[0]?.name || row.name,
              slug: row.slug,
            })),
          )
          .catch(() => [])
      : [],
    process.env.DATABASE_URL && store.status === StoreStatus.ACTIVE
      ? db.contentPage
          .findMany({
            where: {
              storeId: store.id,
              status: "PUBLISHED",
              categoryId: null,
              kind: { not: "HOME" },
              OR: [{ showInHeader: true }, { showInFooter: true }],
            },
            select: {
              slug: true,
              name: true,
              showInHeader: true,
              showInFooter: true,
              headerLabel: true,
              footerLabel: true,
              navigationOrder: true,
              translations: { where: { locale }, select: { name: true } },
            },
            orderBy: [{ navigationOrder: "asc" }, { name: "asc" }],
          })
          .then((rows) =>
            rows.map((page) => ({
              ...page,
              name: page.translations[0]?.name || page.name,
            })),
          )
          .catch(() => [])
      : [],
  ]);
  const commerce = isStoreCommerceAvailable(store);
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
  const runtime = getRuntimeConfig();
  const analyticsEnabled = runtime.appEnv === "production" && Boolean(runtime.analyticsStores[store.slug]);
  return (
    <html lang={locale}>
      <body
        className={inter.variable}
        data-store={store.slug}
        data-theme-style={store.theme.fontStyle}
        style={storeThemeStyle(store.theme)}
      >
        <CartProvider storageKey={`commerce-cart:${store.id}:v1`}>
          <SiteHeader
            config={settings.headerConfig}
            storeName={settings.storeName}
            storeLogoUrl={store.logoUrl}
            categories={categories}
            pages={pageNavigation.filter((page) => page.showInHeader).map((page) => ({ name: page.headerLabel || page.name, slug: page.slug, order: page.navigationOrder }))}
            commerce={commerce}
            nfcEnabled={nfcEnabled}
            authenticated={Boolean(user)}
            copy={copy}
            locale={locale}
            locales={store.enabledLocales.map((code) => ({
              code,
              name: compactLocaleName(code),
            }))}
            defaultLocale={store.defaultLocale}
          />
          <main className="storefront-main">{children}</main>
          <SiteFooter
            config={settings.footerConfig}
            storeName={settings.storeName}
            storeLogoUrl={store.logoUrl}
            socialLinks={settings.socialLinks}
            pages={pageNavigation.filter((page) => page.showInFooter).map((page) => ({ name: page.footerLabel || page.name, slug: page.slug, order: page.navigationOrder }))}
            nfcEnabled={nfcEnabled}
            copy={copy}
            locale={locale}
            defaultLocale={store.defaultLocale}
          />
          {analyticsEnabled && <AnalyticsConsent store={store.slug} />}
        </CartProvider>
      </body>
    </html>
  );
}
