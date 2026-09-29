import { headers } from "next/headers";
import { resolveLocale } from "@/lib/i18n";
import type { Storefront } from "@/lib/storefront";

export async function getRequestLocale(store: Pick<Storefront, "enabledLocales" | "defaultLocale">) {
  const requestHeaders = await headers();
  return resolveLocale(requestHeaders.get("x-store-locale"), store.enabledLocales, store.defaultLocale);
}
