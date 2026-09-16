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
import { getRequestLocale } from "@/lib/request-locale";
import {
  compactLocaleName,
  getSystemCopy,
  languageAlternates,
} from "@/lib/i18n";
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
  return {
    metadataBase: new URL(store.origin),
    robots:
      store.status === StoreStatus.ACTIVE
        ? searchEnginePolicy(config.appEnv)
        : { index: false, follow: false },
    title: {
      default: settings.siteTitle,
      template: `%s · ${settings.storeName}`,
    },
    description: settings.siteDescription,
    applicationName: settings.storeName,
    alternates: {
      canonical: locale === store.defaultLocale ? "/" : `/?locale=${locale}`,
      languages: languageAlternates(
        "/",
        store.origin,
        store.enabledLocales,
        store.defaultLocale,
      ),
    },
    icons: store.faviconUrl ? { icon: store.faviconUrl } : undefined,
    openGraph: {
      siteName: settings.storeName,
      title: settings.siteTitle,
      description: settings.siteDescription,
      type: "website",
      locale: locale.replace("-", "_"),
      url: store.origin,
      images: settings.defaultSocialImageUrl
        ? [settings.defaultSocialImageUrl]
        : [],
    },
    twitter: {
      card: settings.defaultSocialImageUrl ? "summary_large_image" : "summary",
      title: settings.siteTitle,
      description: settings.siteDescription,
      images: settings.defaultSocialImageUrl
        ? [settings.defaultSocialImageUrl]
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
  const [user, settings, categories] = await Promise.all([
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
  ]);
  const commerce = isStoreCommerceAvailable(store);
  const nfcEnabled = hasStoreCapability(store, StoreCapability.NFC);
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
            nfcEnabled={nfcEnabled}
            copy={copy}
            locale={locale}
            defaultLocale={store.defaultLocale}
          />
        </CartProvider>
      </body>
    </html>
  );
}
