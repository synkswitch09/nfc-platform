import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completePrintJob, FulfilmentError } from "@/lib/fulfilment-service";
import { jsonError } from "@/lib/http";

const schema = z.object({ jobId: z.string().uuid(), leaseToken: z.string().min(32).max(200), success: z.boolean(), errorMessage: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid print result");
  try {
    return NextResponse.json(await completePrintJob(token, parsed.data.jobId, parsed.data.leaseToken, parsed.data.success, parsed.data.errorMessage));
  } catch (error) {
    if (error instanceof FulfilmentError) return jsonError(error.message, error.status);
    return jsonError("Print result could not be recorded", 500);
  }
}
