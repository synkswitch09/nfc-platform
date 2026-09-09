import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const appLog = process.env.E2E_APP_LOG ?? "/tmp/nfc-e2e-app.log";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.test";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdminPassword123";
const stripeWebhookSecret = process.env.E2E_STRIPE_WEBHOOK_SECRET ?? "e2e-webhook-secret";
const db = new PrismaClient();
const checks = [];

function assert(condition, label, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ""}`);
  checks.push(label);
  console.info(`✓ ${label}`);
}

function cookieHeader(jar) { return [...jar].map(([name, value]) => `${name}=${value}`).join("; "); }
function captureCookies(response, jar) {
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of setCookies) { const [pair] = value.split(";", 1); const separator = pair.indexOf("="); if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1)); }
}

async function request(path, { method = "GET", json, body, headers = {}, jar = new Map(), redirect = "follow" } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET" && method !== "HEAD") requestHeaders.set("origin", origin);
  if (json !== undefined) { requestHeaders.set("content-type", "application/json"); body = JSON.stringify(json); }
  const cookies = cookieHeader(jar); if (cookies) requestHeaders.set("cookie", cookies);
  const response = await fetch(new URL(path, origin), { method, headers: requestHeaders, body, redirect });
  captureCookies(response, jar);
  return response;
}

async function bodyText(response) { const text = await response.text(); return { text, lower: text.toLowerCase() }; }
async function jsonResponse(response, expected, label) {
  const text = await response.text();
  assert(response.status === expected, label, `expected ${expected}, received ${response.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`${label}: response was not JSON`); }
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await request("/api/health"); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error("Application did not become healthy within 60 seconds");
}

async function latestVerificationToken() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const log = await readFile(appLog, "utf8").catch(() => "");
    const matches = [...log.matchAll(/\/verify-email\?token=([A-Za-z0-9_-]+)/g)];
    if (matches.length) return matches.at(-1)[1];
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Email verification token was not emitted to the development email preview log");
}

