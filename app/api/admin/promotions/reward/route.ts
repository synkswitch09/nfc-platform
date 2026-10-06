import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const data = z.object({ enabled: z.boolean(), amountCents: z.number().int().min(100).max(100000), validityDays: z.number().int().min(1).max(365), minimumSubtotalCents: z.number().int().min(0).max(10000000) }).safeParse(await request.json().catch(() => null));
  if (!data.success) return jsonError(data.error.issues[0]?.message ?? "Invalid first-purchase campaign", 400);
  await db.store.update({ where: { id: context!.store.id }, data: { secondPurchaseRewardEnabled: data.data.enabled, secondPurchaseRewardAmountCents: data.data.amountCents, secondPurchaseRewardValidityDays: data.data.validityDays, secondPurchaseRewardMinimumCents: data.data.minimumSubtotalCents } });
  return NextResponse.json({ ok: true });
}
