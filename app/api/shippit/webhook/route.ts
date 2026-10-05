import { NextRequest, NextResponse } from "next/server";
import { currentAppEnvironment } from "@/lib/config";
import { logEvent } from "@/lib/logger";
import { applyShippitWebhook, validShippitWebhookToken } from "@/lib/shippit-webhook";

export async function POST(request: NextRequest) {
  const environment = currentAppEnvironment();
  const expected = environment === "production" ? process.env.SHIPPIT_PRODUCTION_WEBHOOK_SECRET : environment === "staging" ? process.env.SHIPPIT_STAGING_WEBHOOK_SECRET : undefined;
  if (!validShippitWebhookToken(request.headers.get("x-shippit-webhook-token"), expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 });
  if (Number(request.headers.get("content-length")) > 64_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64_000) { await reader.cancel(); return NextResponse.json({ error: "Payload too large" }, { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const result = await applyShippitWebhook(payload, raw);
    logEvent("info", "shippit.webhook_processed", { outcome: result.outcome });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return NextResponse.json({ error: "Invalid tracking event" }, { status: 400 });
    logEvent("error", "shippit.webhook_failed");
    return NextResponse.json({ error: "Tracking update failed" }, { status: 500 });
  }
}
