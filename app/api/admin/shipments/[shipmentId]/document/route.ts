import { NextResponse } from "next/server";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/storage";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const shipment = await db.shipment.findFirst({ where: { id: (await params).shipmentId, storeId: context.store.id } });
  if (!shipment?.labelStorageKey) return jsonError("Label not found", 404);
  const bytes = await getStorageProvider().get(shipment.labelStorageKey);
  if (!bytes) return jsonError("Label not found", 404);
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="label-${shipment.id}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
