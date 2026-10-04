import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { createShippitParcel } from "@/lib/shippit-fulfilment";
import { FulfilmentError } from "@/lib/fulfilment-service";
import { ShippitError } from "@/lib/shippit";

const schema = z.object({ requestId: z.uuid(), service: z.enum(["standard", "express"]), parcel: z.object({ weightGrams: z.number().int().min(1).max(30000), lengthMm: z.number().int().min(1).max(1000), widthMm: z.number().int().min(1).max(1000), heightMm: z.number().int().min(1).max(1000) }) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid parcel");
  try {
    const shipment = await createShippitParcel((await params).orderId, context.store.id, context.user.id, parsed.data.parcel, parsed.data.service, parsed.data.requestId);
    return NextResponse.json({ shipment });
  } catch (error) {
    if (error instanceof FulfilmentError || error instanceof ShippitError) return jsonError(error.message, error.status);
    return jsonError("Shippit request needs reconciliation. Check the parcel reference in Shippit before trying again.", 502);
  }
}
