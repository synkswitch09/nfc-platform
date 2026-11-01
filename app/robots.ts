import { headers } from "next/headers";
import { assistantConfig, isAssistantHost } from "@/lib/assistants/config";
import type { MetadataRoute } from "next";
import { getRuntimeConfig, searchEnginePolicy } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";
import { StoreStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if(isAssistantHost((await headers()).get("host"))) { const ai=assistantConfig(); return ai.launchEnabled && process.env.APP_ENV === "production" ? { rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/ai-assistants", "/assistant-portal", "/api/", "/login", "/register", "/verify-email", "/reset-password"] }], sitemap: `${ai.origin}/sitemap.xml` } : { rules: [{ userAgent: "*", disallow: "/" }] }; }
  const config = getRuntimeConfig();
  const store = await getCurrentStorefront();
  const origin = store.origin;
  if (store.status !== StoreStatus.ACTIVE || !searchEnginePolicy(config.appEnv, config.previewMode).index) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: ["/", "/api/media/"], disallow: ["/admin/", "/dashboard/", "/api/", "/checkout", "/claim-order", "/activate", "/t/"] }], sitemap: `${origin}/sitemap.xml` };
}
