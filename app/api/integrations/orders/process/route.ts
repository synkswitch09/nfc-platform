import { processMeasurementDeliveries } from "@/lib/measurement";
import { processSupportNotifications } from "@/lib/support-notifications";
import { processShippitPreparations } from "@/lib/shippit-preparation";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";
import { processPendingRefunds } from "@/lib/refunds";
import { processOrderNotifications } from "@/lib/order-notifications";

export async function POST(request: NextRequest) {
  const secret = getRuntimeConfig().stripe.reconcileSecret;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Keep the queues independent: one provider failing must not starve the other queue.
  const [refunds, notifications, shipping, support, measurement] = await Promise.allSettled([processPendingRefunds(), processOrderNotifications(), processShippitPreparations(), processSupportNotifications(), processMeasurementDeliveries()]);
  return NextResponse.json({ measurement: measurement.status === "fulfilled" ? measurement.value : { error: "retry_required" }, support: support.status === "fulfilled" ? support.value : { error: "retry_required" }, shipping: shipping.status === "fulfilled" ? shipping.value : { error: "retry_required" }, refunds: refunds.status === "fulfilled" ? refunds.value : { error: "retry_required" }, notifications: notifications.status === "fulfilled" ? notifications.value : { error: "retry_required" } });
}
