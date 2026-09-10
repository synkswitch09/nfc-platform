import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getRuntimeConfig();
  if (!searchEnginePolicy(config.appEnv).index) return [];
  const origin = config.appUrl;
  const base: MetadataRoute.Sitemap = [{ url: origin, changeFrequency: "weekly", priority: 1 }, { url: `${origin}/shop`, changeFrequency: "daily", priority: .9 }, { url: `${origin}/guides`, lastModified: new Date("2026-09-08"), changeFrequency: "monthly", priority: .7 }, { url: `${origin}/guides/how-nfc-pet-tags-work`, lastModified: new Date("2026-09-08"), changeFrequency: "yearly", priority: .7 }, { url: `${origin}/privacy`, changeFrequency: "yearly", priority: .2 }, { url: `${origin}/terms`, changeFrequency: "yearly", priority: .2 }];
  if (!process.env.DATABASE_URL) return base;
  const [products, categories] = await Promise.all([db.product.findMany({ where: { status: "ACTIVE", shopVisible: true, indexable: true, category: { status: "PUBLISHED" } }, select: { slug: true, updatedAt: true } }), db.productCategory.findMany({ where: { status: "PUBLISHED", showLanding: true, indexable: true }, select: { slug: true, updatedAt: true } })]).catch(() => [[], []] as const);
  return [...base, ...products.map(product => ({ url: `${origin}/products/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: .8 })), ...categories.map(category => ({ url: `${origin}/${category.slug}`, lastModified: category.updatedAt, changeFrequency: "weekly" as const, priority: .7 }))];
}
