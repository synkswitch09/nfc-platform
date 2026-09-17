import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ syncEnabled: z.boolean() });

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid Etsy settings");
  const connection = await db.marketplaceConnection.updateMany({ where: { storeId: context.store.id, kind: "ETSY" }, data: parsed.data });
  if (!connection.count) return jsonError("Connect Etsy first", 409);
  await db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_SETTINGS_UPDATED", entityType: "MarketplaceConnection", metadata: { syncEnabled: parsed.data.syncEnabled } } });
  return NextResponse.json({ ok: true });
}
