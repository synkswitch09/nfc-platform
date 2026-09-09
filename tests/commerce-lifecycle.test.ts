import { describe, expect, it } from "vitest";
import { canHardDeleteProduct, isCategoryVisible, isProductAvailableForNewSale, publicTagState } from "@/lib/catalog-policy";

describe("independent commerce and NFC lifecycles", () => {
  it.each(["HIDDEN", "ARCHIVED"] as const)("keeps an active tag operational when its category is %s", () => {
    expect(publicTagState("ACTIVE", true)).toBe("PROFILE");
  });
  it.each(["HIDDEN", "ARCHIVED", "OUT_OF_STOCK"] as const)("keeps an active tag operational when its product is %s", () => {
    expect(publicTagState("ACTIVE", true)).toBe("PROFILE");
  });
  it("changes public behaviour only from tag state or owner privacy", () => {
    expect(publicTagState("LOST", true)).toBe("PROFILE");
    expect(publicTagState("DISABLED", true)).toBe("UNAVAILABLE");
    expect(publicTagState("REPLACED", true)).toBe("UNAVAILABLE");
    expect(publicTagState("UNCLAIMED", false)).toBe("ACTIVATION");
  });
  it("keeps category visibility and product sale policy explicit", () => {
    expect(isCategoryVisible("PUBLISHED", true)).toBe(true);
    expect(isCategoryVisible("HIDDEN", true)).toBe(false);
    expect(isProductAvailableForNewSale("ACTIVE", true)).toBe(true);
    expect(isProductAvailableForNewSale("HIDDEN", true)).toBe(false);
  });
  it("allows hard deletion only without historical records", () => {
    expect(canHardDeleteProduct({ orderItems: 0, tags: 0, batches: 0, inventoryMovements: 0 })).toBe(true);
    expect(canHardDeleteProduct({ orderItems: 1, tags: 0, batches: 0, inventoryMovements: 0 })).toBe(false);
    expect(canHardDeleteProduct({ orderItems: 0, tags: 1, batches: 0, inventoryMovements: 0 })).toBe(false);
    expect(canHardDeleteProduct({ orderItems: 0, tags: 0, batches: 1, inventoryMovements: 0 })).toBe(false);
  });
});
