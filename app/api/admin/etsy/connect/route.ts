import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { createEtsyOAuthTransaction, ETSY_OAUTH_COOKIE, etsyAuthorizationUrl, isEtsyConfigured } from "@/lib/etsy";
import { getRuntimeConfig } from "@/lib/config";

export async function GET(request: NextRequest) {
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!isEtsyConfigured()) return NextResponse.redirect(new URL("/admin/etsy?etsy=config", request.url));
  const transaction = createEtsyOAuthTransaction(context.store.id, context.user.id);
  const response = NextResponse.redirect(etsyAuthorizationUrl(transaction.value));
  response.cookies.set(ETSY_OAUTH_COOKIE, transaction.cookie, { httpOnly: true, secure: getRuntimeConfig().appUrl.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 10 * 60 });
  return response;
}
