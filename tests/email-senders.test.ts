import { describe, expect, it } from "vitest";
import { defaultStoreSender, emailCategories, emailSendersSchema, parseEmailSenders, resolveEmailSender, orderEmailCategory, ticketSupportFooter } from "@/lib/email-senders";
import { parseAccountConfig } from "@/lib/account-config";

describe("store email senders", () => {
  it("uses the production primary domain even when staging is listed first", () => {
    expect(defaultStoreSender([
      { hostname: "staging.new-store.example", environment: "STAGING", isPrimary: true },
      { hostname: "www.new-store.example", environment: "PRODUCTION", isPrimary: true }
    ])).toBe("hello@new-store.example");
    expect(defaultStoreSender([{ hostname: "staging.new-store.example", environment: "STAGING", isPrimary: true }])).toBe("hello@new-store.example");
    expect(defaultStoreSender([])).toBe("");
  });
  it("provides distinct branded senders for each message category", () => {
    const settings = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    expect(emailCategories.map(category => resolveEmailSender(settings, category, "hello@kosykin.com.au").address)).toEqual(["hello@kosykin.com.au", "orders@kosykin.com.au", "accounts@kosykin.com.au", "promotions@kosykin.com.au", "support@kosykin.com.au"]);
    expect(resolveEmailSender(settings, "orders", "hello@kosykin.com.au").from).toBe("Kosykin Orders <orders@kosykin.com.au>");
  });
  it("falls back to the CMS default then the store domain default for empty category addresses", () => {
    const settings = parseEmailSenders(undefined, "hello@tapkin.com.au", "Tapkin");
    settings.orders = { address: "", name: "" }; settings.default = { address: "notifications@tapkin.com.au", name: "Tapkin" };
    expect(resolveEmailSender(settings, "orders", "hello@tapkin.com.au").from).toBe("Tapkin <notifications@tapkin.com.au>");
    settings.default.address = "";
    expect(resolveEmailSender(settings, "orders", "hello@tapkin.com.au").address).toBe("hello@tapkin.com.au");
  });
  it("blocks another brand or an unverified subdomain even if stored data bypassed the CMS", () => {
    const settings = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    for (const address of ["orders@tapkin.com.au", "hello@news.kosykin.com.au", "support@kosykin.com.au.evil.test"]) {
      settings.orders.address = address;
      expect(() => resolveEmailSender(settings, "orders", "hello@kosykin.com.au")).toThrow("configured sending domain");
    }
  });
  it("rejects injected sender names and malformed addresses", () => {
    const settings = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    settings.support.name = "Kosykin\r\nBcc: someone@example.test";
    expect(emailSendersSchema.safeParse(settings).success).toBe(false);
    settings.support.name = "Kosykin"; settings.support.address = "not-an-email";
    expect(emailSendersSchema.safeParse(settings).success).toBe(false);
  });
  it("preserves email settings when parsing account settings", () => {
    const emailSenders = parseEmailSenders(undefined, "hello@kosykin.com.au", "Kosykin");
    expect(parseAccountConfig({ appleEnabled: false, emailSenders }).emailSenders).toEqual(emailSenders);
  });
  it("routes durable support and reward notices separately from order updates", () => {
    expect(orderEmailCategory("support:ticket-123:time")).toBe("support");
    expect(orderEmailCategory("next-purchase:order-123")).toBe("promotions");
    expect(orderEmailCategory("paid:order-123:customer@example.test")).toBe("orders");
    expect(orderEmailCategory(null)).toBe("orders");
  });
  it("directs customer service to authenticated tickets without inviting email replies", () => {
    const footer = ticketSupportFooter("https://kosykin.com.au");
    expect(footer).toContain("Replies to this address are not monitored");
    expect(footer).toContain("https://kosykin.com.au/dashboard/help");
    expect(footer).not.toContain("mailto:");
  });
});
