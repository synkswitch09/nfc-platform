import { consumeStock } from "@/lib/inventory-service";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MarketplaceConnectionStatus, MarketplaceKind, MarketplaceSyncJobStatus, MarketplaceSyncJobType, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret, requiredSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { currentAppEnvironment, getRuntimeConfig } from "@/lib/config";
import { availableInventory } from "@/lib/catalog";
import { manufacturingRequirements } from "@/lib/manufacturing";
import { notifyPaidOrder, queuePaidOrder } from "@/lib/order-notifications";
import { readStoredImage } from "@/lib/uploads";

export const ETSY_OAUTH_COOKIE = "etsy_connect";
const ETSY_API = "https://api.etsy.com/v3";
const ETSY_SCOPES = ["shops_r", "shops_w", "listings_r", "listings_w", "transactions_r"];
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

type EtsyDraftVariant = LocalVariant & { name: string };
type EtsyDraftImage = { storageKey: string; mimeType: string; sortOrder: number; altText: string };
type EtsyDraftProduct = EtsyListingContent & { variants: EtsyDraftVariant[]; options: LocalOption[]; images: EtsyDraftImage[] };
type EtsyCreatedListing = { listing_id?: number | string; listingId?: number | string; url?: string; state?: string };
const ETSY_CUSTOM_PROPERTY_IDS = [513, 514, 516];

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
type RemotePropertyValue = { property_name?: string; values?: unknown[]; [key: string]: unknown };
type RemoteInventoryProduct = { sku?: string; offerings?: RemoteOffering[]; property_values?: RemotePropertyValue[]; [key: string]: unknown };
type RemoteInventory = { products?: RemoteInventoryProduct[]; [key: string]: unknown };
type LocalVariant = { sku: string; priceCents: number; inventory: number; reservedInventory: number; active: boolean; trackInventory: boolean; backorderPolicy: "DENY" | "ALLOW"; optionSelection?: unknown };
type LocalOption = { code: string; name: string; type: string; values: Array<{ label: string; value: string; active: boolean }> };
type EtsyListingContent = { name: string; description: string; fullDescription?: string | null };

export type EtsyMoney = { amount?: number; divisor?: number; currency_code?: string };
export type EtsyReceiptTransaction = { listing_id?: number | string; sku?: string; quantity?: number; title?: string; price?: EtsyMoney; variations?: unknown[] };
export type EtsyReceipt = {
  receipt_id?: number | string;
  status?: string;
  is_paid?: boolean;
  buyer_email?: string | null;
  name?: string | null;
  first_line?: string | null;
  second_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country_iso?: string | null;
  formatted_address?: string | null;
  payment_method?: string | null;
  message_from_buyer?: string | null;
  create_timestamp?: number;
  updated_timestamp?: number;
  grandtotal?: EtsyMoney;
  subtotal?: EtsyMoney;
  total_shipping_cost?: EtsyMoney;
  transactions?: EtsyReceiptTransaction[];
  [key: string]: unknown;
};

type EtsyReceiptsResponse = { results?: EtsyReceipt[]; count?: number };

function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }

export function etsyMoneyToCents(money: EtsyMoney | undefined, field: string) {
  const amount = money?.amount;
  const divisor = money?.divisor;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(divisor) || !divisor || divisor < 1) throw new EtsyError(`Etsy receipt has an invalid ${field}`, 502);
  const cents = (amount as number) * 100 / (divisor as number);
  if (!Number.isSafeInteger(cents)) throw new EtsyError(`Etsy receipt has an unsupported ${field} divisor`, 502);
  return cents;
}

