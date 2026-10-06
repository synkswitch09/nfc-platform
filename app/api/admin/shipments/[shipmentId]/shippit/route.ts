import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { bookShippitParcel, refreshShippitLabel } from "@/lib/shippit-fulfilment";
import { FulfilmentError } from "@/lib/fulfilment-service";
import { ShippitError } from "@/lib/shippit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = z.object({ action: z.enum(["label", "book"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid shipment action");
  try {
    const shipment = parsed.data.action === "label" ? await refreshShippitLabel((await params).shipmentId, context.store.id, context.user.id) : await bookShippitParcel((await params).shipmentId, context.store.id, context.user.id);
    return NextResponse.json({ shipment });
  } catch (error) {
    if (error instanceof FulfilmentError || error instanceof ShippitError) return jsonError(error.message, error.status);
    return jsonError("Shippit action could not be confirmed. Check Shippit before trying again.", 502);
  }
}
