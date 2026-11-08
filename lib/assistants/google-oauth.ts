import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import * as oidc from "openid-client";
import { requiredSecret } from "@/lib/crypto";
import { googleOAuthCredentials } from "@/lib/google-oauth-config";
import { oauthConfigWithCredentials } from "@/lib/oauth";
import { assistantConfig } from "./config";

export const ASSISTANT_OAUTH_COOKIE = "assistant_google_oauth";
export const ASSISTANT_OAUTH_PATH = "/api/assistants/oauth/google";
const transactionSchema = z.object({
  state: z.string().min(20).max(200), nonce: z.string().min(20).max(200),
  verifier: z.string().min(43).max(128), origin: z.url(), clientId: z.string().min(1),
  next: z.enum(["/account", "/ai-assistants", "/trading", "/account/integrations"]),
  expires: z.number().int().positive(),
}).strict();
type Transaction = z.infer<typeof transactionSchema>;
export function assistantGoogleConfig(env: Record<string, string | undefined> = process.env) {
  const explicitId = env.AI_ASSISTANTS_GOOGLE_CLIENT_ID?.trim();
  const explicitSecret = env.AI_ASSISTANTS_GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(explicitId) !== Boolean(explicitSecret)) return null;
  const credentials = explicitId && explicitSecret ? { clientId: explicitId, clientSecret: explicitSecret }
    : googleOAuthCredentials(env.AI_ASSISTANTS_EMAIL_STORE || "tapkin", env);
  return oauthConfigWithCredentials("google", credentials);
}
export function assistantGoogleReady() {
  try { return Boolean(assistantGoogleConfig()); } catch { return false; }
}
export function assistantGoogleCallback(origin = assistantConfig().origin) {
  return `${origin}${ASSISTANT_OAUTH_PATH}/callback`;
}
export function assistantOAuthNext(input: string | null | undefined): Transaction["next"] {
  return ["/account", "/ai-assistants", "/trading", "/account/integrations"].includes(input || "") ? input as Transaction["next"] : "/account";
}
function signature(payload: string) {
  // A separate signing domain and cookie keep assistant and storefront flows isolated.
  return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(`assistant-google-oauth:${payload}`).digest();
}
export function createAssistantGoogleTransaction(origin: string, clientId: string, next?: string | null, now = Date.now()) {
  const value: Transaction = { origin, clientId, next: assistantOAuthNext(next), state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(), expires: now + 600000 };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return { value, cookie: `${payload}.${signature(payload).toString("base64url")}` };
}
export function readAssistantGoogleTransaction(cookie: string | undefined, origin: string, clientId: string, now = Date.now()): Transaction | null {
  try {
    if (!cookie || cookie.length > 4000) return null;
    const parts = cookie.split("."); if (parts.length !== 2) return null;
    const [payload, supplied] = parts, expected = signature(payload), received = Buffer.from(supplied, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const parsed = transactionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.origin !== origin || parsed.data.clientId !== clientId || parsed.data.expires <= now || parsed.data.expires > now + 600000) return null;
    return parsed.data;
  } catch { return null; }
}
export function assistantGoogleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "VERIFY_EXISTING_EMAIL_FIRST") return "verify-existing";
  if (message === "REGISTRATION_CLOSED") return "registration-closed";
  return "failed";
}
