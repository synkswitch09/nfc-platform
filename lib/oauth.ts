import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { AuthProvider, Prisma } from "@prisma/client";
import { createOpaqueToken, requiredSecret, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";

export type OAuthProviderName = "google" | "apple";
type OAuthConfig = { provider: AuthProvider; clientId: string; clientSecret: string; authorizeUrl: string; tokenUrl: string; jwksUrl: string; issuers: string[]; scope: string };
type OAuthTransaction = { provider: OAuthProviderName; state: string; nonce: string; verifier: string; next: string; expires: number };
type IdClaims = { sub: string; iss: string; aud: string | string[]; exp: number; iat?: number; nonce?: string; email?: string; email_verified?: boolean | string; name?: string };

export const OAUTH_COOKIE = "nfc_oauth";

export function getOAuthConfig(provider: OAuthProviderName): OAuthConfig | null {
  const prefix = provider === "google" ? "GOOGLE" : "APPLE";
  const clientId = process.env[`${prefix}_CLIENT_ID`]; const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return provider === "google"
    ? { provider: "GOOGLE", clientId, clientSecret, authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", jwksUrl: "https://www.googleapis.com/oauth2/v3/certs", issuers: ["https://accounts.google.com", "accounts.google.com"], scope: "openid email profile" }
    : { provider: "APPLE", clientId, clientSecret, authorizeUrl: "https://appleid.apple.com/auth/authorize", tokenUrl: "https://appleid.apple.com/auth/token", jwksUrl: "https://appleid.apple.com/auth/keys", issuers: ["https://appleid.apple.com"], scope: "openid email name" };
}

export function createOAuthTransaction(provider: OAuthProviderName, next: string) {
  const value: OAuthTransaction = { provider, state: createOpaqueToken(24), nonce: createOpaqueToken(24), verifier: createOpaqueToken(48), next: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", expires: Date.now() + 10 * 60_000 };
  return { value, cookie: sign(JSON.stringify(value)) };
}

export function readOAuthTransaction(cookie: string | undefined) {
  if (!cookie) return null;
  const [payload, signature] = cookie.split("."); if (!payload || !signature) return null;
  const expected = signatureFor(payload); const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthTransaction; return value.expires > Date.now() ? value : null; } catch { return null; }
}

export function codeChallenge(verifier: string) { return Buffer.from(sha256(verifier), "hex").toString("base64url"); }

function sign(value: string) { const payload = Buffer.from(value).toString("base64url"); return `${payload}.${signatureFor(payload).toString("base64url")}`; }
function signatureFor(payload: string) { return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(`oauth:${payload}`).digest(); }

export async function exchangeOAuthCode(provider: OAuthProviderName, code: string, verifier: string, redirectUri: string, nonce: string) {
  const config = getOAuthConfig(provider); if (!config) throw new Error("OAUTH_NOT_CONFIGURED");
  const response = await fetch(config.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, code_verifier: verifier }), cache: "no-store" });
  const token = await response.json().catch(() => null) as { id_token?: string } | null;
  if (!response.ok || !token?.id_token) throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
  return verifyIdToken(config, token.id_token, nonce);
}

async function verifyIdToken(config: OAuthConfig, token: string, nonce: string): Promise<IdClaims> {
  const parts = token.split("."); if (parts.length !== 3) throw new Error("INVALID_ID_TOKEN");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as IdClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("INVALID_ID_TOKEN");
  const response = await fetch(config.jwksUrl, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
  const keys = await response.json() as { keys?: Array<JsonWebKey & { kid?: string }> }; const jwk = keys.keys?.find(key => key.kid === header.kid);
  if (!jwk) throw new Error("UNKNOWN_SIGNING_KEY");
  const validSignature = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]; const now = Math.floor(Date.now() / 1000);
  if (!validSignature || !config.issuers.includes(claims.iss) || !audience.includes(config.clientId) || claims.exp <= now || (claims.iat && claims.iat > now + 60) || claims.nonce !== nonce) throw new Error("INVALID_ID_TOKEN");
  return claims;
}

export async function findOrCreateOAuthUser(config: OAuthConfig, claims: IdClaims) {
  const email = claims.email?.trim().toLowerCase(); const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!claims.sub || !email || !verified) throw new Error("VERIFIED_EMAIL_REQUIRED");
  try {
    return await db.$transaction(async tx => {
      const linked = await tx.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: config.provider, providerAccountId: claims.sub } }, include: { user: true } });
      if (linked) { if (linked.user.status !== "ACTIVE") throw new Error("ACCOUNT_DISABLED"); return linked.user; }
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing?.status !== undefined && existing.status !== "ACTIVE") throw new Error("ACCOUNT_DISABLED");
      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date() } })
        : await tx.user.create({ data: { email, name: claims.name?.trim().slice(0, 80) || email.split("@")[0], emailVerifiedAt: new Date() } });
      await tx.oAuthAccount.create({ data: { userId: user.id, provider: config.provider, providerAccountId: claims.sub, providerEmail: email, emailVerified: true } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "OAUTH_ACCOUNT_LINKED", entityType: "OAuthAccount", metadata: { provider: config.provider } } });
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const linked = await db.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: config.provider, providerAccountId: claims.sub } }, include: { user: true } });
      if (linked?.user.status === "ACTIVE") return linked.user;
    }
    throw error;
  }
}
