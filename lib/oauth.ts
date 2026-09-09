import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthProvider, Prisma } from "@prisma/client";
import * as oidc from "openid-client";
import { requiredSecret } from "@/lib/crypto";
import { db } from "@/lib/db";

export type OAuthProviderName = "google" | "apple";
type OAuthConfig = { provider: AuthProvider; clientId: string; client: oidc.Configuration; scope: string };
type OAuthTransaction = { provider: OAuthProviderName; state: string; nonce: string; verifier: string; next: string; expires: number };
type VerifiedClaims = { sub: string; email?: string; email_verified?: boolean | string; name?: string };

export const OAUTH_COOKIE = "nfc_oauth";

export function getOAuthConfig(provider: OAuthProviderName): OAuthConfig | null {
  const prefix = provider === "google" ? "GOOGLE" : "APPLE";
  const clientId = process.env[`${prefix}_CLIENT_ID`]; const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  const server = provider === "google"
    ? { issuer: "https://accounts.google.com", authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth", token_endpoint: "https://oauth2.googleapis.com/token", jwks_uri: "https://www.googleapis.com/oauth2/v3/certs" }
    : { issuer: "https://appleid.apple.com", authorization_endpoint: "https://appleid.apple.com/auth/authorize", token_endpoint: "https://appleid.apple.com/auth/token", jwks_uri: "https://appleid.apple.com/auth/keys" };
  return { provider: provider === "google" ? "GOOGLE" : "APPLE", clientId, client: new oidc.Configuration(server, clientId, clientSecret), scope: provider === "google" ? "openid email profile" : "openid email name" };
}

export function createOAuthTransaction(provider: OAuthProviderName, next: string) {
  const value: OAuthTransaction = { provider, state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(), next: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", expires: Date.now() + 10 * 60_000 };
  return { value, cookie: sign(JSON.stringify(value)) };
}

export function readOAuthTransaction(cookie: string | undefined) {
  if (!cookie) return null;
  const parts = cookie.split("."); if (parts.length !== 2) return null;
  const [payload, signature] = parts; if (!payload || !signature) return null;
  const expected = Buffer.from(signatureFor(payload).toString("base64url")); const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthTransaction; return value.expires > Date.now() ? value : null; } catch { return null; }
}

export function codeChallenge(verifier: string) { return oidc.calculatePKCECodeChallenge(verifier); }
export function buildOAuthAuthorizationUrl(config: OAuthConfig, parameters: Record<string, string>) { return oidc.buildAuthorizationUrl(config.client, parameters); }

function sign(value: string) { const payload = Buffer.from(value).toString("base64url"); return `${payload}.${signatureFor(payload).toString("base64url")}`; }
function signatureFor(payload: string) { return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(`oauth:${payload}`).digest(); }

export async function exchangeOAuthCode(provider: OAuthProviderName, callbackUrl: URL, verifier: string, state: string, nonce: string) {
  const config = getOAuthConfig(provider); if (!config) throw new Error("OAUTH_NOT_CONFIGURED");
  const tokens = await oidc.authorizationCodeGrant(config.client, callbackUrl, { pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce });
  const claims = tokens.claims(); if (!claims) throw new Error("ID_TOKEN_REQUIRED");
  return claims as VerifiedClaims;
}

export async function findOrCreateOAuthUser(config: OAuthConfig, claims: VerifiedClaims) {
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
