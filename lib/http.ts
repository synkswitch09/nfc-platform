import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function getClientIp(request: NextRequest) {
  if (!getRuntimeConfig().trustProxy) return "untrusted-proxy";
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export function safeNextPath(value: string | null, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