export function normaliseEtsyReceipt(receipt: EtsyReceipt) {
  const externalId = receipt.receipt_id == null ? null : String(receipt.receipt_id);
  if (!externalId || !/^\d+$/.test(externalId)) throw new EtsyError("Etsy receipt is missing its ID", 502);
  if (receipt.is_paid !== true) throw new EtsyError(`Etsy receipt ${externalId} is not paid`, 409);
  const transactions = receipt.transactions ?? [];
  if (!transactions.length) throw new EtsyError(`Etsy receipt ${externalId} has no line items`, 502);
  const currency = stringValue(receipt.grandtotal?.currency_code)?.toUpperCase();
  if (!currency) throw new EtsyError(`Etsy receipt ${externalId} has no currency`, 502);
  const lines = transactions.map((transaction, index) => {
    const listingId = transaction.listing_id == null ? null : String(transaction.listing_id);
    const sku = stringValue(transaction.sku);
    const quantity = transaction.quantity;
    if (!listingId || !/^\d+$/.test(listingId) || !sku || !Number.isSafeInteger(quantity) || !quantity || quantity < 1) throw new EtsyError(`Etsy receipt ${externalId} has an invalid line ${index + 1}`, 502);
    const lineCurrency = stringValue(transaction.price?.currency_code)?.toUpperCase();
    if (lineCurrency !== currency) throw new EtsyError(`Etsy receipt ${externalId} mixes currencies`, 409);
    return { listingId, sku, quantity, title: stringValue(transaction.title) ?? sku, unitPriceCents: etsyMoneyToCents(transaction.price, `price for ${sku}`), variations: Array.isArray(transaction.variations) ? transaction.variations : [] };
  });
  return {
    externalId,
    currency,
    totalCents: etsyMoneyToCents(receipt.grandtotal, "grand total"),
    shippingCents: etsyMoneyToCents(receipt.total_shipping_cost ?? { amount: 0, divisor: 100 }, "shipping total"),
    status: stringValue(receipt.status),
    customerName: stringValue(receipt.name),
    customerEmail: stringValue(receipt.buyer_email),
    shipping: {
      line1: stringValue(receipt.first_line), line2: stringValue(receipt.second_line), locality: stringValue(receipt.city),
      administrativeArea: stringValue(receipt.state), postcode: stringValue(receipt.zip), country: stringValue(receipt.country_iso)?.toUpperCase() ?? "AU",
      formattedAddress: stringValue(receipt.formatted_address), phone: null as string | null,
    },
    shippingServiceName: lines.map(line => line.title).length === 1 ? lines[0].title : "Etsy shipping",
    buyerMessage: stringValue(receipt.message_from_buyer),
    lines,
  };
}

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

function normaliseEtsyPropertyName(value: string) {
  const normalised = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalised === "color" ? "colour" : normalised;
}

// Etsy keeps its own taxonomy property IDs. We preserve them in the remote
// inventory payload, while refusing a link/sync if a matching named property
// would sell a different local colour, size or style under the same SKU.
export function verifyEtsyVariationValues(remote: RemoteInventory, variants: LocalVariant[], options: LocalOption[]) {
  const optionsByName = new Map(options.map(option => [normaliseEtsyPropertyName(option.name), option]));
  for (const remoteProduct of remote.products ?? []) {
    const sku = stringValue(remoteProduct.sku);
    const variant = sku ? variants.find(item => item.sku === sku) : null;
    if (!variant || !remoteProduct.property_values?.length) continue;
    const selection = typeof variant.optionSelection === "object" && variant.optionSelection && !Array.isArray(variant.optionSelection) ? variant.optionSelection as Record<string, unknown> : {};
    for (const property of remoteProduct.property_values) {
      const propertyName = stringValue(property.property_name);
      if (!propertyName) continue;
      const option = optionsByName.get(normaliseEtsyPropertyName(propertyName)) ?? options.find(item => normaliseEtsyPropertyName(item.code) === normaliseEtsyPropertyName(propertyName));
      const selectedValue = option ? selection[option.code] : null;
      if (!option || typeof selectedValue !== "string") continue;
      const localLabel = option.values.find(item => item.value === selectedValue)?.label;
      const remoteValues = (property.values ?? []).filter((value): value is string => typeof value === "string");
      if (localLabel && remoteValues.length && !remoteValues.some(value => value.trim().toLowerCase() === localLabel.trim().toLowerCase())) throw new EtsyError(`Etsy variation mismatch for ${sku}: ${propertyName} must include ${localLabel}`, 409);
    }
  }
}

