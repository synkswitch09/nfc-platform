import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  await destroySession();
  return NextResponse.json({ ok: true });
}
