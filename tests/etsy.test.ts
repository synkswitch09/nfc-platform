import { describe, expect, it } from "vitest";
import { buildEtsyInventoryPayload, codeChallenge, etsyMoneyToCents, normaliseEtsyReceipt } from "@/lib/etsy";

describe("Etsy marketplace sync", () => {
  it("uses the required PKCE SHA-256 URL-safe challenge", () => {
    expect(codeChallenge("vvkdljkejllufrvbhgeiegrnvufrhvrffnkvcknjvfid")).toBe("DSWlW2Abh-cf8CeLL8-g3hQ2WQyYdKyiu83u_s7nRhI");
  });

  it("updates quantities and prices without discarding Etsy variation properties", () => {
    const payload = buildEtsyInventoryPayload({ products: [{ sku: "TAG-MINT-S", property_values: [{ property_id: 200, values: ["Mint"] }], offerings: [{ quantity: 2, price: 10, is_enabled: true, readiness_state_id: 4 }] }] }, [{ sku: "TAG-MINT-S", priceCents: 2495, inventory: 7, reservedInventory: 2, active: true, trackInventory: true, backorderPolicy: "DENY" }]);
    expect(payload.products?.[0]).toMatchObject({ sku: "TAG-MINT-S", property_values: [{ property_id: 200 }] });
    expect(payload.products?.[0]?.offerings?.[0]).toMatchObject({ quantity: 5, price: 24.95, is_enabled: true, readiness_state_id: 4 });
  });

  it("refuses a partial SKU mapping instead of changing the wrong Etsy variation", () => {
    expect(() => buildEtsyInventoryPayload({ products: [{ sku: "TAG-PINK", offerings: [{}] }] }, [{ sku: "TAG-MINT", priceCents: 2495, inventory: 1, reservedInventory: 0, active: true, trackInventory: true, backorderPolicy: "DENY" }])).toThrow(/SKU mapping/i);
  });

  it("normalises a paid receipt using Etsy money divisors and SKU line items", () => {
    const receipt = normaliseEtsyReceipt({ receipt_id: 12345, is_paid: true, name: "Ava Buyer", buyer_email: "ava@example.test", first_line: "1 Test Street", city: "Sydney", state: "NSW", zip: "2000", country_iso: "AU", grandtotal: { amount: 5490, divisor: 100, currency_code: "AUD" }, total_shipping_cost: { amount: 500, divisor: 100, currency_code: "AUD" }, transactions: [{ listing_id: 987, sku: "TAG-MINT-S", quantity: 2, title: "Mint tag", price: { amount: 2495, divisor: 100, currency_code: "AUD" }, variations: [{ formatted_name: "Name", formatted_value: "Milo" }] }] });
    expect(receipt).toMatchObject({ externalId: "12345", currency: "AUD", totalCents: 5490, shippingCents: 500, customerName: "Ava Buyer", lines: [{ listingId: "987", sku: "TAG-MINT-S", quantity: 2, unitPriceCents: 2495 }] });
  });

  it("rejects an unpaid or malformed receipt before it can affect inventory", () => {
    expect(() => normaliseEtsyReceipt({ receipt_id: 12345, is_paid: false, transactions: [] })).toThrow(/not paid/i);
    expect(() => etsyMoneyToCents({ amount: 2495, divisor: 3 }, "price")).toThrow(/divisor/i);
  });
});