export function buildEtsyListingContentPayload(product: EtsyListingContent) {
  const description = (product.fullDescription?.trim() || product.description.trim()).slice(0, 13_000);
  return new URLSearchParams({ title: product.name.trim().slice(0, 140), description });
}

function requireEtsyListingDefaults(defaults: EtsyListingDefaults) {
  if (!defaults.taxonomyId || !/^\d+$/.test(defaults.taxonomyId)) throw new EtsyError("Set the Etsy taxonomy ID before creating a listing", 409);
  if (!defaults.shippingProfileId || !/^\d+$/.test(defaults.shippingProfileId)) throw new EtsyError("Set the Etsy shipping profile ID before creating a listing", 409);
  if (!defaults.readinessStateId || !/^\d+$/.test(defaults.readinessStateId)) throw new EtsyError("Set the Etsy processing profile ID before creating a listing", 409);
  if (!defaults.whoMade) throw new EtsyError("Set who made this product before creating a listing", 409);
  if (!defaults.whenMade?.trim()) throw new EtsyError("Set when this product was made before creating a listing", 409);
  return defaults as Required<Pick<EtsyListingDefaults, "taxonomyId" | "shippingProfileId" | "readinessStateId" | "whoMade" | "whenMade">> & EtsyListingDefaults;
}

function listingSelectionOptions(options: LocalOption[]) {
  const selectable = options.filter(option => ["SELECT", "RADIO", "COLOUR"].includes(option.type));
  if (selectable.length > ETSY_CUSTOM_PROPERTY_IDS.length) throw new EtsyError("Etsy supports at most three product variations. Keep only Colour, Size and Style as selectable variant options.", 409);
  return selectable;
}

export function buildEtsyDraftInventoryPayload(product: Pick<EtsyDraftProduct, "variants" | "options">, readinessStateId: string) {
  const variants = product.variants.filter(variant => variant.active);
  if (!variants.length) throw new EtsyError("Enable at least one product variant before creating an Etsy listing", 409);
  if (variants.some(variant => !variant.trackInventory)) throw new EtsyError("All Etsy variants must have inventory tracking enabled", 409);
  const options = listingSelectionOptions(product.options);
  const propertyIds = options.map((_, index) => ETSY_CUSTOM_PROPERTY_IDS[index]);
  const products = variants.map(variant => {
    const selection = typeof variant.optionSelection === "object" && variant.optionSelection && !Array.isArray(variant.optionSelection) ? variant.optionSelection as Record<string, unknown> : {};
    const propertyValues = options.map((option, index) => {
      const selected = selection[option.code];
      const label = typeof selected === "string" ? option.values.find(value => value.value === selected)?.label : null;
      if (!label) throw new EtsyError(`Variant ${variant.sku} must select a ${option.name} value before creating Etsy variations`, 409);
      return { property_id: propertyIds[index], property_name: option.name, scale_id: null, value_ids: [], values: [label] };
    });
    const quantity = availableInventory(variant);
    return { sku: variant.sku, offerings: [{ quantity, price: Number((variant.priceCents / 100).toFixed(2)), is_enabled: quantity > 0 || variant.backorderPolicy === "ALLOW", readiness_state_id: Number(readinessStateId) }], property_values: propertyValues };
  });
  return { products, price_on_property: propertyIds, quantity_on_property: propertyIds, sku_on_property: propertyIds, readiness_state_on_property: [] };
}

