import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ active: z.boolean() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) { if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403); const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid provider state"); const { providerId } = await params; const updated = await db.shippingProvider.updateMany({ where: { id: providerId, storeId: context.store.id }, data: parsed.data }); if (!updated.count) return jsonError("Shipping provider not found", 404); await db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "SHIPPING_PROVIDER_UPDATED", entityType: "ShippingProvider", entityId: providerId, metadata: parsed.data } }); return NextResponse.json({ ok: true }); }
