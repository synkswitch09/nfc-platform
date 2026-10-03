import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { queueOrderNotice } from "@/lib/order-notifications";
import { projectQueue } from "@/lib/production-capacity";

const schema = z.object({ decision: z.enum(["KEEP", "UPDATE_AND_NOTIFY"]), expectedVersion: z.number().int().min(0) });
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context?.isPlatformAdmin) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid decision", 400);
  const environment = context.store.environment;
  try {
    const result = await db.$transaction(async tx => {
      const pool = await tx.productionPool.findUnique({ where: { environment } });
      if (!pool || pool.version !== parsed.data.expectedVersion) return null;
      const bookings = await tx.productionBooking.findMany({ where: { environment, releasedAt: null }, orderBy: [{ createdAt: "asc" }, { orderId: "asc" }] });
      const risk = projectQueue(bookings, pool.weeklyCapacityMinutes).filter(item => item.atRisk);
      const updated = await tx.productionPool.updateMany({ where: { environment, version: pool.version }, data: { reviewedAt: new Date(), version: { increment: 1 } } });
      if (!updated.count) return null;
      if (parsed.data.decision === "UPDATE_AND_NOTIFY") for (const booking of risk) {
        await tx.productionBooking.updateMany({ where: { orderId: booking.orderId, releasedAt: null }, data: { promisedAt: booking.recalculated } });
        await queueOrderNotice(tx, booking.orderId, `production-date:${booking.orderId}:${booking.recalculated.toISOString()}`, "Updated dispatch estimate", `We have updated the estimated dispatch date for your order to ${booking.recalculated.toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide" })}. We will email tracking when it ships.`);
      }
      await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "PRODUCTION_SCHEDULE_DECISION", entityType: "ProductionPool", entityId: context.store.id, metadata: { environment, decision: parsed.data.decision, affected: risk.length } } });
      return { affected: risk.length };
    }, { isolationLevel: "Serializable" });
    if (!result) return jsonError("The queue changed. Refresh and review the new dates", 409);
    return NextResponse.json(result);
  } catch { return jsonError("The queue changed. Refresh and try again", 409); }
}
