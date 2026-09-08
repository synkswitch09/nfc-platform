import { NextRequest, NextResponse } from "next/server";
import { addressSchema } from "@/lib/address-validation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const parsed = addressSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid address");
  if (await db.address.count({ where: { userId: user.id } }) >= 10) return jsonError("You can save up to 10 addresses", 409);
  const address = await db.address.create({ data: { userId: user.id, ...parsed.data, label: parsed.data.label || null, line2: parsed.data.line2 || null } });
  return NextResponse.json({ address }, { status: 201 });
}
