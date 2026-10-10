import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const emailOutbox = process.env.E2E_EMAIL_OUTBOX ?? "/tmp/nfc-e2e-email-outbox.ndjson";
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

async function requestThroughLoopback(url, { method, headers, body, redirect }) {
  if (body instanceof FormData) throw new Error("Host-routed E2E requests do not support multipart bodies");
  const response = await new Promise((resolve, reject) => {
    const outgoing = httpRequest({ hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method, headers: Object.fromEntries(headers.entries()) }, incoming => {
      const chunks = [];
      incoming.on("data", chunk => chunks.push(chunk));
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) responseHeaders.append(name, item);
        }
        resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode ?? 500, headers: responseHeaders }));
      });
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
  const location = response.headers.get("location");
  if (redirect !== "manual" && location && [301, 302, 303, 307, 308].includes(response.status)) {
    const nextUrl = new URL(location, url);
    const nextMethod = response.status === 303 ? "GET" : method;
    return requestThroughLoopback(nextUrl, { method: nextMethod, headers, body: nextMethod === "GET" ? undefined : body, redirect });
  }
  return response;
}

async function request(path, { method = "GET", json, body, headers = {}, jar = new Map(), redirect = "follow", host } = {}) {
  const requestHeaders = new Headers(headers);
  const requestHost = host ? `${host}:${new URL(origin).port || "3000"}` : new URL(origin).host;
  if (host) requestHeaders.set("host", requestHost);
  if (method !== "GET" && method !== "HEAD") requestHeaders.set("origin", `${new URL(origin).protocol}//${requestHost}`);
  if (json !== undefined) { requestHeaders.set("content-type", "application/json"); body = JSON.stringify(json); }
  const cookies = cookieHeader(jar); if (cookies) requestHeaders.set("cookie", cookies);
  const url = new URL(path, origin);
  const response = host
    ? await requestThroughLoopback(url, { method, headers: requestHeaders, body, redirect })
    : await fetch(url, { method, headers: requestHeaders, body, redirect });
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

async function latestVerificationCode() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const outbox = await readFile(emailOutbox, "utf8").catch(() => "");
    const matches = [...outbox.matchAll(/verification code is (\d{6})/g)];
    if (matches.length) return matches.at(-1)[1];
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Email verification code was not captured in the isolated E2E outbox");
}

