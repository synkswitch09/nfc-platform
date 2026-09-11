import { describe, expect, it } from "vitest";
import { ProductType, StoreCapability } from "@prisma/client";
import { canTransitionManufacturing, manufacturingRequirements, manufacturingTransitions } from "@/lib/manufacturing";

describe("store-aware manufacturing", () => {
  it("preserves the NFC unit lifecycle", () => {
    expect(canTransitionManufacturing("GENERATED", "PROGRAMMED")).toBe(true);
    expect(canTransitionManufacturing("PROGRAMMED", "VERIFIED")).toBe(true);
    expect(canTransitionManufacturing("VERIFIED", "READY")).toBe(false);
    expect(manufacturingTransitions.ASSEMBLED).toEqual(["READY"]);
    expect(canTransitionManufacturing("SOLD", "GENERATED")).toBe(false);
  });

  it("adds NFC work to a Tapkin connected product", () => {
    expect(manufacturingRequirements([StoreCapability.PRINT_3D, StoreCapability.NFC], ProductType.PET)).toEqual({ requiresNfc: true });
  });

  it("creates only generic 3D work for Home Demo", () => {
    expect(manufacturingRequirements([StoreCapability.PRINT_3D, StoreCapability.COMMERCE], ProductType.ACCESSORY)).toEqual({ requiresNfc: false });
  });

  it("does not create a manufacturing job for a Store without 3D printing", () => {
    expect(manufacturingRequirements([StoreCapability.COMMERCE], ProductType.ACCESSORY)).toBeNull();
  });
});
