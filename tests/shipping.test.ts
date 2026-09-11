import { describe, expect, it } from "vitest";
import { packPhysicalLines, postcodeMatches, shippingCartHash, shippingDestinationHash, zoneMatches } from "@/lib/shipping";
import { shippingProviderAdapter } from "@/lib/shipping-providers";

describe("shipping security and packing", () => {
  it("creates stable cart hashes while detecting quantity and personalisation changes", () => {
    const first = shippingCartHash([{ variantId: "v1", quantity: 1, personalisation: { colour: "ocean", name: "Pixel" } }]);
    expect(shippingCartHash([{ variantId: "v1", quantity: 1, personalisation: { name: "Pixel", colour: "ocean" } }])).toBe(first);
    expect(shippingCartHash([{ variantId: "v1", quantity: 2, personalisation: { name: "Pixel", colour: "ocean" } }])).not.toBe(first);
  });

  it("binds a quote to the complete normalised delivery address", () => {
    const destination = { line1: "1 Test Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" as const };
    expect(shippingDestinationHash(destination)).toBe(shippingDestinationHash({ ...destination, line1: " 1 TEST STREET " }));
    expect(shippingDestinationHash(destination)).not.toBe(shippingDestinationHash({ ...destination, postcode: "5001" }));
  });

  it("matches zones by country, state and inclusive postcode ranges", () => {
    expect(postcodeMatches("5000", [{ from: 5000, to: 5999 }])).toBe(true);
    expect(zoneMatches({ country: "AU", state: "SA", postcode: "5000" }, { countries: ["AU"], states: ["SA"], postcodeRules: [{ from: 5000, to: 5999 }] })).toBe(true);
    expect(zoneMatches({ country: "AU", state: "VIC", postcode: "3000" }, { countries: ["AU"], states: ["SA"], postcodeRules: [] })).toBe(false);
  });

  it("packs combined and separately shipped lines without dropping quantity", () => {
    expect(packPhysicalLines([
      { quantity: 2, weightGrams: 40, lengthMm: 50, widthMm: 40, heightMm: 8, shipsSeparately: false },
      { quantity: 2, weightGrams: 100, lengthMm: 120, widthMm: 80, heightMm: 30, shipsSeparately: true },
    ], { emptyWeightGrams: 20, lengthMm: 100, widthMm: 70, heightMm: 20 })).toEqual([
      { quantity: 1, weightGrams: 100, lengthMm: 100, widthMm: 70, heightMm: 20 },
      { quantity: 2, weightGrams: 120, lengthMm: 120, widthMm: 80, heightMm: 30 },
    ]);
  });

  it("applies only configured manual rates and free-shipping thresholds", async () => {
    const rates = await shippingProviderAdapter("MANUAL").quote({ destination: { line1: "1 Test Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" }, parcels: [{ quantity: 1, weightGrams: 250, lengthMm: 100, widthMm: 80, heightMm: 40 }], subtotalCents: 6000, currency: "AUD" }, [{ providerKey: "manual", serviceCode: "STANDARD", serviceName: "Standard", amountCents: 900, freeOverCents: 6000, minWeightGrams: null, maxWeightGrams: 500, estimatedDaysMin: 2, estimatedDaysMax: 6 }]);
    expect(rates[0]?.amountCents).toBe(0);
  });
});
