import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/assistants/meta/security";
import { maintainGrowth } from "@/lib/assistants/growth/maintenance";
export async function POST(request: NextRequest) {
  const secret = process.env.AI_ASSISTANTS_MAINTENANCE_SECRET || "";
  if (
    secret.length < 32 ||
    !secureEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await maintainGrowth());
}
