import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/admin/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const limit = await rateLimit("admin-api", getClientIp(request), 600, 15 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many administrative requests" }, { status: 429 });
  }
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId = incomingRequestId && /^[A-Za-z0-9_-]{8,64}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID(); const requestHeaders = new Headers(request.headers); requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } }); response.headers.set("x-request-id", requestId); return response;
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
