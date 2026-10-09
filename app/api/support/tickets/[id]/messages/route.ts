import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";
import { supportIdentity, ticketOwner } from "@/lib/support-access";
import { followupSchema, internalSupportAlert } from "@/lib/support-service";
import { dispatchSupportNotices } from "@/lib/support-notifications";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront(), identity = await supportIdentity(store), { id } = await params;
  if (!identity) return jsonError("Verify your email or sign in", 401);
  if (!(await rateLimit("support-followup", `${store.id}:${identity.email}:${getClientIp(request)}`, 20, 3600000)).allowed) return jsonError("Too many messages", 429);
  const parsed = followupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Write a message of 2–4000 characters", 400);
  const result = await db.$transaction(async tx => {
    const locked = await tx.orderSupportRequest.updateMany({ where: { id, storeId: store.id, ...ticketOwner(identity) }, data: { updatedAt: new Date() } });
    if (!locked.count) return false;
    const ticket = await tx.orderSupportRequest.findUniqueOrThrow({ where: { id } });
    const messageId = randomUUID();
    await tx.orderSupportRequest.update({ where: { id }, data: { status: "OPEN", replies: [...(Array.isArray(ticket.replies) ? ticket.replies : []), { id: messageId, author: "customer", message: parsed.data.message, at: new Date().toISOString() }] } });
    await internalSupportAlert(tx, store, id, messageId, ticket.holdActive);
    await tx.auditLog.create({ data: { actorId: identity.userId, storeId: store.id, action: "SUPPORT_CUSTOMER_FOLLOWUP", entityType: "OrderSupportRequest", entityId: id } });
    return true;
  });
  if (!result) return jsonError("Ticket not found", 404);
  await dispatchSupportNotices(id);
  return NextResponse.json({ ok: true });
}
