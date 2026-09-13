import { NextResponse, type NextRequest } from "next/server";
import { currentAppEnvironment } from "@/lib/config";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { localeCookieName } from "@/lib/i18n";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/admin/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const limit = await rateLimit("admin-api", getClientIp(request), 600, 15 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many administrative requests" }, { status: 429 });
  }
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId = incomingRequestId && /^[A-Za-z0-9_-]{8,64}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers); requestHeaders.set("x-request-id", requestId);
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const rememberedLocale = request.cookies.get(localeCookieName)?.value;
  const locale = requestedLocale && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(requestedLocale) ? requestedLocale : rememberedLocale;
  if (locale) requestHeaders.set("x-store-locale", locale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (requestedLocale && locale === requestedLocale) response.cookies.set(localeCookieName, requestedLocale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  response.headers.set("x-request-id", requestId);
  if (currentAppEnvironment() !== "production") response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
