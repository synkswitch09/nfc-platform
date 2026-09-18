import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { createEtsyReadinessState, EtsyError, type EtsyListingDefaults } from "@/lib/etsy";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({
  readinessState: z.enum(["ready_to_ship", "made_to_order"]),
  minProcessingTime: z.number().int().min(1).max(365),
  maxProcessingTime: z.number().int().min(1).max(365),
  processingTimeUnit: z.enum(["days", "weeks"]),
}).refine(value => value.maxProcessingTime >= value.minProcessingTime, { message: "Maximum processing time must be after the minimum", path: ["maxProcessingTime"] });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !(context.isPlatformAdmin || context.storeRole === "ADMIN")) return jsonError("Administrator access required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid Etsy processing profile");
  const connection = await db.marketplaceConnection.findFirst({ where: { storeId: context.store.id, kind: "ETSY", status: "ACTIVE" } });
  if (!connection) return jsonError("Connect Etsy first", 409);
  try {
    const readinessStateId = await createEtsyReadinessState(connection, parsed.data);
    const defaults = (connection.listingDefaults ?? {}) as EtsyListingDefaults;
    await db.$transaction([
      db.marketplaceConnection.update({ where: { id: connection.id }, data: { listingDefaults: { ...defaults, readinessStateId } } }),
      db.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ETSY_READINESS_CREATED", entityType: "MarketplaceConnection", entityId: connection.id, metadata: { readinessStateId, readinessState: parsed.data.readinessState, minProcessingTime: parsed.data.minProcessingTime, maxProcessingTime: parsed.data.maxProcessingTime, processingTimeUnit: parsed.data.processingTimeUnit } } }),
    ]);
    return NextResponse.json({ readinessStateId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create Etsy processing profile", error instanceof EtsyError ? error.status : 502);
  }
}
