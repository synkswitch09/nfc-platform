import { db } from "@/lib/db";

export const defaultStoreSettings = { storeName: "TapKind", businessName: null as string | null, supportEmail: "hello@example.com", currency: "AUD", defaultCountry: "AU", siteTitle: "TapKind NFC", siteDescription: "Smart NFC tags for pets, families, social profiles and business in Australia.", defaultSocialImageUrl: null as string | null, socialLinks: {} as Record<string, string>, shippingConfig: { flatRateCents: 900, freeOverCents: 6000 } as Record<string, number> };

export async function getStoreSettings() {
  if (!process.env.DATABASE_URL) return defaultStoreSettings;
  const settings = await db.storeSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  if (!settings) return defaultStoreSettings;
  return { ...settings, socialLinks: settings.socialLinks as Record<string, string>, shippingConfig: settings.shippingConfig as Record<string, number> };
}
