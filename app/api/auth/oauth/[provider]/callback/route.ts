import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { exchangeOAuthCode, findOrCreateOAuthUser, getOAuthConfig, OAUTH_COOKIE, readOAuthTransaction, type OAuthProviderName } from "@/lib/oauth";
import { getCurrentStorefront } from "@/lib/storefront";

async function callback(request: NextRequest, providerValue: string, values: URLSearchParams) {
  const store = await getCurrentStorefront();
  const fallback = new URL("/login?oauth=failed", store.origin);
  if (providerValue !== "google" && providerValue !== "apple") return NextResponse.redirect(fallback);
  const provider = providerValue as OAuthProviderName; const transaction = readOAuthTransaction(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = values.get("code"); const state = values.get("state"); const error = values.get("error");
  if (!transaction || transaction.provider !== provider || transaction.storeId !== store.id || transaction.origin !== store.origin || !code || !state || state !== transaction.state || error) return clear(NextResponse.redirect(fallback));
  const config = getOAuthConfig(provider); if (!config) return clear(NextResponse.redirect(fallback));
  try {
    const callbackUrl = new URL(`${store.origin}/api/auth/oauth/${provider}/callback`); callbackUrl.search = values.toString();
    const claims = await exchangeOAuthCode(provider, callbackUrl, transaction.verifier, transaction.state, transaction.nonce);
    const user = await findOrCreateOAuthUser(config, claims, store.id);
    await createSession(user.id, store);
    return clear(NextResponse.redirect(new URL(transaction.next, store.origin)));
  } catch {
    return clear(NextResponse.redirect(fallback));
  }
}

function clear(response: NextResponse) { response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, path: "/api/auth/oauth", expires: new Date(0) }); return response; }

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  return callback(request, (await params).provider, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const form = await request.formData(); const values = new URLSearchParams();
  for (const [key, value] of form) if (typeof value === "string") values.set(key, value);
  return callback(request, (await params).provider, values);
}
