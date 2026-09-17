import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MarketplaceConnectionStatus, MarketplaceKind, MarketplaceSyncJobStatus, MarketplaceSyncJobType, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret, requiredSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/config";
import { availableInventory } from "@/lib/catalog";

export const ETSY_OAUTH_COOKIE = "etsy_connect";
const ETSY_API = "https://api.etsy.com/v3";
const ETSY_SCOPES = ["shops_r", "listings_r", "listings_w", "transactions_r"];
const MAX_ATTEMPTS = 5;

export type EtsyListingDefaults = {
  shippingProfileId?: string;
  readinessStateId?: string;
  taxonomyId?: string;
  whoMade?: "i_did" | "collective" | "someone_else";
  whenMade?: string;
  isSupply?: boolean;
  shouldAutoRenew?: boolean;
};

type EtsyOAuthTransaction = { storeId: string; userId: string; state: string; verifier: string; expiresAt: number };
type EtsyToken = { access_token: string; refresh_token: string; expires_in: number; scope?: string };
type EtsyConnection = { id: string; shopId: string | null; accessTokenEncrypted: string | null; refreshTokenEncrypted: string | null; tokenExpiresAt: Date | null; status: MarketplaceConnectionStatus };

export class EtsyError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function isEtsyConfigured() {
  const config = getRuntimeConfig().etsy;
  return Boolean(config.apiKey && config.sharedSecret);
}

export function etsyCallbackUrl() { return `${getRuntimeConfig().appUrl}/api/admin/etsy/callback`; }

export function codeChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }

function sign(value: string) { return createHmac("sha256", requiredSecret("SESSION_SECRET")).update(value).digest("base64url"); }

export function createEtsyOAuthTransaction(storeId: string, userId: string) {
  const value: EtsyOAuthTransaction = { storeId, userId, state: randomBytes(32).toString("base64url"), verifier: randomBytes(48).toString("base64url"), expiresAt: Date.now() + 10 * 60_000 };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return { value, cookie: `${payload}.${sign(payload)}` };
}

export function readEtsyOAuthTransaction(cookie: string | undefined): EtsyOAuthTransaction | null {
  if (!cookie) return null;
  const [payload, signature, ...rest] = cookie.split(".");
  if (!payload || !signature || rest.length) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EtsyOAuthTransaction;
    return value.storeId && value.userId && value.state && value.verifier && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}

export function etsyAuthorizationUrl(transaction: EtsyOAuthTransaction) {
  const apiKey = getRuntimeConfig().etsy.apiKey;
  if (!apiKey) throw new EtsyError("Etsy is not configured", 503);
  const url = new URL("https://www.etsy.com/oauth/connect");
  url.search = new URLSearchParams({ response_type: "code", client_id: apiKey, redirect_uri: etsyCallbackUrl(), scope: ETSY_SCOPES.join(" "), state: transaction.state, code_challenge: codeChallenge(transaction.verifier), code_challenge_method: "S256" }).toString();
  return url.toString();
}

function tokenError(response: Response, body: unknown) {
  const detail = typeof body === "object" && body && "error_description" in body && typeof body.error_description === "string" ? body.error_description : "Etsy authorization failed";
  return new EtsyError(detail.slice(0, 300), response.status);
}

