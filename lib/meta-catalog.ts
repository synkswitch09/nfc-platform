import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { canAcceptVariant } from "@/lib/production-capacity";
import { variantOfferPrice } from "@/lib/seo";
import type { Storefront } from "@/lib/storefront";
export const catalogColumns = ["id", "item_group_id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "color", "size", "material"] as const;
export function csvCell(value: string) {
  // Quote every cell and neutralise spreadsheet formulas in human-authored CMS text.
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function publicCatalogImage(url: string, origin: string) {
  try {
    const image = new URL(url, origin);
    // Private SAS links, tokens, customer uploads and non-HTTP assets never enter the feed.
    if (image.protocol !== "https:" || image.username || image.password || image.search || image.hash) return null;
    if (image.origin === new URL(origin).origin && !/^(\/api\/media\/|\/images\/)/.test(image.pathname)) return null;
    return image.toString();
  } catch { return null; }
}
export async function buildMetaCatalog(store: Storefront) {
  const config = parseIntegrationConfig(store.integrations);
  if (getRuntimeConfig().appEnv !== "production" || store.environment !== "PRODUCTION" || store.status !== "ACTIVE" || !config.metaCatalogEnabled || !config.metaCatalogId) return null;
  const [products, pool, booked] = await Promise.all([
    db.product.findMany({ where: { storeId: store.id, status: "ACTIVE", shopVisible: true, category: { storeId: store.id, status: "PUBLISHED" } }, orderBy: { id: "asc" }, include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: { where: { active: true }, orderBy: { id: "asc" }, include: { image: true } },
      options: { where: { active: true }, include: { values: { where: { active: true } } } },
    } }),
    db.productionPool.findUnique({ where: { environment: "PRODUCTION" } }),
    db.productionBooking.aggregate({ where: { environment: "PRODUCTION", releasedAt: null }, _sum: { minutes: true } }),
  ]);
  const rows: string[][] = [];
  let skipped = 0;
  for (const product of products) for (const variant of product.variants) {
    const price = variantOfferPrice(variant, product.options, product.personalisationMode);
    const image = [variant.image, ...product.images.filter(i => i.variantId === variant.id), ...product.images].map(i => i && publicCatalogImage(i.url, store.origin)).find(Boolean);
    if (!price || !image || !Number.isFinite(Number(price)) || Number(price) <= 0) { skipped++; continue; }
    const available = getRuntimeConfig().checkoutEnabled && canAcceptVariant(variant, pool, booked._sum.minutes ?? 0);
    const stock = variant.trackInventory && variant.inventory > variant.reservedInventory;
    rows.push([variant.id, product.id, `${product.name}${product.variants.length > 1 ? ` — ${variant.name}` : ""}`.slice(0, 200), (product.shortDescription || product.description).replace(/<[^>]*>/g, " ").slice(0, 9999), available ? stock ? "in stock" : "available for order" : "out of stock", "new", `${price} ${store.currency}`, `${store.origin}/products/${product.slug}?variant=${variant.id}`, image, product.brand || store.displayName, variant.colour || "", variant.size || "", variant.material || ""]);
  }
  return { csv: [catalogColumns.join(","), ...rows.map(row => row.map(csvCell).join(","))].join("\r\n") + "\r\n", count: rows.length, skipped };
}
