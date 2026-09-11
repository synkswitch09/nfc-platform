import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { createShipmentLabel, FulfilmentError } from "@/lib/fulfilment-service";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  try {
    const result = await createShipmentLabel((await params).orderId, context.store, context.user.id);
    return NextResponse.json({ shipment: result.shipment, created: result.created });
  } catch (error) {
    if (error instanceof FulfilmentError) return jsonError(error.message, error.status);
    return jsonError("Shipment label could not be created", 500);
  }
}
