import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext,hasPermission } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ weeklyCapacityMinutes: z.number().int().min(30).max(10080), maxBusinessDays: z.number().int().min(1).max(60), paused: z.boolean() });
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !hasPermission(context,"production.shared")) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid production settings", 400);
  const environment = context.store.environment;
  const pool = await db.productionPool.upsert({ where: { environment }, create: { environment, ...parsed.data }, update: { ...parsed.data, reviewedAt: null, version: { increment: 1 } } });
  await db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "PRODUCTION_CAPACITY_CHANGED", entityType: "ProductionPool", entityId: context.store.id, metadata: { environment, ...parsed.data } } });
  return NextResponse.json({ pool });
}