async function requestToken(body: URLSearchParams): Promise<EtsyToken> {
  const response = await fetch(`${ETSY_API}/public/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.access_token || !result?.refresh_token || typeof result.expires_in !== "number") throw tokenError(response, result);
  return result as EtsyToken;
}

export async function exchangeEtsyAuthorizationCode(code: string, verifier: string) {
  const apiKey = getRuntimeConfig().etsy.apiKey;
  if (!apiKey) throw new EtsyError("Etsy is not configured", 503);
  return requestToken(new URLSearchParams({ grant_type: "authorization_code", client_id: apiKey, redirect_uri: etsyCallbackUrl(), code, code_verifier: verifier }));
}

async function refreshEtsyAccessToken(connection: EtsyConnection) {
  const apiKey = getRuntimeConfig().etsy.apiKey;
  if (!apiKey || !connection.refreshTokenEncrypted) throw new EtsyError("Etsy needs to be reconnected", 401);
  let refreshToken: string;
  try { refreshToken = decryptSecret(connection.refreshTokenEncrypted); } catch { throw new EtsyError("Etsy credentials can no longer be decrypted; reconnect Etsy", 401); }
  const token = await requestToken(new URLSearchParams({ grant_type: "refresh_token", client_id: apiKey, refresh_token: refreshToken }));
  const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);
  await db.marketplaceConnection.update({ where: { id: connection.id }, data: { accessTokenEncrypted: encryptSecret(token.access_token), refreshTokenEncrypted: encryptSecret(token.refresh_token), tokenExpiresAt, scopes: token.scope?.split(" ").filter(Boolean) ?? undefined, status: "ACTIVE", lastError: null } });
  return token.access_token;
}

export async function getEtsyAccessToken(connection: EtsyConnection) {
  if (connection.status === "DISCONNECTED") throw new EtsyError("Etsy is disconnected", 409);
  if (connection.accessTokenEncrypted && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) {
    try { return decryptSecret(connection.accessTokenEncrypted); } catch { /* refresh below */ }
  }
  try { return await refreshEtsyAccessToken(connection); }
  catch (error) {
    await db.marketplaceConnection.update({ where: { id: connection.id }, data: { status: "EXPIRED", lastError: error instanceof Error ? error.message.slice(0, 500) : "Etsy token refresh failed" } }).catch(() => undefined);
    throw error;
  }
}

async function etsyRequest<T>(connection: EtsyConnection, path: string, init: RequestInit = {}) {
  const config = getRuntimeConfig().etsy;
  if (!config.apiKey || !config.sharedSecret) throw new EtsyError("Set ETSY_API_KEY and ETSY_SHARED_SECRET before connecting Etsy", 503);
  const accessToken = await getEtsyAccessToken(connection);
  const response = await fetch(`${ETSY_API}${path}`, { ...init, headers: { "x-api-key": `${config.apiKey}:${config.sharedSecret}`, authorization: `Bearer ${accessToken}`, accept: "application/json", ...init.headers }, cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof result === "object" && result && "error" in result && typeof result.error === "string" ? result.error : `Etsy request failed (${response.status})`;
    throw new EtsyError(detail.slice(0, 500), response.status);
  }
  return result as T;
}

export async function getEtsyShops(connection: EtsyConnection, sellerId: string) {
  return etsyRequest<{ results?: Array<{ shop_id?: number | string; shop_name?: string }> }>(connection, `/application/users/${encodeURIComponent(sellerId)}/shops`);
}

type RemoteOffering = { quantity?: number; price?: number | string; is_enabled?: boolean; [key: string]: unknown };
type RemoteInventoryProduct = { sku?: string; offerings?: RemoteOffering[]; [key: string]: unknown };
type RemoteInventory = { products?: RemoteInventoryProduct[]; [key: string]: unknown };
type LocalVariant = { sku: string; priceCents: number; inventory: number; reservedInventory: number; active: boolean; trackInventory: boolean; backorderPolicy: "DENY" | "ALLOW" };

export function buildEtsyInventoryPayload(remote: RemoteInventory, variants: LocalVariant[]) {
  const active = variants.filter(variant => variant.active);
  if (!active.length) throw new EtsyError("The product has no active variants to sync", 409);
  if (active.some(variant => !variant.trackInventory)) throw new EtsyError("All Etsy variants must have inventory tracking enabled", 409);
  const remoteProducts = remote.products ?? [];
  const bySku = new Map(remoteProducts.map(product => [product.sku, product]));
  const missing = active.filter(variant => !bySku.has(variant.sku)).map(variant => variant.sku);
  const unexpected = remoteProducts.filter(product => product.sku && !active.some(variant => variant.sku === product.sku)).map(product => product.sku);
  if (missing.length || unexpected.length) throw new EtsyError(`Etsy SKU mapping must match this product exactly${missing.length ? `; missing: ${missing.join(", ")}` : ""}${unexpected.length ? `; extra: ${unexpected.join(", ")}` : ""}`, 409);
  const products = remoteProducts.map(product => {
    const variant = active.find(item => item.sku === product.sku)!;
    const quantity = availableInventory(variant);
    return { ...product, offerings: (product.offerings ?? []).map(offering => ({ ...offering, quantity, price: Number((variant.priceCents / 100).toFixed(2)), is_enabled: variant.active && (quantity > 0 || variant.backorderPolicy === "ALLOW") })) };
  });
  return { ...remote, products };
}

export async function verifyEtsyListing(connection: EtsyConnection, externalId: string, variants: LocalVariant[]) {
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing; reconnect Etsy", 409);
  const inventory = await etsyRequest<RemoteInventory>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}/inventory`);
  buildEtsyInventoryPayload(inventory, variants);
  const listing = await etsyRequest<{ url?: string; state?: string }>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}`);
  return { externalUrl: listing.url ?? null, state: listing.state ?? null };
}

export async function queueEtsyInventorySync(tx: Prisma.TransactionClient, storeId: string, productId: string) {
  const listings = await tx.marketplaceListing.findMany({ where: { productId, connection: { storeId, kind: MarketplaceKind.ETSY, status: MarketplaceConnectionStatus.ACTIVE, syncEnabled: true } }, select: { id: true, connectionId: true } });
  for (const listing of listings) {
    const dedupeKey = `etsy:${listing.connectionId}:inventory:${listing.id}`;
    await tx.marketplaceSyncJob.upsert({ where: { dedupeKey }, create: { connectionId: listing.connectionId, listingId: listing.id, type: MarketplaceSyncJobType.INVENTORY, dedupeKey, payload: {} }, update: { status: MarketplaceSyncJobStatus.QUEUED, availableAt: new Date(), lastError: null, completedAt: null } });
  }
  return listings.length;
}

async function executeEtsyInventoryJob(jobId: string) {
  const job = await db.marketplaceSyncJob.findUnique({ where: { id: jobId }, include: { connection: true, listing: { include: { product: { include: { variants: true } } } } } });
  if (!job || !job.listing) throw new EtsyError("Etsy sync job has no linked listing", 409);
  const listing = job.listing;
  const connection = job.connection;
  if (!connection.syncEnabled || connection.status !== "ACTIVE") throw new EtsyError("Etsy syncing is disabled or needs reconnection", 409);
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing", 409);
  const remote = await etsyRequest<RemoteInventory>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(listing.externalId)}/inventory`);
  const body = buildEtsyInventoryPayload(remote, listing.product.variants);
  await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(listing.externalId)}/inventory`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const now = new Date();
  await db.$transaction([
    db.marketplaceListing.update({ where: { id: listing.id }, data: { lastSyncedAt: now, lastError: null } }),
    db.marketplaceConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: now, lastError: null, status: "ACTIVE" } }),
  ]);
}

export async function processEtsySyncJobs(storeId?: string, limit = 10) {
  let succeeded = 0; let failed = 0;
  const candidates = await db.marketplaceSyncJob.findMany({ where: { status: MarketplaceSyncJobStatus.QUEUED, availableAt: { lte: new Date() }, ...(storeId ? { connection: { storeId, kind: MarketplaceKind.ETSY } } : {}) }, orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 50), select: { id: true } });
  for (const candidate of candidates) {
    const claimed = await db.marketplaceSyncJob.updateMany({ where: { id: candidate.id, status: MarketplaceSyncJobStatus.QUEUED }, data: { status: MarketplaceSyncJobStatus.PROCESSING, startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const current = await db.marketplaceSyncJob.findUnique({ where: { id: candidate.id }, select: { attempts: true, connectionId: true, listingId: true } });
    try {
      await executeEtsyInventoryJob(candidate.id);
      await db.marketplaceSyncJob.update({ where: { id: candidate.id }, data: { status: MarketplaceSyncJobStatus.SUCCEEDED, dedupeKey: null, completedAt: new Date(), lastError: null } });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Etsy sync failed";
      const terminal = (current?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
      await db.$transaction([
        db.marketplaceSyncJob.update({ where: { id: candidate.id }, data: terminal ? { status: MarketplaceSyncJobStatus.FAILED, lastError: message, completedAt: new Date() } : { status: MarketplaceSyncJobStatus.QUEUED, lastError: message, availableAt: new Date(Date.now() + 60_000 * 2 ** Math.max(0, (current?.attempts ?? 1) - 1)) } }),
        db.marketplaceConnection.update({ where: { id: current!.connectionId }, data: { lastError: message } }),
        ...(current?.listingId ? [db.marketplaceListing.update({ where: { id: current.listingId }, data: { lastError: message } })] : []),
      ]);
      failed += 1;
    }
  }
  return { processed: candidates.length, succeeded, failed };
}

export async function createEtsyConnection(storeId: string, token: EtsyToken) {
  const sellerId = token.access_token.split(".", 1)[0];
  if (!sellerId) throw new EtsyError("Etsy did not return a seller identifier", 502);
  const temporary: EtsyConnection = { id: "pending", shopId: null, accessTokenEncrypted: encryptSecret(token.access_token), refreshTokenEncrypted: encryptSecret(token.refresh_token), tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), status: "ACTIVE" };
  const shops = await getEtsyShops(temporary, sellerId);
  const shop = shops.results?.[0];
  if (!shop?.shop_id) throw new EtsyError("The authorised Etsy account has no shop", 409);
  const now = new Date();
  return db.marketplaceConnection.upsert({ where: { storeId_kind: { storeId, kind: "ETSY" } }, create: { storeId, kind: "ETSY", status: "ACTIVE", shopId: String(shop.shop_id), shopName: shop.shop_name ?? null, sellerId, accessTokenEncrypted: temporary.accessTokenEncrypted, refreshTokenEncrypted: temporary.refreshTokenEncrypted, tokenExpiresAt: temporary.tokenExpiresAt, scopes: token.scope?.split(" ").filter(Boolean) ?? ETSY_SCOPES, connectedAt: now, lastError: null }, update: { status: "ACTIVE", shopId: String(shop.shop_id), shopName: shop.shop_name ?? null, sellerId, accessTokenEncrypted: temporary.accessTokenEncrypted, refreshTokenEncrypted: temporary.refreshTokenEncrypted, tokenExpiresAt: temporary.tokenExpiresAt, scopes: token.scope?.split(" ").filter(Boolean) ?? ETSY_SCOPES, connectedAt: now, lastError: null } });
}
