import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeConfig } from "@/lib/config";
import { reconcilePendingCheckouts } from "@/lib/checkout-reconciliation";
import { CheckoutError } from "@/lib/order-service";

export async function POST(request: NextRequest) {
  const secret = getRuntimeConfig().stripe.reconcileSecret;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cursor = z.string().uuid().optional().safeParse(request.nextUrl.searchParams.get("cursor") ?? undefined);
  if (!cursor.success) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  try { return NextResponse.json(await reconcilePendingCheckouts(cursor.data)); }
  catch (error) { return NextResponse.json({ error: "Checkout reconciliation unavailable" }, { status: error instanceof CheckoutError ? error.status : 500 }); }
}
