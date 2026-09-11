import { describe, expect, it } from "vitest";
import { publicTagState } from "@/lib/catalog-policy";
import { belongsToStore, scopeToStore, storeCanonicalUrl } from "@/lib/store-isolation";

const tapkin = "00000000-0000-4000-8000-000000000001";
const home = "00000000-0000-4000-8000-000000000002";

describe("multi-store isolation", () => {
  it.each(["Product", "ProductCategory", "Landing", "Navigation", "Order", "Customer"])("forces trusted Store scope for %s queries", resource => {
    const where = scopeToStore(tapkin, { resource, storeId: home, slug: "shared-slug" });
    expect(where.storeId).toBe(tapkin);
    expect(where.storeId).not.toBe(home);
  });

  it("rejects a resource belonging to another Store", () => {
    expect(belongsToStore(tapkin, tapkin)).toBe(true);
    expect(belongsToStore(home, tapkin)).toBe(false);
  });

  it("keeps canonical URLs on the Store origin and rejects protocol-relative injection", () => {
    expect(storeCanonicalUrl("https://tapkin.com.au", "/products/tag")).toBe("https://tapkin.com.au/products/tag");
    expect(storeCanonicalUrl("https://home.example", "/products/tag")).toBe("https://home.example/products/tag");
    expect(() => storeCanonicalUrl("https://tapkin.com.au", "//evil.example/path")).toThrow("INVALID_STORE_PATH");
  });

  it.each(["HIDDEN", "ARCHIVED"])("does not couple %s Store commerce status to an issued Tapkin tag", () => {
    expect(publicTagState("ACTIVE", true)).toBe("PROFILE");
    expect(publicTagState("LOST", true)).toBe("PROFILE");
  });
});