async function main() {
  await waitForHealth();
  const suffix = Date.now().toString(36);
  const guestEmail = `e2e-guest-${suffix}@example.test`;
  const guestPassword = "GuestPassword123";
  const customerJar = new Map(); const adminJar = new Map();

  // FLOW A — guest purchase through the real HTTP boundary and test payment settlement.
  for (const path of ["/", "/categories/pet-tags", "/shop?category=pet-tags", "/products/round-nfc-pet-tag", "/cart", "/checkout"]) {
    const response = await request(path); assert(response.status === 200, `Guest can browse ${path}`);
  }
  const seededVariant = await db.productVariant.findUnique({ where: { sku: "PET-ROUND" } });
  assert(Boolean(seededVariant), "Seeded checkout variant exists");
  await jsonResponse(await request("/api/checkout", { method: "POST", json: { items: [{ variantId: seededVariant.id, quantity: 0 }], customer: { name: "E2E Guest", email: guestEmail, shipping: { line1: "1 Test Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" } } } }), 400, "Checkout rejects invalid quantities");
  await jsonResponse(await request("/api/checkout", { method: "POST", json: { items: [{ variantId: "00000000-0000-4000-8000-000000000000", quantity: 1 }], customer: { name: "E2E Guest", email: guestEmail, shipping: { line1: "1 Test Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" } } } }), 409, "Checkout rejects unavailable variants");
  const checkout = await jsonResponse(await request("/api/checkout", { method: "POST", json: {
    items: [{ variantId: seededVariant.id, quantity: 1, unitPriceCents: 1, personalisation: { "pet-name": "Pixel", colour: "ocean", shape: "round" } }],
    customer: { name: "E2E Guest", email: guestEmail, shipping: { line1: "1 Test Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" } },
  } }), 200, "Guest checkout succeeds without an account");
  assert(checkout.testMode === true, "Test payment flow settles the order");
  const successUrl = new URL(checkout.url); const successPage = await bodyText(await request(`${successUrl.pathname}${successUrl.search}`));
  assert(successPage.lower.includes("payment received"), "Guest reaches order success page");
  const orderNumber = successUrl.pathname.split("/").at(-2); const claimToken = successUrl.searchParams.get("token");
  const paidOrder = await db.order.findUnique({ where: { orderNumber } });
  assert(paidOrder?.status === "PAID", "Server settled paid order state");
  assert(paidOrder?.totalCents !== 1, "Client price tampering is ignored");
  const payment = await db.payment.findFirst({ where: { orderId: paidOrder.id } });
  const stripeEventId = `evt_e2e_${suffix}`;
  const stripePayload = JSON.stringify({ id: stripeEventId, object: "event", type: "checkout.session.completed", data: { object: { id: payment.providerSessionId, object: "checkout.session", metadata: { orderId: paidOrder.id }, payment_status: "paid", amount_total: paidOrder.totalCents, currency: "aud", payment_intent: `pi_e2e_${suffix}` } } });
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": "invalid" } }), 400, "Stripe webhook rejects an invalid signature");
  const stripe = new Stripe("e2e-not-a-real-stripe-key");
  const stripeSignature = stripe.webhooks.generateTestHeaderString({ payload: stripePayload, secret: stripeWebhookSecret });
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": stripeSignature } }), 200, "Stripe webhook accepts a valid signature");
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": stripeSignature } }), 200, "Stripe webhook handles a duplicate event idempotently");
  assert(await db.webhookEvent.count({ where: { id: stripeEventId } }) === 1, "Duplicate Stripe event is persisted only once");

  // FLOW B — create and verify an account after purchase; the previous order is attached.
  await jsonResponse(await request("/api/auth/register", { method: "POST", jar: customerJar, json: { name: "E2E Customer", email: guestEmail, password: guestPassword, orderNumber, orderClaimToken: claimToken } }), 201, "Guest creates an account from the purchase");
  const verificationToken = await latestVerificationToken();
  const verification = await request(`/api/auth/verify-email?token=${verificationToken}`, { jar: customerJar, redirect: "manual" });
  assert([302, 303, 307, 308].includes(verification.status), "Email ownership verification completes");
  const dashboard = await bodyText(await request("/dashboard", { jar: customerJar }));
  assert(dashboard.text.includes(orderNumber), "Previous guest purchase appears in the account");
  await jsonResponse(await request("/api/admin/products", { method: "POST", jar: customerJar, json: {} }), 403, "Customer cannot escalate into Product Admin");

  // FLOW C — tag/account management is never available anonymously.
  const anonymousDashboard = await request("/dashboard", { redirect: "manual" });
  assert([302, 303, 307, 308].includes(anonymousDashboard.status) && (anonymousDashboard.headers.get("location") ?? "").includes("/login"), "Anonymous NFC management requires authentication");

  // FLOW D — administrator creates, images, stocks and publishes a product.
  await jsonResponse(await request("/api/admin/products", { method: "POST", json: {} }), 403, "Customerless request is rejected by Product Admin");
  const login = await jsonResponse(await request("/api/auth/login", { method: "POST", jar: adminJar, json: { email: adminEmail, password: adminPassword } }), 200, "Development administrator can sign in");
  assert(login.user.role === "ADMIN", "Administrator role is enforced");
  const e2eCategory = await db.productCategory.findUnique({ where: { slug: "pet-tags" } });
  assert(e2eCategory?.status === "PUBLISHED", "Published category exists for the product journey");
  const slug = `e2e-nfc-tag-${suffix}`; const sku = `E2E-${suffix.toUpperCase()}`.slice(0, 50);
  const productPayload = { name: `E2E NFC Tag ${suffix}`, slug, description: "A test-only NFC tag used by the integrated business journey.", fullDescription: "Created through Product Admin, imaged, stocked, published and then used in the NFC manufacturing flow.", categoryId: e2eCategory.id, type: "PET", status: "DRAFT", featured: false, shopVisible: false, brand: "Tapkin", gstInclusive: true, seoTitle: `E2E NFC Tag ${suffix}`, seoDescription: "Integrated test product for NFC commerce and manufacturing.", ogImageUrl: "", canonicalUrl: "", indexable: false,
    variants: [{ sku, name: "Standard", colour: "Ocean", size: "Standard", material: "PETG", priceCents: 3495, compareAtPriceCents: null, costCents: 800, inventory: 25, trackInventory: true, lowStockThreshold: 3, backorderPolicy: "DENY", active: true }],
    options: [{ name: "Pet name", code: "pet-name", type: "SHORT_TEXT", required: true, maxLength: 24, priceDeltaCents: 0, helpText: "Printed on the tag", active: true, values: [] }],
  };
  const created = await jsonResponse(await request("/api/admin/products", { method: "POST", jar: adminJar, json: productPayload }), 201, "Administrator creates a draft product");
  const product = await db.product.findUnique({ where: { id: created.product.id }, include: { variants: true } });
  assert(product?.variants[0]?.inventory === 25, "Product variant and inventory are persisted");
  const imageForm = new FormData();
  imageForm.append("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "e2e.png");
  imageForm.append("altText", "Ocean E2E NFC pet tag");
  await jsonResponse(await request(`/api/admin/products/${product.id}/images`, { method: "POST", jar: adminJar, body: imageForm }), 201, "Administrator uploads a content-verified product image");
  const variant = product.variants[0];
  await jsonResponse(await request(`/api/admin/products/${product.id}`, { method: "PATCH", jar: adminJar, json: { ...productPayload, status: "ACTIVE", shopVisible: true, indexable: true, variants: [{ ...productPayload.variants[0], id: variant.id }] } }), 200, "Administrator publishes the product");
  const storeProduct = await bodyText(await request(`/products/${slug}`));
  assert(storeProduct.text.includes(productPayload.name), "Published product appears in the store");

  // FLOW E — manufacture, program, verify, activate, configure and scan a tag.
  const batch = await jsonResponse(await request("/api/admin/tags/batch", { method: "POST", jar: adminJar, json: { productId: product.id, productVariantId: variant.id, quantity: 1, notes: "Automated E2E batch" } }), 201, "Manufacturing creates a secure production batch");
  const credential = batch.credentials[0];
  assert(credential.qrDataUrl.startsWith("data:image/png;base64,"), "Production batch contains QR evidence");
  const tag = await db.nFCTag.findUnique({ where: { publicTagId: credential.publicTagId } });
  for (const status of ["PROGRAMMED", "VERIFIED", "ASSEMBLED", "READY"]) {
    await jsonResponse(await request(`/api/admin/tags/${tag.id}/manufacturing`, { method: "POST", jar: adminJar, json: { status } }), 200, `Manufacturing advances tag to ${status}`);
  }
  await jsonResponse(await request(`/api/admin/tags/${tag.id}/activation`, { method: "POST", jar: adminJar, json: { reason: "CUSTOMER_LOST_CODE", note: "Identity confirmation deliberately omitted", confirmedIdentity: false } }), 400, "Activation regeneration requires identity confirmation");
  const regenerated = await jsonResponse(await request(`/api/admin/tags/${tag.id}/activation`, { method: "POST", jar: adminJar, json: { reason: "CUSTOMER_LOST_CODE", note: "Order and verified account matched by support", confirmedIdentity: true } }), 200, "Administrator rotates an unclaimed activation credential");
  assert(regenerated.activationCode !== credential.activationCode && regenerated.version === 2, "Regenerated activation credential is new and versioned");
  const regenerationAudit = await db.auditLog.findFirst({ where: { entityId: tag.id, action: "TAG_ACTIVATION_CREDENTIAL_REGENERATED" }, orderBy: { createdAt: "desc" } });
  const auditMetadata = JSON.stringify(regenerationAudit?.metadata ?? {});
  assert(Boolean(regenerationAudit) && !auditMetadata.includes(regenerated.activationCode), "Audit records credential rotation without storing the secret");
  await jsonResponse(await request("/api/tags/activate", { method: "POST", jar: customerJar, json: { publicTagId: credential.publicTagId, activationCode: credential.activationCode } }), 400, "Previous activation credential is invalidated immediately");
  const activation = await jsonResponse(await request("/api/tags/activate", { method: "POST", jar: customerJar, json: { publicTagId: credential.publicTagId, activationCode: regenerated.activationCode } }), 200, "Customer activates the tag with the one-time replacement credential");
  await jsonResponse(await request("/api/tags/activate", { method: "POST", jar: customerJar, json: { publicTagId: credential.publicTagId, activationCode: regenerated.activationCode } }), 400, "Activation credential cannot be replayed");
  await jsonResponse(await request(`/api/tags/${activation.tagId}/profile`, { method: "PATCH", jar: customerJar, json: { type: "PET", displayName: "Pixel E2E", details: { species: "Dog", breed: "Kelpie", description: "Friendly test pet", medicalInfo: "No medication", allergies: null, medications: null, behaviourNotes: "Approach calmly", veterinarian: null, approximateAge: "3", sex: null, photoUrl: "" }, contacts: [{ name: "E2E Customer", relationship: "Owner", phone: "+61400000000" }] } }), 200, "Customer configures the owned public profile");
  const publicProfile = await bodyText(await request(`/t/${credential.publicTagId}`));
  assert(publicProfile.text.includes("Pixel E2E") && publicProfile.text.includes("Approach calmly"), "Public NFC scan resolves the configured profile");
  const ownerTagPage = await bodyText(await request(`/dashboard/tags/${activation.tagId}`, { jar: customerJar }));
  assert(ownerTagPage.text.includes("Pixel E2E") && ownerTagPage.text.includes("Lifetime"), "Owner can manage the active tag and view analytics");

  // Commercial visibility never governs an already-issued NFC identity.
  for (const categoryStatus of ["HIDDEN", "ARCHIVED"]) {
    await db.productCategory.update({ where: { id: e2eCategory.id }, data: { status: categoryStatus } });
    const categoryHiddenProfile = await bodyText(await request(`/t/${credential.publicTagId}`));
    assert(categoryHiddenProfile.text.includes("Pixel E2E"), `${categoryStatus} category does not interrupt an active tag`);
    const categoryHiddenOwner = await bodyText(await request(`/dashboard/tags/${activation.tagId}`, { jar: customerJar }));
    assert(categoryHiddenOwner.text.includes("Pixel E2E"), `Owner management survives a ${categoryStatus} category`);
  }
  await db.productCategory.update({ where: { id: e2eCategory.id }, data: { status: "PUBLISHED" } });
  for (const productStatus of ["HIDDEN", "ARCHIVED", "OUT_OF_STOCK"]) {
    await db.product.update({ where: { id: product.id }, data: { status: productStatus } });
    const unavailableProductProfile = await bodyText(await request(`/t/${credential.publicTagId}`));
    assert(unavailableProductProfile.text.includes("Pixel E2E"), `${productStatus} product does not interrupt an active tag`);
  }
  await db.product.update({ where: { id: product.id }, data: { status: "ACTIVE", shopVisible: true } });
  const unknownTag = await request("/t/ABCDEFGH23456789"); assert(unknownTag.status === 404, "Unknown public tag returns 404");
  await jsonResponse(await request(`/api/admin/tags/${tag.id}/status`, { method: "POST", jar: adminJar, json: { status: "LOST", reason: "E2E lost-tag check" } }), 200, "Administrator can report an active tag lost");
  const lost = await bodyText(await request(`/t/${credential.publicTagId}`));
  assert(lost.text.includes("reported lost") && lost.text.includes("Pixel E2E"), "Lost tag keeps recovery details and adds an urgent notice");
  await jsonResponse(await request(`/api/admin/tags/${tag.id}/status`, { method: "POST", jar: adminJar, json: { status: "ACTIVE", reason: "E2E restore before disable" } }), 200, "Administrator can restore an owned lost tag");
  await jsonResponse(await request(`/api/admin/tags/${tag.id}/status`, { method: "POST", jar: adminJar, json: { status: "DISABLED", reason: "E2E visibility check" } }), 200, "Administrator can disable a tag with an audit reason");
  const disabled = await bodyText(await request(`/t/${credential.publicTagId}`));
  assert(disabled.text.includes("Tag unavailable") && !disabled.text.includes("Pixel E2E"), "Disabled tag reveals no profile information");

  // SEO and private-surface boundaries are verified through rendered HTTP output.
  const robots = await bodyText(await request("/robots.txt")); const sitemap = await bodyText(await request("/sitemap.xml"));
  assert(robots.text.includes("/admin") && robots.text.includes("/dashboard"), "Robots excludes private surfaces");
  assert(sitemap.text.includes(`/products/${slug}`), "Dynamic sitemap contains the published product");
  assert(storeProduct.text.includes("application/ld+json") && storeProduct.text.includes("canonical"), "Product renders canonical metadata and structured data");
  await jsonResponse(await request("/api/auth/logout", { method: "POST", jar: customerJar }), 200, "Customer can sign out");
  const signedOutDashboard = await request("/dashboard", { jar: customerJar, redirect: "manual" });
  assert([302, 303, 307, 308].includes(signedOutDashboard.status), "Signed-out session cannot reopen the dashboard");

  console.info(`\nE2E COMPLETE: ${checks.length} assertions passed across flows A–E.`);
}

main().catch(error => { console.error(`E2E FAILED: ${error instanceof Error ? error.stack : error}`); process.exitCode = 1; }).finally(() => db.$disconnect());
