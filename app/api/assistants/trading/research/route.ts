import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tradingActor } from "@/lib/trading/auth";
import { tradingConfig } from "@/lib/trading/config";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { MarketError } from "@/lib/trading/connectors";
import { controlResearch, researchView, runResearchCycle } from "@/lib/trading/research/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await tradingActor(); if (!user) return jsonError("Not found", 404);
  return NextResponse.json(await researchView(user.id), { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await tradingActor(); if (!user) return jsonError("Not found", 404);
  if (!tradingConfig().enabled) return jsonError("Trading is disabled on this server.", 503);
  if (!(await rateLimit("trading-research", user.id, 5, 60000)).allowed) return jsonError("Please wait before retrying.", 429);
  try {
    const text = await request.text(); if (text.length > 1000) return jsonError("Request too large", 413);
    const body = z.object({ action: z.enum(["start", "pause", "run"]), capitalAud: z.number().min(50).max(100000).optional() }).strict().parse(JSON.parse(text));
    if (body.action === "run") return NextResponse.json(await runResearchCycle(user.id));
    await controlResearch(user.id, body.action, body.capitalAud);
    return NextResponse.json({ ok: true, message: body.action === "start" ? "Autonomous research enabled. The scheduled worker will run it." : "Research paused." });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return jsonError("Provide a valid virtual capital amount and action.");
    if (error instanceof MarketError) return jsonError(error.message, 409);
    return jsonError("Could not update research. Check server configuration.", 500);
  }
}
