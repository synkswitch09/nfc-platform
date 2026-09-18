import { describe, expect, it } from "vitest";
import { parsePetProfileConfig } from "@/lib/pet-profile-cms";

describe("pet profile CMS", () => {
  it("provides a complete mobile profile template by default", () => {
    const config = parsePetProfileConfig({});
    expect(config.brandLabel).toBe("Tapkin Pet ID"); expect(config.nameSizePx).toBe(48); expect(config.heroStartColour).toBe("#112520");
  });
  it("accepts safe custom labels and exact hex colours", () => {
    const config = parsePetProfileConfig({ brandLabel: "Milo ID", heroStartColour: "#123456", nameSizePx: 42 });
    expect(config).toMatchObject({ brandLabel: "Milo ID", heroStartColour: "#123456", nameSizePx: 42 });
  });
  it("rejects unsafe colour values", () => expect(() => parsePetProfileConfig({ accentColour: "url(javascript:alert(1))" })).toThrow());
});
