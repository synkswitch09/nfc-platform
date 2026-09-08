import { NextRequest, NextResponse } from "next/server";
import { codeChallenge, createOAuthTransaction, getOAuthConfig, OAUTH_COOKIE, type OAuthProviderName } from "@/lib/oauth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: value } = await params;
  if (value !== "google" && value !== "apple") return NextResponse.json({ error: "Unsupported sign-in provider" }, { status: 404 });
  const provider = value as OAuthProviderName; const config = getOAuthConfig(provider);
  if (!config) return NextResponse.redirect(new URL("/login?oauth=unavailable", request.url));
  const transaction = createOAuthTransaction(provider, request.nextUrl.searchParams.get("next") ?? "/dashboard");
  const appUrl = process.env.APP_URL ?? request.nextUrl.origin; const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", scope: config.scope, state: transaction.value.state, nonce: transaction.value.nonce, code_challenge: codeChallenge(transaction.value.verifier), code_challenge_method: "S256", response_mode: provider === "apple" ? "form_post" : "query", ...(provider === "google" ? { prompt: "select_account" } : {}) }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, transaction.cookie, { httpOnly: true, secure: provider === "apple" || process.env.NODE_ENV === "production", sameSite: provider === "apple" ? "none" : "lax", path: "/api/auth/oauth", maxAge: 600 });
  return response;
}
