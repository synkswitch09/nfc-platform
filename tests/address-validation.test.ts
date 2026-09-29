import { describe, expect, it } from "vitest";
import { addressFieldsForCountry, addressSchema, countryAddressSchema } from "@/lib/address-validation";
import { ManualAddressProvider } from "@/lib/address-autocomplete";

describe("country-aware addresses", () => {
  it("validates Australian labels and postcode rules", () => {
    expect(addressFieldsForCountry("AU")).toMatchObject({ localityLabel: "Suburb", administrativeAreaLabel: "State", postalCodeRequired: true });
    expect(countryAddressSchema.parse({ line1: "1 King Street", locality: "Adelaide", administrativeArea: "SA", postcode: "5000", country: "au" }).country).toBe("AU");
    expect(() => countryAddressSchema.parse({ line1: "1 King Street", locality: "Adelaide", administrativeArea: "SA", postcode: "50", country: "AU" })).toThrow();
  });

  it("supports Colombia without making postal code mandatory", () => {
    expect(addressFieldsForCountry("CO")).toMatchObject({ localityLabel: "City / municipality", administrativeAreaLabel: "Department", postalCodeRequired: false });
    expect(countryAddressSchema.parse({ line1: "Carrera 7 # 1-20", locality: "Bogotá", administrativeArea: "Bogotá D.C.", postcode: "", country: "CO" })).toMatchObject({ country: "CO", postcode: "" });
  });

  it("supports UK and generic manual addresses", () => {
    expect(countryAddressSchema.parse({ line1: "10 High Street", locality: "London", postcode: "SW1A 1AA", country: "GB" }).country).toBe("GB");
    expect(countryAddressSchema.parse({ line1: "Rue Exemple 10", locality: "Paris", postcode: "", country: "FR" }).country).toBe("FR");
  });

  it("keeps saved-address identity fields separate", () => {
    expect(addressSchema.parse({ recipient: "Daniel Escobar", label: "Home", line1: "1 Test Street", locality: "Adelaide", administrativeArea: "SA", postcode: "5000", country: "AU" })).toMatchObject({ recipient: "Daniel Escobar", label: "Home" });
  });

  it("keeps checkout usable when no autocomplete provider is configured", async () => {
    const provider = new ManualAddressProvider();
    await expect(provider.suggest("1 Test", "AU")).resolves.toEqual([]);
    await expect(provider.resolve("missing")).rejects.toThrow("Manual address entry");
  });
});
