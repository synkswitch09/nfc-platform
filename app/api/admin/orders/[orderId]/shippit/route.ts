import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { processShippitPreparations } from "@/lib/shippit-preparation";
import { db } from "@/lib/db";
import { FulfilmentError } from "@/lib/fulfilment-service";
import { ShippitError } from "@/lib/shippit";

const schema = z.object({ action: z.literal("retry") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid parcel");
  try {
    const orderId = (await params).orderId;
    const job = await db.shippitPreparation.findFirst({ where: { orderId, order: { storeId: context.store.id } } });
    if (!job) return jsonError("Automatic shipping preparation not found", 404);
    if (job.status === "REVIEW") return jsonError("Reconcile the existing Shippit parcel before retrying", 409);
    if (job.status === "FAILED") await db.shippitPreparation.updateMany({ where: { orderId, status: "FAILED" }, data: { status: "PENDING", attempts: 0, availableAt: new Date() } });
    await processShippitPreparations(orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FulfilmentError || error instanceof ShippitError) return jsonError(error.message, error.status);
    return jsonError("Shippit request needs reconciliation. Check the parcel reference in Shippit before trying again.", 502);
  }
}
