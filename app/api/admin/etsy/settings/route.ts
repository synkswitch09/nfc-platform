import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const listingDefaultsSchema = z.object({
  taxonomyId: z.string().trim().regex(/^\d+$/, "Use the numeric Etsy taxonomy ID"),
  shippingProfileId: z.string().trim().regex(/^\d+$/, "Use the numeric Etsy shipping profile ID"),
  readinessStateId: z.string().trim().regex(/^\d+$/, "Use the numeric Etsy processing profile ID"),
  whoMade: z.enum(["i_did", "collective", "someone_else"]),
  whenMade: z.string().trim().min(1).max(60),
  isSupply: z.boolean().default(false),
  shouldAutoRenew: z.boolean().default(true),
});
const schema = z.object({ syncEnabled: z.boolean(), listingDefaults: listingDefaultsSchema });

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid Etsy settings");
  const connection = await db.marketplaceConnection.updateMany({ where: { storeId: context.store.id, kind: "ETSY" }, data: parsed.data });
  if (!connection.count) return jsonError("Connect Etsy first", 409);
  await db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_SETTINGS_UPDATED", entityType: "MarketplaceConnection", metadata: { syncEnabled: parsed.data.syncEnabled, listingDefaultsConfigured: true } } });
  return NextResponse.json({ ok: true });
}
