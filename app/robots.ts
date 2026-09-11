import type { MetadataRoute } from "next";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";
import { StoreStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = getRuntimeConfig();
  const store = await getCurrentStorefront();
  const origin = store.origin;
  if (store.status !== StoreStatus.ACTIVE || !searchEnginePolicy(config.appEnv).index) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: ["/", "/shop", "/products/", "/categories/"], disallow: ["/admin/", "/dashboard/", "/api/", "/checkout", "/claim-order", "/activate", "/t/"] }], sitemap: `${origin}/sitemap.xml` };
}
