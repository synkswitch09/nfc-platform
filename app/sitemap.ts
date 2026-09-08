import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const base: MetadataRoute.Sitemap = [{ url: origin, changeFrequency: "weekly", priority: 1 }, { url: `${origin}/shop`, changeFrequency: "daily", priority: .9 }, { url: `${origin}/guides`, lastModified: new Date("2026-09-08"), changeFrequency: "monthly", priority: .7 }, { url: `${origin}/guides/how-nfc-pet-tags-work`, lastModified: new Date("2026-09-08"), changeFrequency: "yearly", priority: .7 }, { url: `${origin}/privacy`, changeFrequency: "yearly", priority: .2 }, { url: `${origin}/terms`, changeFrequency: "yearly", priority: .2 }];
  if (!process.env.DATABASE_URL) return base;
  const [products, categories] = await Promise.all([db.product.findMany({ where: { status: "ACTIVE", indexable: true }, select: { slug: true, updatedAt: true } }), db.productCategory.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } })]).catch(() => [[], []] as const);
  return [...base, ...products.map(product => ({ url: `${origin}/products/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: .8 })), ...categories.map(category => ({ url: `${origin}/categories/${category.slug}`, lastModified: category.updatedAt, changeFrequency: "weekly" as const, priority: .7 }))];
}
