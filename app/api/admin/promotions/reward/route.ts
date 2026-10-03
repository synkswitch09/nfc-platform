import { NextRequest, NextResponse } from "next/server";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const data = await request.json().catch(() => null);
  if (typeof data?.enabled !== "boolean") return jsonError("Invalid setting", 400);
  await db.store.update({ where: { id: context!.store.id }, data: { secondPurchaseRewardEnabled: data.enabled } });
  return NextResponse.json({ ok: true });
}
