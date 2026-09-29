import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { processEtsySyncJobs } from "@/lib/etsy";

export async function POST(request: NextRequest) {
  const secret = getRuntimeConfig().etsy.syncSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await processEtsySyncJobs(undefined, 50));
}
