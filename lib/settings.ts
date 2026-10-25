import { storefrontSocialChannels } from "@/lib/site-chrome";
import { storeGoogleVerification } from "@/lib/site-verification";
import { getCurrentStorefront, type Storefront } from "@/lib/storefront";

export async function getStoreSettings(storefront?: Storefront) {
  const store = storefront ?? await getCurrentStorefront();
  const socialChannels = storefrontSocialChannels(store.footerConfig, store.socialLinks);
  return {
    id: store.id,
    slug: store.slug,
    status: store.status,
    storeName: store.displayName,
    businessName: store.legalName,
    businessAbn: typeof store.organization.abn === "string" ? store.organization.abn : "",
    registeredBusinessName: typeof store.organization.registeredBusinessName === "string" ? store.organization.registeredBusinessName : "",
    gstRegistration: store.organization.gstRegistered === true ? "registered" : store.organization.gstRegistered === false ? "not-registered" : "unspecified",
    supportEmail: store.supportEmail,
    currency: store.currency,
    defaultCountry: store.country,
    timezone: store.timezone,
    logoUrl: store.logoUrl,
    faviconUrl: store.faviconUrl,
    siteTitle: store.seoTitle,
    siteDescription: store.seoDescription,
    googleSiteVerification: storeGoogleVerification(store) ?? "",
    defaultSocialImageUrl: store.socialImageUrl,
    socialLinks: socialChannels.links,
    socialChannels,
    shippingConfig: store.shippingConfig,
    headerConfig: store.headerConfig,
    footerConfig: store.footerConfig,
    petProfileConfig: store.petProfileConfig,
    defaultLocale: store.defaultLocale,
    enabledLocales: store.enabledLocales,
    theme: store.theme,
    homepage: store.homepage,
    capabilities: store.capabilities,
    origin: store.origin,
  };
}
