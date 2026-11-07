import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { tradingConfig } from "@/lib/trading/config";
import { runTradingCycle } from "@/lib/trading/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const expected = process.env.TRADING_WORKER_SECRET || process.env.CHECKOUT_RECONCILE_SECRET || "";
  if (expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = tradingConfig();
  if (!c.enabled || !c.ownerId) return NextResponse.json({ skipped: "trading-disabled" });
  try { return NextResponse.json(await runTradingCycle(c.ownerId)); }
  catch { return NextResponse.json({ error: "Paper trading cycle failed; no live orders are supported." }, { status: 500 }); }
}
