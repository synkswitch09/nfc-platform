import { describe, expect, it } from "vitest";
import { buildEtsyInventoryPayload, codeChallenge } from "@/lib/etsy";

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
});
