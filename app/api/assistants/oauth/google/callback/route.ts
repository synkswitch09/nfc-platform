import { NextRequest, NextResponse } from "next/server";
import { exchangeConfiguredOAuthCode, findOrCreateOAuthUser } from "@/lib/oauth";
import { getClientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { assistantConfig, isAssistantHost } from "@/lib/assistants/config";
import { createAssistantSession } from "@/lib/assistants/auth";
import { assistantGoogleConfig, assistantGoogleCallback, readAssistantGoogleTransaction, assistantGoogleError, ASSISTANT_OAUTH_COOKIE, ASSISTANT_OAUTH_PATH } from "@/lib/assistants/google-oauth";
export const runtime = "nodejs";
function clear(response: NextResponse) {
  response.cookies.set(ASSISTANT_OAUTH_COOKIE, "", { httpOnly: true, path: ASSISTANT_OAUTH_PATH, expires: new Date(0), sameSite: "lax" });
  response.headers.set("Cache-Control", "no-store"); return response;
}
export async function GET(request: NextRequest) {
  if (!isAssistantHost(request.headers.get("host"))) return new NextResponse("Not found", { status: 404 });
  const { origin, launchEnabled } = assistantConfig();
  if (!(await rateLimit("assistant-google-callback", getClientIp(request), 30, 15 * 60000)).allowed)
    return clear(NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 }));
  try {
    const config = assistantGoogleConfig();
    if (!config) return clear(NextResponse.redirect(new URL("/login?oauth=unavailable", origin)));
    const transaction = readAssistantGoogleTransaction(request.cookies.get(ASSISTANT_OAUTH_COOKIE)?.value, origin, config.clientId);
    const values = request.nextUrl.searchParams;
    if (!transaction || values.has("error") || !values.get("code") || values.get("state") !== transaction.state)
      return clear(NextResponse.redirect(new URL("/login?oauth=failed", origin)));
    // Exchange a one-use code with PKCE, signed state and a matching ID-token nonce.
    const callback = new URL(assistantGoogleCallback(origin)); callback.search = values.toString();
    const claims = await exchangeConfiguredOAuthCode(config, callback, transaction.verifier, transaction.state, transaction.nonce);
    const user = await findOrCreateOAuthUser(config, claims, undefined, { allowCreate: launchEnabled });
    await createAssistantSession(user.id);
    return clear(NextResponse.redirect(new URL(user.emailVerifiedAt ? transaction.next : "/verify-email", origin)));
  } catch (error) { return clear(NextResponse.redirect(new URL(`/login?oauth=${assistantGoogleError(error)}`, origin))); }
}
