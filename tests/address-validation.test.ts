import { describe, expect, it } from "vitest";
import { addressSchema } from "@/lib/address-validation";

const valid = { label: "Home", recipient: "Alex Smith", line1: "10 King Street", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU" };

describe("Australian address validation", () => {
  it("accepts a normal Australian delivery address", () => { expect(addressSchema.safeParse(valid).success).toBe(true); });
  it("rejects unknown states and malformed postcodes", () => {
    expect(addressSchema.safeParse({ ...valid, state: "XX" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, postcode: "500" }).success).toBe(false);
  });
});
