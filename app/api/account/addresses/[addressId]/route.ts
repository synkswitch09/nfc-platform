import { NextRequest, NextResponse } from "next/server";
import { addressSchema } from "@/lib/address-validation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const parsed = addressSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid address");
  const { addressId } = await params; const updated = await db.address.updateMany({ where: { id: addressId, userId: user.id }, data: { ...parsed.data, label: parsed.data.label || null, line2: parsed.data.line2 || null } });
  if (!updated.count) return jsonError("Address not found", 404); return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const { addressId } = await params; const removed = await db.address.deleteMany({ where: { id: addressId, userId: user.id } });
  if (!removed.count) return jsonError("Address not found", 404); return NextResponse.json({ ok: true });
}
