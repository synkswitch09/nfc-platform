import { describe, expect, it } from "vitest";
import { commerceEventSchema, commercePayload, purchaseEligible, purchaseParams } from "@/lib/commerce-analytics";
import { parseRuntimeConfig } from "@/lib/config";

describe("store-scoped commerce measurement", () => {
  it("keeps streams separate and rejects the old shared identifier", () => {
    const config = parseRuntimeConfig({ APP_ENV: "development", ANALYTICS_GA4_STORES: JSON.stringify({ tapkin: { measurementId: "G-ABCDEF1234", apiSecret: "secret-for-tapkin" }, demo: { measurementId: "G-ZYXWVU9876", apiSecret: "secret-for-demo" } }) });
    expect(config.analyticsStores.tapkin.measurementId).not.toBe(config.analyticsStores.demo.measurementId);
    expect(() => parseRuntimeConfig({ APP_ENV: "development", ANALYTICS_ID: "G-ABCDEF1234" })).toThrow("Use per-store");
    expect(() => parseRuntimeConfig({ APP_ENV: "development", ANALYTICS_GA4_STORES: JSON.stringify({ tapkin: { measurementId: "G-ABCDEF1234", apiSecret: "secret-for-tapkin" }, demo: { measurementId: "G-ABCDEF1234", apiSecret: "secret-for-demo" } }) })).toThrow("separate GA4");
  });

  it("does not include caller-supplied personal fields or private claim tokens", () => {
    const event = commerceEventSchema.parse({ event: "purchase", clientId: "123.456", orderId: "edc19676-41d5-4f57-98f4-6a08d32714d3", claimToken: "a-private-claim-token-value", email: "person@example.com", publicTagId: "PRIVATE" });
    if (event.event !== "purchase") throw new Error("Expected purchase");
    expect(event).not.toHaveProperty("email");
    const order = { id: event.orderId, currency: "AUD", totalCents: 2495,
      guestEmail: "person@example.com", publicTagId: "PRIVATE", items: [{ variantId: "26d186ad-b40d-43ed-8052-cf9aa84e8f2a", quantity: 1, unitPriceCents: 2495, productName: "Personalised secret" }] };
    const params = purchaseParams(order);
    const payload = commercePayload(event.event, params, event.clientId);
    expect(JSON.stringify(payload)).not.toMatch(/person@example.com|PRIVATE|Personalised secret|claimToken|page_location|referrer/);
    expect(payload.events[0].params.transaction_id).toBe(event.orderId);
  });

  it("counts only settled purchases and requires bounded events", () => {
    expect(purchaseEligible("PAYMENT_PENDING")).toBe(false);
    expect(purchaseEligible("PAID")).toBe(true);
    expect(purchaseEligible("REFUNDED")).toBe(false);
    expect(commerceEventSchema.safeParse({ event: "view_item", clientId: "1.2", productId: "abc" }).success).toBe(false);
  });
});
