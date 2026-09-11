import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context || context.user.role !== "ADMIN") return jsonError("Administrator access required", 403); const { user: actor, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid account status");
  const { userId } = await params;
  if (userId === actor.id && parsed.data.status !== "ACTIVE") return jsonError("You cannot suspend your own account", 409);
  const target = await db.user.findFirst({ where: { id: userId, storeMemberships: { some: { storeId: store.id } } }, select: { role: true, status: true } });
  if (!target) return jsonError("Customer not found", 404);
  if (target.role !== "CUSTOMER") return jsonError("Staff access cannot be changed from the customer screen", 409);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: parsed.data.status } }),
    db.session.deleteMany({ where: { userId } }),
    db.auditLog.create({ data: { actorId: actor.id, storeId: store.id, action: "CUSTOMER_STATUS_CHANGED", entityType: "User", entityId: userId, metadata: { from: target.status, to: parsed.data.status } } }),
  ]);
  return NextResponse.json({ ok: true });
}
