import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const actor = await getCurrentUser(); if (!actor || actor.role !== "ADMIN") return jsonError("Administrator access required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid role");
  const { userId } = await params; if (userId === actor.id && parsed.data.role !== "ADMIN") return jsonError("You cannot remove your own administrator access", 409);
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, emailVerifiedAt: true, status: true } }); if (!target) return jsonError("User not found", 404);
  if (!target.emailVerifiedAt || target.status !== "ACTIVE") return jsonError("Only active, verified users can join the operations team", 409);
  await db.$transaction([db.user.update({ where: { id: userId }, data: { role: parsed.data.role } }), db.session.deleteMany({ where: { userId } }), db.auditLog.create({ data: { actorId: actor.id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { from: target.role, to: parsed.data.role } } })]);
  return NextResponse.json({ ok: true });
}
