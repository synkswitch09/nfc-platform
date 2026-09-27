import { describe, expect, it } from "vitest";
import { createStoreSchema, newStoreData } from "../lib/store-creation";

const input = { name: "Kosykin", slug: "kosykin", hostname: "staging.kosykin.com.au", supportEmail: "contact@example.com", capabilities: ["COMMERCE", "PRINT_3D", "INVENTORY"] };

describe("platform store creation", () => {
  it("starts Kosykin offline with an exact staging domain and no Tapkin data", () => {
    const value = createStoreSchema.parse(input);
    const data = newStoreData(value, "STAGING");
    expect(data.status).toBe("DRAFT");
    expect(data.domains.create).toMatchObject({ hostname: "staging.kosykin.com.au", environment: "STAGING", isPrimary: true });
    expect(data.capabilities).toEqual(["COMMERCE", "PRINT_3D", "INVENTORY"]);
  });

  it.each(["https://staging.kosykin.com.au", "staging.kosykin.com.au/path", "localhost", "staging.kosykin.com.au:443", "tapkin..com.au"])("rejects an unsafe domain %s", (hostname) => {
    expect(createStoreSchema.safeParse({ ...input, hostname }).success).toBe(false);
  });

  it("rejects duplicate capabilities and NFC without digital profiles", () => {
    expect(createStoreSchema.safeParse({ ...input, capabilities: ["COMMERCE", "COMMERCE"] }).success).toBe(false);
    expect(createStoreSchema.safeParse({ ...input, capabilities: ["NFC"] }).success).toBe(false);
  });
});
