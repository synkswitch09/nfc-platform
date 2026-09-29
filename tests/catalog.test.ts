import { describe, expect, it } from "vitest";
import { assertVariantSelection, availableInventory, CatalogValidationError, normalisePersonalisation, resolvePersonalisationChoice } from "@/lib/catalog";

const options = [
  { code: "pet-name", type: "SHORT_TEXT" as const, required: true, maxLength: 12, priceDeltaCents: 0, active: true, values: [] },
  { code: "colour", type: "COLOUR" as const, required: true, maxLength: null, priceDeltaCents: 100, active: true, values: [{ value: "ocean", active: true, priceDeltaCents: 50 }] },
];

describe("catalog personalisation", () => {
  it("normalises valid selections and calculates server-side price additions", () => {
    expect(normalisePersonalisation(options, { "pet-name": " Max ", colour: "ocean" })).toEqual({ personalisation: { "pet-name": "Max" }, selectedOptions: { colour: "ocean" }, priceDeltaCents: 150 });
  });
  it("rejects missing required and unknown options", () => {
    expect(() => normalisePersonalisation(options, { colour: "ocean" })).toThrow(CatalogValidationError);
    expect(() => normalisePersonalisation(options, { "pet-name": "Max", colour: "ocean", hidden: "value" })).toThrow("Unknown personalisation option");
  });
  it("rejects values not configured by the administrator", () => {
    expect(() => normalisePersonalisation(options, { "pet-name": "Max", colour: "purple" })).toThrow("colour has an invalid value");
  });
  it("never reports negative available inventory", () => {
    expect(availableInventory({ inventory: 5, reservedInventory: 2 })).toBe(3);
    expect(availableInventory({ inventory: 1, reservedInventory: 3 })).toBe(0);
  });
  it("does not charge an optional checkbox when it is false", () => {
    const checkbox = [{ code: "gift-box", type: "CHECKBOX" as const, required: false, maxLength: null, priceDeltaCents: 500, active: true, values: [] }];
    expect(normalisePersonalisation(checkbox, { "gift-box": "false" }).priceDeltaCents).toBe(0);
    expect(normalisePersonalisation(checkbox, { "gift-box": "true" }).priceDeltaCents).toBe(500);
  });
  it("separates basic and personalised purchases while keeping colour selection", () => {
    expect(normalisePersonalisation(options, { colour: "ocean" }, "OPTIONAL", "BASIC")).toEqual({ personalisation: {}, selectedOptions: { colour: "ocean" }, priceDeltaCents: 150 });
    expect(() => normalisePersonalisation(options, { "pet-name": "Max", colour: "ocean" }, "OPTIONAL", "BASIC")).toThrow("Unknown personalisation option");
    expect(() => resolvePersonalisationChoice("REQUIRED", "BASIC")).toThrow("Personalisation is required");
    expect(resolvePersonalisationChoice("NONE", "BASIC")).toBe("BASIC");
  });
  it("binds product selections to the chosen variant", () => {
    expect(() => assertVariantSelection({ colour: "coral" }, { colour: "ocean" })).toThrow("do not match this variant");
    expect(() => assertVariantSelection({ colour: "ocean" }, { colour: "ocean" })).not.toThrow();
  });
  it("records image personalisation as an operations follow-up and applies its price", () => {
    const image = [{ code: "portrait", type: "IMAGE" as const, required: true, maxLength: null, priceDeltaCents: 700, active: true, values: [] }];
    expect(normalisePersonalisation(image, {}, "REQUIRED", "PERSONALISED")).toEqual({ personalisation: { portrait: "TO_BE_CONFIRMED" }, selectedOptions: {}, priceDeltaCents: 700 });
  });
});
