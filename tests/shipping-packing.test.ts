import { describe, expect, it } from "vitest";
import { packCheckoutParcels } from "@/lib/shipping";

const outer = { lengthMm: 300, widthMm: 250, heightMm: 250, emptyWeightGrams: 0, maxWeightGrams: null };
const mailer = { lengthMm: 250, widthMm: 150, emptyWeightGrams: 0, maxWeightGrams: null };

describe("checkout parcel packing", () => {
  it("uses the individual box for a single item", () => {
    expect(packCheckoutParcels([{ quantity: 1, weightGrams: 800, lengthMm: 270, widthMm: 160, heightMm: 120, shipsSeparately: false, packageType: "BOX" }], outer, mailer)).toEqual([{ quantity: 1, weightGrams: 800, lengthMm: 270, widthMm: 160, heightMm: 120 }]);
  });
  it("fits two larger boxes or six smaller boxes into each exterior carton", () => {
    const large = packCheckoutParcels([{ quantity: 3, weightGrams: 800, lengthMm: 270, widthMm: 160, heightMm: 120, shipsSeparately: false, packageType: "BOX" }], outer, mailer);
    expect(large).toEqual([{ quantity: 1, weightGrams: 1600, lengthMm: 300, widthMm: 250, heightMm: 250 }, { quantity: 1, weightGrams: 800, lengthMm: 270, widthMm: 160, heightMm: 120 }]);
    const small = packCheckoutParcels([{ quantity: 7, weightGrams: 300, lengthMm: 150, widthMm: 120, heightMm: 90, shipsSeparately: false, packageType: "BOX" }], outer, mailer);
    expect(small).toEqual([{ quantity: 1, weightGrams: 1800, lengthMm: 300, widthMm: 250, heightMm: 250 }, { quantity: 1, weightGrams: 300, lengthMm: 150, widthMm: 120, heightMm: 90 }]);
  });
  it("keeps small tags in mailers and boxed goods in a separate parcel", () => {
    const parcels = packCheckoutParcels([
      { quantity: 3, weightGrams: 30, lengthMm: 250, widthMm: 150, heightMm: 8, itemLengthMm: 65, itemWidthMm: 40, shipsSeparately: false, packageType: "MAILER" },
      { quantity: 1, weightGrams: 600, lengthMm: 270, widthMm: 160, heightMm: 120, shipsSeparately: false, packageType: "BOX" },
    ], outer, mailer);
    expect(parcels).toEqual([{ quantity: 1, weightGrams: 90, lengthMm: 250, widthMm: 150, heightMm: 8 }, { quantity: 1, weightGrams: 600, lengthMm: 270, widthMm: 160, heightMm: 120 }]);
  });
});
