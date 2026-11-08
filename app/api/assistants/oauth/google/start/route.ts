import { NextRequest, NextResponse } from "next/server";
import { codeChallenge, buildOAuthAuthorizationUrl } from "@/lib/oauth";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { assistantConfig, isAssistantHost } from "@/lib/assistants/config";
import { assistantGoogleConfig, assistantGoogleCallback, createAssistantGoogleTransaction, ASSISTANT_OAUTH_COOKIE, ASSISTANT_OAUTH_PATH } from "@/lib/assistants/google-oauth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!isAssistantHost(request.headers.get("host"))) return new NextResponse("Not found", { status: 404 });
  if (!(await rateLimit("assistant-google-start", getClientIp(request), 20, 15 * 60000)).allowed)
    return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });
  const { origin } = assistantConfig();
  try {
    const config = assistantGoogleConfig();
    if (!config) return NextResponse.redirect(new URL("/login?oauth=unavailable", origin));
    const transaction = createAssistantGoogleTransaction(origin, config.clientId, request.nextUrl.searchParams.get("next"));
    const authorization = buildOAuthAuthorizationUrl(config, { redirect_uri: assistantGoogleCallback(origin), response_type: "code", scope: config.scope,
      state: transaction.value.state, nonce: transaction.value.nonce, code_challenge: await codeChallenge(transaction.value.verifier), code_challenge_method: "S256", prompt: "select_account" });
    const response = NextResponse.redirect(authorization);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(ASSISTANT_OAUTH_COOKIE, transaction.cookie, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: ASSISTANT_OAUTH_PATH, maxAge: 600 });
    return response;
  } catch { return NextResponse.redirect(new URL("/login?oauth=unavailable", origin)); }
}
