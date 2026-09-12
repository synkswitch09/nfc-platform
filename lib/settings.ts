import { getCurrentStorefront, type Storefront } from "@/lib/storefront";

export async function getStoreSettings(storefront?: Storefront) {
  const store = storefront ?? await getCurrentStorefront();
  return {
    id: store.id,
    slug: store.slug,
    status: store.status,
    storeName: store.displayName,
    businessName: store.legalName,
    supportEmail: store.supportEmail,
    currency: store.currency,
    defaultCountry: store.country,
    timezone: store.timezone,
    logoUrl: store.logoUrl,
    faviconUrl: store.faviconUrl,
    siteTitle: store.seoTitle,
    siteDescription: store.seoDescription,
    defaultSocialImageUrl: store.socialImageUrl,
    socialLinks: store.socialLinks,
    shippingConfig: store.shippingConfig,
    headerConfig: store.headerConfig,
    footerConfig: store.footerConfig,
    defaultLocale: store.defaultLocale,
    enabledLocales: store.enabledLocales,
    theme: store.theme,
    homepage: store.homepage,
    capabilities: store.capabilities,
    origin: store.origin,
  };
}
