import { describe, expect, it } from "vitest";
import { assertStoreResetAllowed, storeResetSchema } from "@/lib/store-reset";

describe("store reset baseline request", () => {
  const request = {
    confirmation: "Tapkin",
    productName: "Tapkin Pet Tag",
    productSlug: "tapkin-pet-tag",
    productSku: "PET-TAG-001",
    productDescription: "A personalised NFC pet tag ready for launch.",
    priceCents: 2495,
  };

  it("accepts an explicit Pets product baseline with a zero price when needed", () => {
    expect(storeResetSchema.parse({ ...request, priceCents: 0 })).toMatchObject({
      productSlug: "tapkin-pet-tag",
      productSku: "PET-TAG-001",
      priceCents: 0,
    });
  });

  it("rejects unsafe product identifiers before a destructive reset", () => {
    expect(storeResetSchema.safeParse({ ...request, productSlug: "/pets" }).success).toBe(false);
    expect(storeResetSchema.safeParse({ ...request, productSku: "x" }).success).toBe(false);
    expect(storeResetSchema.safeParse({ ...request, priceCents: -1 }).success).toBe(false);
  });
});

describe("reset environment boundary", () => {
  it.each([{}, { APP_ENV: "production" }, { APP_ENV: "prod" }, { NODE_ENV: "production" }])("rejects production and ambiguous environments: %j", (environment) => {
    expect(() => assertStoreResetAllowed(environment)).toThrow("STORE_RESET_DISABLED");
  });
  it.each(["development", "staging"])("permits explicitly configured %s with the existing confirmation flow", (APP_ENV) => {
    expect(() => assertStoreResetAllowed({ APP_ENV })).not.toThrow();
  });
});
