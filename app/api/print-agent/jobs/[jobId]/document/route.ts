import { NextRequest, NextResponse } from "next/server";
import { FulfilmentError, readClaimedPrintDocument } from "@/lib/fulfilment-service";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const lease = request.headers.get("x-print-lease") ?? "";
  try {
    const document = await readClaimedPrintDocument(token, (await params).jobId, lease);
    return new NextResponse(Buffer.from(document.bytes), { headers: { "content-type": document.mimeType, "cache-control": "private, no-store", "content-disposition": "inline; filename=shipping-label.pdf" } });
  } catch (error) {
    if (error instanceof FulfilmentError) return jsonError(error.message, error.status);
    return jsonError("Label unavailable", 500);
  }
}
