import { describe, expect, it } from "vitest";
import { canTransitionManufacturing, manufacturingTransitions } from "@/lib/manufacturing";

describe("manufacturing lifecycle", () => {
  it("requires programming and verification before a unit is ready", () => {
    expect(canTransitionManufacturing("GENERATED", "PROGRAMMED")).toBe(true);
    expect(canTransitionManufacturing("PROGRAMMED", "VERIFIED")).toBe(true);
    expect(canTransitionManufacturing("VERIFIED", "READY")).toBe(false);
    expect(manufacturingTransitions.ASSEMBLED).toEqual(["READY"]);
  });
  it("does not allow sold units to return to production", () => {
    expect(canTransitionManufacturing("SOLD", "GENERATED")).toBe(false);
  });
});
