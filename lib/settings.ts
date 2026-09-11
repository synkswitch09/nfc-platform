import { getCurrentStorefront, type Storefront } from "@/lib/storefront";

export const defaultStoreSettings = { storeName: "Tapkin", businessName: null as string | null, supportEmail: "hello@example.com", currency: "AUD", defaultCountry: "AU", siteTitle: "Tapkin Smart Products", siteDescription: "Personalised smart products combining 3D printing, NFC, QR and secure digital profiles.", defaultSocialImageUrl: null as string | null, socialLinks: {} as Record<string, string>, shippingConfig: { flatRateCents: 900, freeOverCents: 6000 } as Record<string, number> };

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
    theme: store.theme,
    homepage: store.homepage,
    capabilities: store.capabilities,
    origin: store.origin,
  };
}
