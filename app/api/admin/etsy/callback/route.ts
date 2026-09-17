import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { createEtsyConnection, ETSY_OAUTH_COOKIE, EtsyError, exchangeEtsyAuthorizationCode, readEtsyOAuthTransaction } from "@/lib/etsy";

function redirect(request: NextRequest, result: string) {
  const url = new URL("/admin/etsy", request.url);
  url.searchParams.set("etsy", result);
  const response = NextResponse.redirect(url);
  response.cookies.set(ETSY_OAUTH_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
  return response;
}

export async function GET(request: NextRequest) {
  const transaction = readEtsyOAuthTransaction(request.cookies.get(ETSY_OAUTH_COOKIE)?.value);
  const context = await getAdminApiContext();
  if (!transaction || !context || context.user.id !== transaction.userId || context.store.id !== transaction.storeId || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return redirect(request, "invalid");
  if (request.nextUrl.searchParams.get("state") !== transaction.state) return redirect(request, "invalid");
  if (request.nextUrl.searchParams.get("error")) return redirect(request, "declined");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirect(request, "invalid");
  try {
    await createEtsyConnection(context.store.id, await exchangeEtsyAuthorizationCode(code, transaction.verifier));
    return redirect(request, "connected");
  } catch (error) {
    return redirect(request, error instanceof EtsyError && error.status === 409 ? "no-shop" : "failed");
  }
}
