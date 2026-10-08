import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { queueOrderNotice, notifyPaidOrder } from "@/lib/order-notifications";

const schema = z.object({ status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]), note: z.string().trim().max(2000).optional(), notifyCustomer: z.boolean().default(false) });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext(); if (!context) return jsonError("Forbidden", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Invalid support update", 400);
  if (parsed.data.notifyCustomer && !parsed.data.note) return jsonError("Write a response before notifying the customer", 400);
  const { requestId } = await params;
  const support = await db.orderSupportRequest.findFirst({ where: { id: requestId, storeId: context.store.id }, select: { id: true, orderId: true, replies:true } });
  if (!support) return jsonError("Request not found", 404);
  await db.$transaction(async tx => {
    await tx.orderSupportRequest.update({ where: { id: support.id }, data: { status: parsed.data.status, adminNote: parsed.data.note ?? null, ...(parsed.data.notifyCustomer?{replies:[...(Array.isArray(support.replies)?support.replies:[]),{message:parsed.data.note!,at:new Date().toISOString()}]}:{}) } });
    if (parsed.data.notifyCustomer) await queueOrderNotice(tx, support.orderId, `support:${support.id}:${Date.now()}`, "Support update", parsed.data.note!);
    await tx.auditLog.create({ data: { actorId: context.user.id, storeId: context.store.id, action: "ORDER_SUPPORT_UPDATED", entityType: "OrderSupportRequest", entityId: support.id, metadata: { status: parsed.data.status, notified: parsed.data.notifyCustomer } } });
  });
  if (parsed.data.notifyCustomer) await notifyPaidOrder(support.orderId);
  return NextResponse.json({ ok: true });
}
