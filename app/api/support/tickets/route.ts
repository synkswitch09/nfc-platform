import { NextRequest, NextResponse } from "next/server";
import { getCurrentStorefront } from "@/lib/storefront";
import { supportIdentity, ticketOwner, supportOrderOwner } from "@/lib/support-access";
import { db } from "@/lib/db";
import { createSupportTicket, newTicketSchema, publicSupportTicket, SupportError } from "@/lib/support-service";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { dispatchSupportNotices } from "@/lib/support-notifications";
export async function GET() {
  const store = await getCurrentStorefront(), identity = await supportIdentity(store);
  if (!identity) return jsonError("Verify your email or sign in to access tickets", 401);
  const [tickets, orders] = await Promise.all([
    db.orderSupportRequest.findMany({ where: { storeId: store.id, ...ticketOwner(identity) }, include: { order: { select: { orderNumber: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.order.findMany({ where: { storeId: store.id, ...supportOrderOwner(identity), status: { notIn: ["PENDING", "PAYMENT_PENDING"] } }, select: { orderNumber: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ tickets: tickets.map(publicSupportTicket), orders }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront(), identity = await supportIdentity(store);
  if (!identity) return jsonError("Verify your email or sign in before submitting a ticket", 401);
  if (!(await rateLimit("support-create", `${store.id}:${identity.email}:${getClientIp(request)}`, 10, 3600000)).allowed) return jsonError("Too many requests", 429);
  const parsed = newTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a topic and write a message of 10–4000 characters", 400);
  try {
    const result = await createSupportTicket(store, identity, parsed.data);
    await dispatchSupportNotices(result.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return jsonError(error instanceof SupportError ? error.message : "Could not save your request. Please retry.", error instanceof SupportError ? error.status : 409); }
}
