import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { processEtsySyncJobs } from "@/lib/etsy";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  await db.marketplaceSyncJob.updateMany({ where: { connection: { storeId: context.store.id, kind: "ETSY" }, status: "FAILED" }, data: { status: "QUEUED", availableAt: new Date(), completedAt: null, lastError: null } });
  const result = await processEtsySyncJobs(context.store.id, 20);
  return NextResponse.json(result);
}
