import { NextRequest, NextResponse } from "next/server";
import { buildOAuthAuthorizationUrl, codeChallenge, createOAuthTransaction, getOAuthConfig, OAUTH_COOKIE, type OAuthProviderName } from "@/lib/oauth";
import { oauthCallbackUrl } from "@/lib/config";
import { getCurrentStorefront } from "@/lib/storefront";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: value } = await params;
  if (value !== "google" && value !== "apple") return NextResponse.json({ error: "Unsupported sign-in provider" }, { status: 404 });
  const provider = value as OAuthProviderName; const config = getOAuthConfig(provider);
  if (!config) return NextResponse.redirect(new URL("/login?oauth=unavailable", request.url));
  const store = await getCurrentStorefront();
  const transaction = createOAuthTransaction(provider, request.nextUrl.searchParams.get("next") ?? "/dashboard", store);
  const redirectUri = oauthCallbackUrl(provider, { appUrl: store.origin });
  const url = buildOAuthAuthorizationUrl(config, { redirect_uri: redirectUri, response_type: "code", scope: config.scope, state: transaction.value.state, nonce: transaction.value.nonce, code_challenge: await codeChallenge(transaction.value.verifier), code_challenge_method: "S256", response_mode: provider === "apple" ? "form_post" : "query", ...(provider === "google" ? { prompt: "select_account" } : {}) });
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, transaction.cookie, { httpOnly: true, secure: provider === "apple" || store.origin.startsWith("https://"), sameSite: provider === "apple" ? "none" : "lax", path: "/api/auth/oauth", maxAge: 600 });
  return response;
}
