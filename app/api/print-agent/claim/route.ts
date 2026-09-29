import { NextRequest, NextResponse } from "next/server";
import { claimPrintJob, FulfilmentError } from "@/lib/fulfilment-service";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    const job = await claimPrintJob(token);
    return job ? NextResponse.json({ job }) : new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof FulfilmentError) return jsonError(error.message, error.status);
    return jsonError("Print queue unavailable", 500);
  }
}
