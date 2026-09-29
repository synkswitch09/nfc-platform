import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(100), countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(250), states: z.array(z.string().trim().min(1).max(100)).max(200), priority: z.number().int().min(-10_000).max(10_000), active: z.boolean() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ zoneId: string }> }) { if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403); const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid shipping zone"); const { zoneId } = await params; const updated = await db.shippingZone.updateMany({ where: { id: zoneId, storeId: context.store.id }, data: parsed.data }); if (!updated.count) return jsonError("Shipping zone not found", 404); await db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "SHIPPING_ZONE_UPDATED", entityType: "ShippingZone", entityId: zoneId, metadata: { countries: parsed.data.countries, active: parsed.data.active } } }); return NextResponse.json({ ok: true }); }
