import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStorefront } from "@/lib/storefront";
import { getRuntimeConfig } from "@/lib/config";
import { assertSameOrigin, getClientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { suggestAustralianAddresses } from "@/lib/geoapify";

const querySchema = z.object({ text: z.string().trim().min(4).max(160) }).strict();
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const store = await getCurrentStorefront();
  const apiKey = getRuntimeConfig().geoapifyStores[store.slug]?.apiKey;
  if (!store.integrations?.geoapifyEnabled || !apiKey) return jsonError("Enter your address manually", 503);
  const body = await request.text();
  if (body.length > 1024) return jsonError("Request too large", 413);
  const parsed = querySchema.safeParse((() => { try { return JSON.parse(body); } catch { return null; } })());
  if (!parsed.success) return jsonError("Enter at least four characters of your Australian address");
  const client = await rateLimit("address-suggestions", `${store.id}:${getClientIp(request)}`, 60, 60_000);
  if (!client.allowed) return jsonError("Please enter your address manually or try again later", 429);
  // Shared credentials share this rolling allowance across both stores. No address text is logged.
  const budget = await rateLimit("geoapify-budget", apiKey, 2500, 86_400_000);
  if (!budget.allowed) return jsonError("Please enter your address manually", 429);
  try {
    return NextResponse.json({ suggestions: await suggestAustralianAddresses(parsed.data.text, apiKey) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return jsonError("Suggestions are unavailable. Enter your address manually.", 503); }
}
