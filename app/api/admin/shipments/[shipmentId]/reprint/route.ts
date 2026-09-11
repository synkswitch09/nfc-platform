import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { FulfilmentError, queueShipmentReprint } from "@/lib/fulfilment-service";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context) return jsonError("Forbidden", 403);
  try {
    const job = await queueShipmentReprint((await params).shipmentId, context.store.id, context.user.id);
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof FulfilmentError) return jsonError(error.message, error.status);
    return jsonError("Reprint could not be queued", 500);
  }
}
