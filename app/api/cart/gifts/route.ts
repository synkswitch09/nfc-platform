import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStorefront, isStoreCommerceAvailable } from "@/lib/storefront";
import { cartGiftOffers } from "@/lib/cart-gift-offers";
const schema = z.object({ variantIds: z.array(z.string().uuid()).max(100) });
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("cart-gifts", getClientIp(request), 60, 60_000);
  if (!limited.allowed) return jsonError("Please try again in a moment", 429);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Invalid cart products");
  const store = await getCurrentStorefront();
  if (!isStoreCommerceAvailable(store)) return jsonError("Store unavailable", 404);
  const gifts = await cartGiftOffers(store.id, input.data.variantIds);
  return NextResponse.json({ gifts }, { headers: { "Cache-Control": "no-store" } });
}