export async function createEtsyDraftListing(connection: EtsyConnection, defaults: EtsyListingDefaults, product: EtsyDraftProduct) {
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing; reconnect Etsy", 409);
  const configured = requireEtsyListingDefaults(defaults);
  const variants = product.variants.filter(variant => variant.active);
  const quantity = variants.reduce((total, variant) => total + availableInventory(variant), 0);
  if (quantity < 1) throw new EtsyError("Set stock above zero for at least one active variant before creating an Etsy listing", 409);
  if (!product.images.length) throw new EtsyError("Add at least one product image before creating an Etsy listing", 409);
  const lowestPrice = Math.min(...variants.map(variant => variant.priceCents)) / 100;
  const body = buildEtsyListingContentPayload(product);
  body.set("quantity", String(quantity));
  body.set("price", String(Number(lowestPrice.toFixed(2))));
  body.set("who_made", configured.whoMade);
  body.set("when_made", configured.whenMade);
  body.set("taxonomy_id", configured.taxonomyId);
  body.set("shipping_profile_id", configured.shippingProfileId);
  body.set("readiness_state_id", configured.readinessStateId);
  body.set("is_supply", String(Boolean(configured.isSupply)));
  body.set("should_auto_renew", String(Boolean(configured.shouldAutoRenew)));
  const created = await etsyRequest<EtsyCreatedListing>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const listingId = created.listing_id ?? created.listingId;
  if (listingId == null || !/^\d+$/.test(String(listingId))) throw new EtsyError("Etsy did not return a listing ID", 502);
  return { externalId: String(listingId), externalUrl: created.url ?? null, state: created.state ?? "draft" };
}

export async function configureEtsyDraftListing(connection: EtsyConnection, externalId: string, defaults: EtsyListingDefaults, product: EtsyDraftProduct, publish: boolean) {
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing; reconnect Etsy", 409);
  const configured = requireEtsyListingDefaults(defaults);
  for (const [rank, image] of [...product.images].sort((left, right) => left.sortOrder - right.sortOrder).entries()) {
    const bytes = await readStoredImage(image.storageKey);
    if (!bytes) throw new EtsyError(`Product image ${rank + 1} is unavailable; re-upload it before creating Etsy`, 409);
    const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
    const imageBytes = Uint8Array.from(bytes);
    const form = new FormData();
    form.set("image", new Blob([imageBytes.buffer], { type: image.mimeType }), `tapkin-product-${rank + 1}.${extension}`);
    form.set("rank", String(rank + 1));
    form.set("alt_text", image.altText.slice(0, 250));
    await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}/images`, { method: "POST", body: form });
  }
  const inventory = buildEtsyDraftInventoryPayload(product, configured.readinessStateId);
  await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}/inventory`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(inventory) });
  if (publish) await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}`, { method: "PATCH", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ state: "active" }) });
  return { state: publish ? "active" : "draft" };
}

export async function createEtsyReadinessState(connection: EtsyConnection, input: { readinessState: "ready_to_ship" | "made_to_order"; minProcessingTime: number; maxProcessingTime: number; processingTimeUnit: "days" | "weeks" }) {
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing; reconnect Etsy", 409);
  const body = new URLSearchParams({ readiness_state: input.readinessState, min_processing_time: String(input.minProcessingTime), max_processing_time: String(input.maxProcessingTime), processing_time_unit: input.processingTimeUnit });
  const result = await etsyRequest<{ readiness_state_id?: number | string }>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/readiness-state-definitions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (result.readiness_state_id == null || !/^\d+$/.test(String(result.readiness_state_id))) throw new EtsyError("Etsy did not return a processing profile ID", 502);
  return String(result.readiness_state_id);
}

export async function verifyEtsyListing(connection: EtsyConnection, externalId: string, variants: LocalVariant[], options: LocalOption[] = []) {
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing; reconnect Etsy", 409);
  const inventory = await etsyRequest<RemoteInventory>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(externalId)}/inventory`);
  buildEtsyInventoryPayload(inventory, variants);
  verifyEtsyVariationValues(inventory, variants, options);
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

