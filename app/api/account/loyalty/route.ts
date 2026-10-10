import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCurrentStorefront } from "@/lib/storefront";
import { loyaltyAccount } from "@/lib/loyalty";
import { parseLoyaltyConfig } from "@/lib/loyalty-config";
import { jsonError } from "@/lib/http";
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Sign in to view points", 401);
  if (!user.emailVerifiedAt) return jsonError("Verify your email to access points", 403);
  const store = await getCurrentStorefront();
  const account = await loyaltyAccount(user, store.id);
  return NextResponse.json({ ...account, config: { ...parseLoyaltyConfig(store.accountConfig), enabled: parseLoyaltyConfig(store.accountConfig).enabled && store.currency === "AUD" } }, { headers: { "Cache-Control": "no-store" } });
}
