import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability, StoreStatus } from "@prisma/client";
import { languageAlternates } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getRuntimeConfig();
  const store = await getCurrentStorefront();
  if (store.status !== StoreStatus.ACTIVE || !searchEnginePolicy(config.appEnv).index) return [];
  const origin = store.origin;
  const entry = (path: string) => ({ url: `${origin}${path}`, alternates: { languages: languageAlternates(path, origin, store.enabledLocales, store.defaultLocale) } });
  const base: MetadataRoute.Sitemap = [{ ...entry("/"), changeFrequency: "weekly", priority: 1 }, { ...entry("/shop"), changeFrequency: "daily", priority: .9 }, { ...entry("/guides"), lastModified: new Date("2026-09-08"), changeFrequency: "monthly", priority: .7 }, ...(hasStoreCapability(store, StoreCapability.NFC) ? [{ ...entry("/guides/how-nfc-pet-tags-work"), lastModified: new Date("2026-09-08"), changeFrequency: "yearly" as const, priority: .7 }] : []), { ...entry("/privacy"), changeFrequency: "yearly", priority: .2 }, { ...entry("/terms"), changeFrequency: "yearly", priority: .2 }];
  if (!process.env.DATABASE_URL) return base;
  const [products, categories] = await Promise.all([db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true, indexable: true, category: { storeId: store.id, status: "PUBLISHED" } }, select: { slug: true, updatedAt: true } }), db.productCategory.findMany({ where: { storeId: store.id, status: "PUBLISHED", showLanding: true, indexable: true }, select: { slug: true, updatedAt: true } })]).catch(() => [[], []] as const);
  return [...base, ...products.map(product => ({ ...entry(`/products/${product.slug}`), lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: .8 })), ...categories.map(category => ({ ...entry(`/${category.slug}`), lastModified: category.updatedAt, changeFrequency: "weekly" as const, priority: .7 }))];
}
