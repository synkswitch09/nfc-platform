import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { tradingActor } from "@/lib/trading/auth";
import { readiness, tradingConfig } from "@/lib/trading/config";
import { checkConnection, MarketError } from "@/lib/trading/connectors";
import { controlBot, createReport, runTradingCycle, tradingView, updateFx, updateSettings } from "@/lib/trading/service";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await tradingActor();
  if (!user) return jsonError("Not found", 404);
  return NextResponse.json({ ...(await tradingView(user.id)), readiness: readiness() }, { headers: { "Cache-Control": "private, no-store" } });
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), settings: z.unknown() }).strict(),
  z.object({ action: z.literal("fx"), fx: z.unknown() }).strict(),
  z.object({ action: z.literal("connection"), provider: z.enum(["BINANCE", "IBKR"]) }).strict(),
  z.object({ action: z.enum(["start", "stop", "pause-entries", "resume-entries", "close-paper", "cycle", "report"]) }).strict(),
]);
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await tradingActor();
  if (!user) return jsonError("Not found", 404);
  if (!tradingConfig().enabled) return jsonError("Trading is disabled. Set TRADING_ENABLED=true to use the private module.", 503);
  if (!(await rateLimit("trading-action", user.id, 12, 60000)).allowed) return jsonError("Too many requests. Retry shortly.", 429);
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 24000) return jsonError("Request too large", 413);
    const data = actionSchema.parse(JSON.parse(body));
    if (data.action === "settings") await updateSettings(user.id, data.settings);
    else if (data.action === "fx") await updateFx(user.id, data.fx);
    else if (data.action === "connection") return NextResponse.json(await checkConnection(data.provider), { headers: { "Cache-Control": "private, no-store" } });
    else if (data.action === "cycle") return NextResponse.json(await runTradingCycle(user.id, true));
    else if (data.action === "report") return NextResponse.json(await createReport(user.id));
    else await controlBot(user.id, data.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("\n"));
    if (error instanceof MarketError) return jsonError(error.message, 409);
    return jsonError("Could not complete this action. Check configuration and server logs.", 500);
  }
}
