import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createShippingQuotes, ShippingError } from "@/lib/shipping-service";
import { getCurrentStorefront, isStoreCommerceAvailable } from "@/lib/storefront";
import { shippingQuoteSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const limited = await rateLimit("shipping-quote", getClientIp(request), 40, 60 * 60 * 1000);
  if (!limited.allowed) return jsonError("Too many shipping quote requests. Try again later.", 429);
  const parsed = shippingQuoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid delivery details");
  const store = await getCurrentStorefront();
  if (!isStoreCommerceAvailable(store)) return jsonError("This store is not accepting orders", 409);
  try {
    const quotes = await createShippingQuotes(parsed.data.items, parsed.data.destination, store);
    return NextResponse.json({ quotes });
  } catch (error) {
    if (error instanceof ShippingError) return jsonError(error.message, error.status);
    return jsonError("Delivery rates could not be calculated", 500);
  }
}
