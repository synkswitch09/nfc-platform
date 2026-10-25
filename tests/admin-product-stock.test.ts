import { expect, it } from "vitest";
import { adminProductStock } from "@/lib/admin-product-stock";

it("shows made to order rather than an ignored legacy stock counter", () => {
  expect(adminProductStock([{ trackInventory: false, inventory: 1, reservedInventory: 0 }])).toEqual({ label: "Made to order", low: false });
});
it("counts only physical stock and preserves reservations for mixed products", () => {
  expect(adminProductStock([{ trackInventory: false, inventory: 50, reservedInventory: 0 }, { trackInventory: true, inventory: 8, reservedInventory: 2 }])).toEqual({ label: "6 + made to order", low: false });
});
it("keeps real out-of-stock warnings and never displays negative availability", () => {
  expect(adminProductStock([{ trackInventory: true, inventory: 1, reservedInventory: 2 }])).toEqual({ label: "0", low: true });
  expect(adminProductStock([])).toEqual({ label: "0", low: false });
});
