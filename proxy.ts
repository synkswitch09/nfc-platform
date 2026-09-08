import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const limit = await rateLimit("admin-api", getClientIp(request), 600, 15 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many administrative requests" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/admin/:path*" };
