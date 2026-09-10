import type { MetadataRoute } from "next";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const config = getRuntimeConfig();
  const origin = config.appUrl;
  if (!searchEnginePolicy(config.appEnv).index) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: ["/", "/shop", "/products/", "/categories/"], disallow: ["/admin/", "/dashboard/", "/api/", "/checkout", "/claim-order", "/activate", "/t/"] }], sitemap: `${origin}/sitemap.xml` };
}