// This is deliberately separate from inventory jobs: an outbound listing update
// can be coalesced, while every paid receipt must be inspected for import.
export async function queueEtsyReceiptSync(storeId?: string) {
  const connections = await db.marketplaceConnection.findMany({
    where: { kind: MarketplaceKind.ETSY, status: MarketplaceConnectionStatus.ACTIVE, syncEnabled: true, ...(storeId ? { storeId } : {}) },
    select: { id: true },
  });
  for (const connection of connections) {
    const dedupeKey = `etsy:${connection.id}:receipts`;
    await db.marketplaceSyncJob.upsert({
      where: { dedupeKey },
      create: { connectionId: connection.id, type: MarketplaceSyncJobType.RECEIPTS, dedupeKey, payload: {} },
      // Failed receipt imports stay visible for an administrator to resolve.
      // A successful job clears its dedupe key, so the next scheduler run creates
      // a fresh receipt poll without resetting a failed job behind the scenes.
      update: {},
    });
  }
  return connections.length;
}

async function executeEtsyInventoryJob(jobId: string) {
  const job = await db.marketplaceSyncJob.findUnique({ where: { id: jobId }, include: { connection: true, listing: { include: { product: { include: { variants: true, options: { include: { values: true } } } } } } } });
  if (!job || !job.listing) throw new EtsyError("Etsy sync job has no linked listing", 409);
  const listing = job.listing;
  const connection = job.connection;
  if (!connection.syncEnabled || connection.status !== "ACTIVE") throw new EtsyError("Etsy syncing is disabled or needs reconnection", 409);
  if (!connection.shopId) throw new EtsyError("Etsy shop information is missing", 409);
  const remote = await etsyRequest<RemoteInventory>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(listing.externalId)}/inventory`);
  const body = buildEtsyInventoryPayload(remote, listing.product.variants);
  verifyEtsyVariationValues(remote, listing.product.variants, listing.product.options);
  await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(listing.externalId)}/inventory`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await etsyRequest(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/listings/${encodeURIComponent(listing.externalId)}`, { method: "PATCH", headers: { "content-type": "application/x-www-form-urlencoded" }, body: buildEtsyListingContentPayload(listing.product) });
  const now = new Date();
  await db.$transaction([
    db.marketplaceListing.update({ where: { id: listing.id }, data: { lastSyncedAt: now, lastError: null } }),
    db.marketplaceConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: now, lastError: null, status: "ACTIVE" } }),
  ]);
}

async function importEtsyReceipt(connectionId: string, rawReceipt: EtsyReceipt) {
  const receipt = normaliseEtsyReceipt(rawReceipt);
  const result = await db.$transaction(async tx => {
    const previous = await tx.marketplaceOrder.findUnique({ where: { connectionId_externalId: { connectionId, externalId: receipt.externalId } }, select: { orderId: true } });
    if (previous) return { created: false, orderId: previous.orderId };

    const connection = await tx.marketplaceConnection.findUnique({
      where: { id: connectionId },
      include: { store: { select: { id: true, slug: true, displayName: true, currency: true, capabilities: true } } },
    });
    if (!connection || connection.kind !== MarketplaceKind.ETSY || connection.status !== MarketplaceConnectionStatus.ACTIVE) throw new EtsyError("Etsy connection is no longer active", 409);
    if (connection.store.currency.toUpperCase() !== receipt.currency) throw new EtsyError(`Etsy receipt ${receipt.externalId} is ${receipt.currency}, but this store is ${connection.store.currency}`, 409);

    const listingIds = [...new Set(receipt.lines.map(line => line.listingId))];
    const listings = await tx.marketplaceListing.findMany({
      where: { connectionId, externalId: { in: listingIds } },
      include: { product: { include: { variants: true } } },
    });
    const listingByExternalId = new Map(listings.map(listing => [listing.externalId, listing]));
    const lines = receipt.lines.map(line => {
      const listing = listingByExternalId.get(line.listingId);
      if (!listing) throw new EtsyError(`Etsy receipt ${receipt.externalId} includes unlinked listing ${line.listingId}; link it before importing this order`, 409);
      const variant = listing.product.variants.find(item => item.sku === line.sku && item.active);
      if (!variant) throw new EtsyError(`Etsy receipt ${receipt.externalId} SKU ${line.sku} does not match an active local variant`, 409);
      return { ...line, listing, variant };
    });

    const quantities = new Map<string, number>();
    for (const line of lines) quantities.set(line.variant.id, (quantities.get(line.variant.id) ?? 0) + line.quantity);
    for (const [variantId, quantity] of quantities) {
      const variant = lines.find(line => line.variant.id === variantId)!.variant;
      if (variant.trackInventory && variant.backorderPolicy === "DENY" && availableInventory(variant) < quantity) throw new EtsyError(`Etsy receipt ${receipt.externalId} cannot be imported: ${variant.sku} does not have enough available stock`, 409);
    }

    const subtotalCents = Math.max(0, receipt.totalCents - receipt.shippingCents);
    const prefix = connection.store.slug === "tapkin" ? "TK" : connection.store.slug.slice(0, 4).toUpperCase();
    const order = await tx.order.create({
      data: {
        orderNumber: `${prefix}-ETSY-${receipt.externalId}`,
        storeId: connection.store.id,
        sourceDomain: "etsy.com",
        checkoutEnvironment: currentAppEnvironment().toUpperCase() as "DEVELOPMENT" | "STAGING" | "PRODUCTION",
        storeDisplayName: connection.store.displayName,
        guestEmail: receipt.customerEmail,
        customerName: receipt.customerName,
        shippingName: receipt.customerName,
        shippingLine1: receipt.shipping.line1,
        shippingLine2: receipt.shipping.line2,
        shippingSuburb: receipt.shipping.locality,
        shippingState: receipt.shipping.administrativeArea,
        shippingLocality: receipt.shipping.locality,
        shippingAdministrativeArea: receipt.shipping.administrativeArea,
        shippingPostcode: receipt.shipping.postcode,
        shippingCountry: receipt.shipping.country,
        shippingFormattedAddress: receipt.shipping.formattedAddress,
        shippingProviderKey: "etsy",
        shippingServiceCode: "etsy",
        shippingServiceName: receipt.shippingServiceName,
        shippingQuoteSnapshot: { source: "etsy", receiptId: receipt.externalId, paymentMethod: rawReceipt.payment_method ?? null, buyerMessage: receipt.buyerMessage },
        status: "PAID",
        currency: receipt.currency,
        subtotalCents,
        shippingCents: receipt.shippingCents,
        totalCents: receipt.totalCents,
        items: { create: lines.map(line => ({
          variant: { connect: { id: line.variant.id } },
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          productName: line.listing.product.name,
          variantName: line.variant.name,
          sku: line.variant.sku,
          productType: line.listing.product.type,
          personalisation: line.variations.length ? { source: "etsy", variations: line.variations } as Prisma.InputJsonValue : undefined,
          personalisationMode: line.listing.product.personalisationMode,
          personalisationChoice: line.listing.product.personalisationMode === "NONE" || !line.variations.length ? "BASIC" : "PERSONALISED",
          selectedOptions: line.variations.length ? { etsyVariations: line.variations } as Prisma.InputJsonValue : undefined,
          shippingSnapshot: { source: "etsy", listingId: line.listingId },
        })) },
        payments: { create: { provider: "etsy", providerSessionId: `etsy:${connectionId}:${receipt.externalId}`, amountCents: receipt.totalCents, currency: receipt.currency, status: "SUCCEEDED" } },
        statusHistory: { create: { toStatus: "PAID", note: `Imported from Etsy receipt ${receipt.externalId}` } },
      },
      include: { items: true },
    });

    for (const [variantId, quantity] of quantities) {
      const variant = lines.find(line => line.variant.id === variantId)!.variant;
      if (variant.trackInventory) {
        await consumeStock(tx, { variantId, orderId: order.id, quantity, held: 0, inventory: variant.inventory, reservedInventory: variant.reservedInventory, backorder: variant.backorderPolicy === "ALLOW", reason: `Etsy receipt ${receipt.externalId}` });
      }
    }

    for (const productId of new Set(lines.map(line => line.variant.productId))) await queueEtsyInventorySync(tx, connection.store.id, productId);
    const jobs = order.items.flatMap(item => {
      const variant = lines.find(line => line.variant.id === item.variantId)!.variant;
      const requirements = manufacturingRequirements(connection.store.capabilities, item.productType);
      return requirements ? [{ storeId: connection.store.id, orderItemId: item.id, productVariantId: item.variantId, quantity: item.quantity, material: variant.material, colour: variant.colour, requiresNfc: requirements.requiresNfc }] : [];
    });
    if (jobs.length) await tx.manufacturingJob.createMany({ data: jobs, skipDuplicates: true });
    await tx.marketplaceOrder.create({ data: { connectionId, orderId: order.id, externalId: receipt.externalId, externalState: receipt.status, externalData: rawReceipt as Prisma.InputJsonValue } });
    await tx.auditLog.create({ data: { storeId: connection.store.id, action: "ETSY_RECEIPT_IMPORTED", entityType: "Order", entityId: order.id, metadata: { receiptId: receipt.externalId, lineCount: lines.length } } });
    await queuePaidOrder(tx, order.id);
    return { created: true, orderId: order.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result.created) await notifyPaidOrder(result.orderId);
  return result;
}

async function executeEtsyReceiptsJob(jobId: string) {
  const job = await db.marketplaceSyncJob.findUnique({ where: { id: jobId }, include: { connection: true } });
  if (!job) throw new EtsyError("Etsy receipt job was not found", 404);
  const connection = job.connection;
  if (!connection.syncEnabled || connection.status !== MarketplaceConnectionStatus.ACTIVE || !connection.shopId) throw new EtsyError("Etsy order import is disabled or needs reconnection", 409);
  const query = new URLSearchParams({ was_paid: "true", was_canceled: "false", sort_on: "updated", sort_order: "asc", limit: "100" });
  if (connection.lastOrderSyncedAt) query.set("min_last_modified", String(Math.max(0, Math.floor(connection.lastOrderSyncedAt.getTime() / 1000) - 60)));
  let offset = 0;
  let imported = 0;
  while (offset < 1000) {
    query.set("offset", String(offset));
    const response = await etsyRequest<EtsyReceiptsResponse>(connection, `/application/shops/${encodeURIComponent(connection.shopId)}/receipts?${query}`);
    const receipts = response.results ?? [];
    for (const receipt of receipts) if ((await importEtsyReceipt(connection.id, receipt)).created) imported += 1;
    if (receipts.length < 100) break;
    offset += receipts.length;
  }
  if (offset >= 1000) throw new EtsyError("Etsy returned more than 1,000 changed receipts; run sync again to continue safely", 409);
  const now = new Date();
  await db.marketplaceConnection.update({ where: { id: connection.id }, data: { lastOrderSyncedAt: now, lastError: null, status: "ACTIVE" } });
  return imported;
}

export async function processEtsySyncJobs(storeId?: string, limit = 10) {
  let succeeded = 0; let failed = 0;
  await queueEtsyReceiptSync(storeId);
  const candidates = await db.marketplaceSyncJob.findMany({ where: { status: MarketplaceSyncJobStatus.QUEUED, availableAt: { lte: new Date() }, ...(storeId ? { connection: { storeId, kind: MarketplaceKind.ETSY } } : {}) }, orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 50), select: { id: true } });
  for (const candidate of candidates) {
    const claimed = await db.marketplaceSyncJob.updateMany({ where: { id: candidate.id, status: MarketplaceSyncJobStatus.QUEUED }, data: { status: MarketplaceSyncJobStatus.PROCESSING, startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const current = await db.marketplaceSyncJob.findUnique({ where: { id: candidate.id }, select: { attempts: true, connectionId: true, listingId: true } });
    try {
      const type = await db.marketplaceSyncJob.findUnique({ where: { id: candidate.id }, select: { type: true } });
      if (type?.type === MarketplaceSyncJobType.INVENTORY) await executeEtsyInventoryJob(candidate.id);
      else if (type?.type === MarketplaceSyncJobType.RECEIPTS) await executeEtsyReceiptsJob(candidate.id);
      else throw new EtsyError("Unsupported Etsy sync job", 409);
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
