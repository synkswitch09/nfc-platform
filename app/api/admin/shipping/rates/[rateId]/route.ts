import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ serviceName: z.string().trim().min(2).max(100), amountCents: z.number().int().min(0).max(1_000_000), freeOverCents: z.number().int().min(0).max(100_000_000).nullable(), estimatedDaysMin: z.number().int().min(0).max(365).nullable(), estimatedDaysMax: z.number().int().min(0).max(365).nullable(), active: z.boolean() }).refine(value => value.estimatedDaysMin === null || value.estimatedDaysMax === null || value.estimatedDaysMin <= value.estimatedDaysMax, "Maximum days must be at least minimum days");
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ rateId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid rate", 400);
  const { rateId } = await params;
  const changed = await db.shippingRate.updateMany({ where: { id: rateId, storeId: context!.store.id }, data: parsed.data });
  if (!changed.count) return jsonError("Shipping rate not found", 404);
  await db.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "SHIPPING_RATE_UPDATED", entityType: "ShippingRate", entityId: rateId } });
  return NextResponse.json({ ok: true });
}
