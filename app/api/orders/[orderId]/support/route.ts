import { NextRequest, NextResponse } from "next/server";
import { getCurrentStorefront } from "@/lib/storefront";
import { supportIdentity } from "@/lib/support-access";
import { createSupportTicket, newTicketSchema, SupportError } from "@/lib/support-service";
import { dispatchSupportNotices } from "@/lib/support-notifications";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront(), identity = await supportIdentity(store);
  if (!identity) return jsonError("Verify your email through Help & requests before submitting a request", 401);
  if (!(await rateLimit("support-create", `${store.id}:${identity.email}:${getClientIp(request)}`, 10, 3600000)).allowed) return jsonError("Too many requests", 429);
  const parsed = newTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a topic and write a message of 10–4000 characters", 400);
  try {
    const result = await createSupportTicket(store, identity, parsed.data, (await params).orderId);
    await dispatchSupportNotices(result.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return jsonError(error instanceof SupportError ? error.message : "Could not save your request. Please retry.", error instanceof SupportError ? error.status : 409); }
}
