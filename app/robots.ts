import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: ["/", "/shop", "/products/", "/categories/"], disallow: ["/admin/", "/dashboard/", "/api/", "/checkout", "/claim-order", "/activate", "/t/"] }], sitemap: `${origin}/sitemap.xml` };
}
