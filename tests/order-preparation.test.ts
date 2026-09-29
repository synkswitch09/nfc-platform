import { describe, expect, it } from "vitest";
import { preparationIssues } from "@/lib/order-preparation";
import { canTransitionJob } from "@/lib/manufacturing";

const line = (production: unknown, overrides: Record<string, unknown> = {}) => ({ id: "line", productName: "Saved product", quantity: 2, packedQuantity: 2, productType: "PET" as const, shippingSnapshot: { production }, manufacturingJobs: [], tags: [], ...overrides });

describe("order preparation", () => {
  it("allows fully packed standard products without NFC or manufacturing", () => {
    expect(preparationIssues([line({ requiresManufacturing: false, requiresNfc: false })], "shop-a")).toEqual([]);
  });

  it("requires production and distinct verified units for the purchased quantity", () => {
    const item = line({ requiresManufacturing: true, requiresNfc: true }, { manufacturingJobs: [{ status: "READY", quantity: 2, requiresNfc: true }], tags: [{ storeId: "shop-a", manufacturingStatus: "ASSIGNED", status: "UNCLAIMED" }] });
    expect(preparationIssues([item], "shop-a")).toContain("Saved product: verified NFC units are missing");
    expect(preparationIssues([line({ requiresManufacturing: true, requiresNfc: false }, { manufacturingJobs: [{ status: "QA", quantity: 2, requiresNfc: false }] })], "shop-a")).toContain("Saved product: manufacturing is not complete");
  });

  it("blocks incomplete, missing historical snapshots and other-store NFC units", () => {
    expect(preparationIssues([line(null, { packedQuantity: 1 })], "shop-a")).toHaveLength(2);
    expect(preparationIssues([line({ requiresManufacturing: false, requiresNfc: true }, { tags: [{ storeId: "shop-b", manufacturingStatus: "READY", status: "UNCLAIMED" }, { storeId: "shop-b", manufacturingStatus: "READY", status: "UNCLAIMED" }] })], "shop-a")).toContain("Saved product: verified NFC units are missing");
  });

  it("requires ordered work stages before a job can be ready", () => {
    expect(canTransitionJob("QUEUED", "READY")).toBe(false);
    expect(canTransitionJob("QA", "PACKING")).toBe(true);
    expect(canTransitionJob("PACKING", "READY")).toBe(true);
  });
});
