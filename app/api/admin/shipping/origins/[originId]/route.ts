import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100), senderName: z.string().trim().min(2).max(100),
  company: z.string().trim().max(100).nullable(), line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).nullable(), suburb: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(10), postcode: z.string().trim().min(3).max(12),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  phone: z.string().trim().max(30).nullable(), email: z.string().trim().email().nullable(),
  active: z.boolean(), isDefault: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ originId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid origin", 400);
  const { originId } = await params;
  const origin = await db.shippingOrigin.findFirst({ where: { id: originId, storeId: context!.store.id } });
  if (!origin) return jsonError("Origin not found", 404);
  if (parsed.data.isDefault && !parsed.data.active) return jsonError("The default origin must stay active", 400);
  if (origin.isDefault && !parsed.data.isDefault && await db.shippingOrigin.count({ where: { storeId: context!.store.id, active: true, isDefault: true, id: { not: originId } } }) === 0) return jsonError("Choose another default origin first", 400);
  try {
    await db.$transaction(async tx => {
      if (parsed.data.isDefault) await tx.shippingOrigin.updateMany({ where: { storeId: context!.store.id, id: { not: originId } }, data: { isDefault: false } });
      await tx.shippingOrigin.update({ where: { id: originId }, data: parsed.data });
      await tx.auditLog.create({ data: { actorId: context!.user.id, storeId: context!.store.id, action: "SHIPPING_ORIGIN_UPDATED", entityType: "ShippingOrigin", entityId: originId } });
    });
  } catch { return jsonError("Origin could not be saved. Check its name and address.", 409); }
  return NextResponse.json({ ok: true });
}