async function main() {
  await waitForHealth();
  const suffix = Date.now().toString(36);
  const guestEmail = `e2e-guest-${suffix}@example.test`;
  const guestPassword = "GuestPassword123";
  const customerJar = new Map(); const adminJar = new Map();
  const tapkinStore = await db.store.findUnique({ where: { slug: "tapkin" } });
  const homeStore = await db.store.findUnique({ where: { slug: "home-demo" } });
  assert(Boolean(tapkinStore) && Boolean(homeStore), "Development seed contains isolated Tapkin and Home Demo Stores");

  // FLOW A — guest purchase through the real HTTP boundary and test payment settlement.
  for (const path of ["/", "/categories/pets", "/shop?category=pets", "/products/tapkin-pet-tag", "/cart", "/checkout"]) {
    const response = await request(path); assert(response.status === 200, `Guest can browse ${path}`);
  }
  const homePage = await bodyText(await request("/", { host: "home.localhost" }));
  assert(homePage.text.includes("Home Demo") && !homePage.text.includes("Activate a product"), "Home Demo resolves by Host with isolated branding and no NFC CTA");
  const homeProduct = await request("/products/minimal-phone-stand", { host: "home.localhost" });
  const leakedTapkinProduct = await request("/products/tapkin-pet-tag", { host: "home.localhost" });
  const leakedHomeProduct = await request("/products/minimal-phone-stand");
  assert(homeProduct.status === 200 && leakedTapkinProduct.status === 404 && leakedHomeProduct.status === 404, "Product routes cannot leak across Stores");
  const seededVariant = await db.productVariant.findUnique({ where: { sku: "PET-TAG-001" } });
  assert(Boolean(seededVariant), "Seeded checkout variant exists");
  const destination = {
    line1: "1 Test Street",
    locality: "Adelaide",
    administrativeArea: "SA",
    postcode: "5000",
    country: "AU",
  };
  await jsonResponse(await request("/api/shipping/quotes", { method: "POST", json: { items: [{ variantId: seededVariant.id, quantity: 0 }], destination } }), 400, "Shipping quote rejects invalid quantities");
  await jsonResponse(await request("/api/shipping/quotes", { method: "POST", json: { items: [{ variantId: "00000000-0000-4000-8000-000000000000", quantity: 1 }], destination } }), 409, "Shipping quote rejects unavailable variants");
  const quotedItems = [{ variantId: seededVariant.id, quantity: 1, unitPriceCents: 1, personalisationChoice: "BASIC", personalisation: { colour: "ocean", shape: "round", size: "small" } }];
  const shippingQuotes = await jsonResponse(await request("/api/shipping/quotes", { method: "POST", json: { items: quotedItems, destination } }), 200, "Server returns Store-scoped delivery quotes");
  assert(shippingQuotes.quotes.length > 0 && shippingQuotes.quotes[0].token, "Delivery quote includes an opaque checkout token");
  const checkout = await jsonResponse(await request("/api/checkout", { method: "POST", json: {
    items: quotedItems,
    shippingQuoteToken: shippingQuotes.quotes[0].token,
    customer: { name: "E2E Guest", email: guestEmail, shipping: destination },
  } }), 200, "Guest checkout succeeds without an account");
  assert(checkout.testMode === true, "Test payment flow settles the order");
  const successUrl = new URL(checkout.url); const successPage = await bodyText(await request(`${successUrl.pathname}${successUrl.search}`));
  assert(successPage.lower.includes("payment received"), "Guest reaches order success page");
  const orderNumber = successUrl.pathname.split("/").at(-2); const claimToken = successUrl.searchParams.get("token");
  const paidOrder = await db.order.findUnique({ where: { orderNumber } });
  assert(paidOrder?.status === "PAID", "Server settled paid order state");
  assert(paidOrder?.storeId === tapkinStore.id, "Order snapshots the server-resolved Tapkin Store");
  assert(paidOrder?.totalCents !== 1, "Client price tampering is ignored");
  const manufacturingJob = await db.manufacturingJob.findFirst({ where: { orderItem: { orderId: paidOrder.id } } });
  assert(manufacturingJob?.storeId === tapkinStore.id && manufacturingJob.requiresNfc, "Paid Tapkin item creates Store-scoped 3D and NFC manufacturing work");
  const payment = await db.payment.findFirst({ where: { orderId: paidOrder.id } });
  const stripeEventId = `evt_e2e_${suffix}`;
  const stripePayload = JSON.stringify({ id: stripeEventId, object: "event", type: "checkout.session.completed", data: { object: { id: payment.providerSessionId, object: "checkout.session", metadata: { orderId: paidOrder.id, storeId: tapkinStore.id, storeSlug: tapkinStore.slug }, payment_status: "paid", amount_total: paidOrder.totalCents, currency: "aud", payment_intent: `pi_e2e_${suffix}` } } });
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": "invalid" } }), 400, "Stripe webhook rejects an invalid signature");
  const stripe = new Stripe("e2e-not-a-real-stripe-key");
  const stripeSignature = stripe.webhooks.generateTestHeaderString({ payload: stripePayload, secret: stripeWebhookSecret });
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": stripeSignature } }), 200, "Stripe webhook accepts a valid signature");
  await jsonResponse(await request("/api/stripe/webhook", { method: "POST", body: stripePayload, headers: { "content-type": "application/json", "stripe-signature": stripeSignature } }), 200, "Stripe webhook handles a duplicate event idempotently");
  assert(await db.webhookEvent.count({ where: { id: stripeEventId } }) === 1, "Duplicate Stripe event is persisted only once");

  // FLOW B — create and verify an account after purchase; the previous order is attached.
  const registered = await jsonResponse(await request("/api/auth/register", { method: "POST", jar: customerJar, json: { name: "E2E Customer", email: guestEmail, password: guestPassword, orderNumber, orderClaimToken: claimToken } }), 201, "Guest creates an account from the purchase");
  assert(registered.verificationRequired === true, "New password account requires email verification");
  const pendingDashboard = await request("/dashboard", { jar: customerJar, redirect: "manual" });
  assert([302, 303, 307, 308].includes(pendingDashboard.status) && (pendingDashboard.headers.get("location") ?? "").includes("/verify-email"), "Unverified session cannot access dashboard");
  const verificationCode = await latestVerificationCode();
  await jsonResponse(await request("/api/auth/verify-email", { method: "POST", jar: customerJar, json: { code: verificationCode === "000000" ? "000001" : "000000" } }), 400, "Incorrect verification code is rejected");
  const verification = await jsonResponse(await request("/api/auth/verify-email", { method: "POST", jar: customerJar, json: { code: verificationCode } }), 200, "Email ownership verification completes");
  assert(verification.verified === true, "Correct code verifies the account");
  const dashboard = await bodyText(await request("/dashboard", { jar: customerJar }));
  assert(dashboard.text.includes(orderNumber), "Previous guest purchase appears in the account");
  const crossStoreDashboard = await request("/dashboard", { host: "home.localhost", jar: customerJar, redirect: "manual" });
  assert([302, 303, 307, 308].includes(crossStoreDashboard.status), "A Tapkin session is not accepted by Home Demo");
  await jsonResponse(await request("/api/admin/products", { method: "POST", jar: customerJar, json: {} }), 403, "Customer cannot escalate into Product Admin");

  // FLOW C — tag/account management is never available anonymously.
  const anonymousDashboard = await request("/dashboard", { redirect: "manual" });
  assert([302, 303, 307, 308].includes(anonymousDashboard.status) && (anonymousDashboard.headers.get("location") ?? "").includes("/login"), "Anonymous NFC management requires authentication");

  // FLOW D — administrator creates, images, stocks and publishes a product.
  await jsonResponse(await request("/api/admin/products", { method: "POST", json: {} }), 403, "Customerless request is rejected by Product Admin");
  const login = await jsonResponse(await request("/api/auth/login", { method: "POST", jar: adminJar, json: { email: adminEmail, password: adminPassword } }), 200, "Development administrator can sign in");
  assert(login.user.role === "ADMIN", "Administrator role is enforced");
  // FLOW M — measurement boundaries and durable deduplication, using only the disposable DB.
  const beforeMeasurement = await db.store.findUniqueOrThrow({ where: { id: tapkinStore.id }, select: { accountConfig: true } });
  await jsonResponse(await request("/api/admin/settings/integrations", { method: "PATCH", jar: adminJar, json: { analyticsEnabled: true, ga4MeasurementId: "G-E2E1234567", clarityEnabled: true, clarityProjectId: "e2eclarity", metaPixelEnabled: true, metaCapiEnabled: true, metaPixelId: "999999999901", metaCatalogEnabled: true, metaCatalogId: "999999999902" } }), 200, "CMS stores phase-four integration controls without private credentials");
  const disabledConsent = new Map([["privacy-preferences-tapkin", encodeURIComponent(JSON.stringify({ version: 1, analytics: true, advertising: true, savedAt: Date.now() }))]]);
  await jsonResponse(await request("/api/analytics/session", { method: "POST", jar: disabledConsent, json: { clientId: "123.456" } }), 404, "Development cannot start live measurement even with all CMS switches enabled");
  await jsonResponse(await request("/api/analytics", { method: "POST", jar: disabledConsent, json: { event: "view_item", eventId: paidOrder.id, productId: paidOrder.items?.[0]?.variantId ?? paidOrder.id } }), 404, "Development shopping events never reach live providers");
  assert((await request("/api/analytics/pixel", { jar: disabledConsent })).status === 404, "Pixel document is unavailable outside production");
  assert((await request("/api/meta/catalog")).status === 404, "Development cannot serve a live Meta catalog");
  const measurementResponse = await request("/admin/settings/measurement", { jar: adminJar });
  const measurementPage = await bodyText(measurementResponse);
  assert(measurementResponse.status === 200 && measurementPage.text.includes("Measurement &amp; catalog"), "CMS delivery status is available to the administrator", `received ${measurementResponse.status}`);
  const measurementSession = await db.measurementSession.create({ data: { tokenHash: `e2e-measurement-${suffix}`, storeId: tapkinStore.id, clientId: "123.456", sessionId: "123", analytics: true, advertising: false, expiresAt: new Date(Date.now() + 3600_000) } });
  const eventKey = `e2e-purchase:${suffix}`;
  await Promise.all(Array.from({ length: 4 }, () => db.measurementDelivery.upsert({ where: { storeId_provider_eventKey: { storeId: tapkinStore.id, provider: "GA4", eventKey } }, create: { storeId: tapkinStore.id, sessionId: measurementSession.id, provider: "GA4", targetId: "G-E2E1234567", eventKey, eventName: "purchase", payload: { transaction_id: paidOrder.id, value: 1, currency: "AUD" } }, update: {} })));
  assert(await db.measurementDelivery.count({ where: { storeId: tapkinStore.id, provider: "GA4", eventKey } }) === 1, "Concurrent event retries create only one durable provider delivery");
  await db.order.update({ where: { id: paidOrder.id }, data: { measurementSessionId: measurementSession.id } });
  await db.measurementSession.delete({ where: { id: measurementSession.id } });
  assert(await db.measurementDelivery.count({ where: { sessionId: measurementSession.id } }) === 0, "Anonymous session deletion also removes its measurement deliveries");
  assert((await db.order.findUniqueOrThrow({ where: { id: paidOrder.id } })).measurementSessionId === null, "Retention cleanup removes the measurement pointer without deleting the order");
  await db.store.update({ where: { id: tapkinStore.id }, data: { accountConfig: beforeMeasurement.accountConfig } });

  // FLOW S — verified guest support, private replies and preparation interlocks.
  const supportJar = new Map();
  await jsonResponse(await request("/api/support/tickets"), 401, "Guests cannot read tickets before email verification");
  await jsonResponse(await request(`/api/orders/${paidOrder.id}/support`, { method: "POST", json: { kind: "CANCELLATION_REQUEST", message: "Please review cancellation", claimToken } }), 401, "Checkout claim token cannot bypass support email verification");
  const supportPage = await bodyText(await request("/support"));
  assert(supportPage.text.includes("Access your tickets") && !supportPage.text.includes(orderNumber), "Guest support entry reveals no order data");
  const challenge = await jsonResponse(await request("/api/support/access", { method: "POST", jar: supportJar, json: { email: guestEmail } }), 202, "Guest can request a support verification code");
  const supportCode = await latestVerificationCode();
  await jsonResponse(await request("/api/support/access", { method: "PATCH", jar: supportJar, json: { challengeId: challenge.challengeId, code: supportCode === "000000" ? "000001" : "000000" } }), 400, "Incorrect support code is rejected");
  await jsonResponse(await request("/api/support/access", { method: "PATCH", jar: supportJar, json: { challengeId: challenge.challengeId, code: supportCode } }), 200, "Guest email verification creates private support access");
  await jsonResponse(await request("/api/support/access", { method: "PATCH", jar: supportJar, json: { challengeId: challenge.challengeId, code: supportCode } }), 400, "Support verification code cannot be replayed");
  await jsonResponse(await request("/api/support/tickets", { jar: supportJar, host: "home.localhost" }), 401, "Guest support access is isolated by store");
  const guestTickets = await jsonResponse(await request("/api/support/tickets", { jar: supportJar }), 200, "Verified guest sees own order choices");
  assert(guestTickets.orders.some(o => o.orderNumber === orderNumber), "Verified email matches an order even after account claim");
  const generalTicket = await jsonResponse(await request("/api/support/tickets", { method: "POST", jar: supportJar, json: { kind: "PRIVACY", message: "Please explain data retention for my account" } }), 201, "Verified guest can create a privacy ticket without an order");
  assert(generalTicket.held === false, "General tickets never pause unrelated orders");
  await jsonResponse(await request("/api/support/tickets", { method: "POST", jar: supportJar, json: { kind: "CANCELLATION_REQUEST", message: "Please review cancellation", orderNumber: "NO-SUCH-ORDER" } }), 404, "Verified email cannot request changes to unrelated orders");
  const pausedTicket = await jsonResponse(await request("/api/support/tickets", { method: "POST", jar: supportJar, json: { kind: "CANCELLATION_REQUEST", message: "Please pause and review cancellation", orderNumber } }), 201, "Verified cancellation request creates a review ticket");
  assert(pausedTicket.held && await db.order.count({ where: { id: paidOrder.id, status: "PAID" } }) === 1, "Unstarted order is paused without cancelling or refunding it");
  await jsonResponse(await request(`/api/admin/orders/${paidOrder.id}/status`, { method: "POST", jar: adminJar, json: { status: "PROCESSING" } }), 409, "Order cannot begin preparation while a ticket pause is active");
  await jsonResponse(await request(`/api/admin/manufacturing/jobs/${manufacturingJob.id}`, { method: "POST", jar: adminJar, json: { status: "PRINTING" } }), 409, "Printing cannot bypass a ticket pause");
  const pausedLine = await db.orderItem.findFirst({ where: { orderId: paidOrder.id } });
  await jsonResponse(await request(`/api/admin/orders/${paidOrder.id}/items/${pausedLine.id}/pack`, { method: "POST", jar: adminJar, json: { quantity: 0 } }), 409, "Packing cannot bypass a ticket pause");
  await jsonResponse(await request(`/api/support/tickets/${pausedTicket.id}/messages`, { method: "POST", json: { message: "Unverified message" } }), 401, "Anonymous callers cannot append messages");
  await jsonResponse(await request(`/api/support/tickets/${pausedTicket.id}/messages`, { method: "POST", jar: supportJar, json: { message: "Please retain my request while you review" } }), 200, "Guest follows up within the existing verified ticket");
  const ticketBeforeReply = await db.orderSupportRequest.findUnique({ where: { id: pausedTicket.id } });
  const updateTicket = { status: "RESOLVED", priority: "HIGH", response: "We reviewed your request and agreed to continue with your order.", note: "PRIVATE INTERNAL E2E NOTE", notifyCustomer: true, expectedUpdatedAt: ticketBeforeReply.updatedAt.toISOString() };
  await jsonResponse(await request(`/api/admin/support/${pausedTicket.id}`, { method: "PATCH", jar: adminJar, json: updateTicket }), 409, "Resolving a paused ticket requires explicit release and reason");
  await jsonResponse(await request(`/api/admin/support/${pausedTicket.id}`, { method: "PATCH", jar: adminJar, json: { ...updateTicket, releaseHold: true, releaseReason: "Customer and team agreed to continue production" } }), 200, "Support team records a public reply and releases the preparation pause");
  await jsonResponse(await request(`/api/admin/support/${pausedTicket.id}`, { method: "PATCH", jar: adminJar, json: updateTicket }), 409, "Stale support edits cannot overwrite newer replies");
  const customerTickets = await jsonResponse(await request("/api/support/tickets", { jar: customerJar }), 200, "Verified account sees tickets created as a guest with the same email");
  assert(!JSON.stringify(customerTickets).includes("PRIVATE INTERNAL E2E NOTE") && customerTickets.tickets.some(t => t.id === pausedTicket.id && t.replies.some(r => r.author === "team")), "Private notes stay internal while public replies appear in the account");
  assert((await db.orderSupportRequest.findUnique({ where: { id: pausedTicket.id } })).firstRespondedAt, "Only a public team reply records first response");
  const competing = await Promise.all([
    request(`/api/admin/orders/${paidOrder.id}/status`, { method: "POST", jar: adminJar, json: { status: "PROCESSING" } }),
    request("/api/support/tickets", { method: "POST", jar: supportJar, json: { kind: "ADDRESS_CHANGE", message: "Please review my address before beginning preparation", orderNumber } }),
  ]);
  const raceTicket = await competing[1].json(), raceOrder = await db.order.findUnique({ where: { id: paidOrder.id } });
  assert(competing[1].status === 201 && ((raceTicket.held && raceOrder.status === "PAID" && competing[0].status === 409) || (!raceTicket.held && raceOrder.status === "PROCESSING" && competing[0].status === 200)), "Concurrent request and preparation start produce one consistent order outcome");
  if (raceTicket.held) {
    const heldRow = await db.orderSupportRequest.findUnique({ where: { id: raceTicket.id } });
    await jsonResponse(await request(`/api/admin/support/${raceTicket.id}`, { method: "PATCH", jar: adminJar, json: { status: "RESOLVED", releaseHold: true, releaseReason: "Disposable test order reviewed for continued preparation", expectedUpdatedAt: heldRow.updatedAt.toISOString() } }), 200, "Race-created pause can be released after review");
  }
  await jsonResponse(await request("/api/support/access", { method: "DELETE", jar: supportJar }), 200, "Guest can clear support access from this browser");
  await jsonResponse(await request("/api/support/tickets", { jar: supportJar }), 401, "Cleared guest access cannot reopen tickets");

  // CMS email drafts, preview, publication and tests use the active store only.
  const templateDesign = { subject: "{{email.subject}}", preheader: "An update from {{store.name}}", accent: "#284B63", blocks: [{ type: "text", text: "E2E design for {{store.name}} and {{customer.name}}" }] };
  const emailPage = await bodyText(await request("/admin/email-templates", { jar: adminJar }));
  assert(emailPage.text.includes("Email templates"), "Email template editor is available in CMS");
  const emailPreview = await jsonResponse(await request("/api/admin/email-templates", { method: "POST", jar: adminJar, json: { action: "preview", key: "verification", template: templateDesign } }), 200, "CMS previews safe example data");
  assert(emailPreview.html.includes("123456") && emailPreview.html.includes("E2E design for Tapkin"), "Preview keeps mandatory verification details");
  const templateDraft = await jsonResponse(await request("/api/admin/email-templates", { method: "POST", jar: adminJar, json: { action: "save", key: "verification", template: templateDesign, revision: 0 } }), 200, "CMS saves a draft without changing live emails");
  assert(templateDraft.entry.published === null, "Draft stays unpublished");
  await jsonResponse(await request("/api/admin/email-templates", { method: "POST", jar: adminJar, json: { action: "publish", key: "verification", template: templateDesign, revision: templateDraft.entry.revision } }), 200, "CMS publishes the reviewed design");
  const templateTest = await jsonResponse(await request("/api/admin/email-templates", { method: "POST", jar: adminJar, json: { action: "test", key: "verification", template: templateDesign } }), 200, "CMS test is captured in the development outbox");
  assert(templateTest.accepted === false, "Development test never delivers a real email");
  const outboxMessages = (await readFile(emailOutbox, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  const templateTestMessage = outboxMessages.at(-1);
  assert(templateTestMessage.to === adminEmail && templateTestMessage.html.includes("E2E design for Tapkin"), "Test goes only to the signed-in editor with HTML design");
  assert(templateTestMessage.text.includes("example data only"), "Test email explicitly marks its data as synthetic");
  const otherStoreTemplates = await db.store.findUnique({ where: { id: homeStore.id }, select: { accountConfig: true } });
  assert(!otherStoreTemplates.accountConfig?.emailTemplates?.verification, "Publishing in Tapkin does not change Home Demo email designs");
  await jsonResponse(await request("/api/admin/email-templates", { method: "POST", jar: adminJar, json: { action: "reset", key: "verification", revision: templateDraft.entry.revision + 1 } }), 200, "CMS safely restores its standard live template");
  const e2eCategory = await db.productCategory.findUnique({ where: { storeId_slug: { storeId: tapkinStore.id, slug: "pets" } } });
  assert(e2eCategory?.status === "PUBLISHED", "Published category exists for the product journey");
  const slug = `e2e-nfc-tag-${suffix}`; const sku = `E2E-${suffix.toUpperCase()}`.slice(0, 50);
  const productPayload = { name: `E2E NFC Tag ${suffix}`, slug, description: "A test-only NFC tag used by the integrated business journey.", fullDescription: "Created through Product Admin, imaged, stocked, published and then used in the NFC manufacturing flow.", categoryId: e2eCategory.id, type: "PET", status: "DRAFT", featured: false, shopVisible: false, brand: "Tapkin", gstInclusive: true, personalisationMode: "OPTIONAL", seoTitle: `E2E NFC Tag ${suffix}`, seoDescription: "Integrated test product for NFC commerce and manufacturing.", ogImageUrl: "", canonicalUrl: "", indexable: false,
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
  const homeAdminJar = new Map();
  await jsonResponse(await request("/api/auth/login", { method: "POST", host: "home.localhost", jar: homeAdminJar, json: { email: adminEmail, password: adminPassword } }), 200, "Same administrator identity can establish a separate Home Demo session");
  const homeAdmin = await bodyText(await request("/admin", { host: "home.localhost", jar: homeAdminJar }));
  assert(homeAdmin.text.includes("Home Demo") && !homeAdmin.text.includes("NFC production batches"), "Home Demo Admin keeps its Store context and hides NFC operations");

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
  assert(robots.lower.includes("disallow: /"), "Development robots blocks all crawling");
  assert(!sitemap.text.includes(`/products/${slug}`), "Development sitemap publishes no storefront URLs");
  assert(storeProduct.text.includes("application/ld+json") && storeProduct.text.includes("canonical"), "Product renders canonical metadata and structured data");
  await jsonResponse(await request("/api/auth/logout", { method: "POST", jar: customerJar }), 200, "Customer can sign out");
  const signedOutDashboard = await request("/dashboard", { jar: customerJar, redirect: "manual" });
  assert([302, 303, 307, 308].includes(signedOutDashboard.status), "Signed-out session cannot reopen the dashboard");

  console.info(`\nE2E COMPLETE: ${checks.length} assertions passed across flows A–E.`);
}

main().catch(error => { console.error(`E2E FAILED: ${error instanceof Error ? error.stack : error}`); process.exitCode = 1; }).finally(() => db.$disconnect());
