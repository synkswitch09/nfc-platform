import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => {
  const tx = {
    packaging: { findFirst: vi.fn(), delete: vi.fn() },
    shippingRate: { findFirst: vi.fn(), updateMany: vi.fn() },
    productVariant: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)) };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("@/lib/admin", () => ({ getAdminApiContext: async () => ({ user: { id: "admin" }, store: { id: "store" }, isPlatformAdmin: true }), canManageStore: () => true }));
vi.mock("@/lib/http", () => ({ assertSameOrigin: () => true, jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
import { DELETE } from "@/app/api/admin/shipping/packaging/[packagingId]/route";

const request = () => new NextRequest("https://example.test/api/admin/shipping/packaging/legacy", { method: "DELETE" });
const params = { params: Promise.resolve({ packagingId: "legacy" }) };

describe("removing legacy parcel packaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.tx.packaging.findFirst.mockResolvedValue({ id: "legacy", code: "SMALL-PARCEL", products: [], shippingRates: [{ id: "rate", zoneId: "zone", serviceCode: "STANDARD" }] });
    m.tx.shippingRate.findFirst.mockResolvedValue(null);
  });
  it("keeps the manual delivery rate and clears obsolete variant overrides", async () => {
    const response = await DELETE(request(), params);
    expect(response.status).toBe(200);
    expect(m.tx.shippingRate.updateMany).toHaveBeenCalledWith({ where: { storeId: "store", packagingId: "legacy" }, data: { packagingId: null } });
    expect(m.tx.productVariant.updateMany).toHaveBeenCalledWith({ where: { product: { storeId: "store" }, defaultPackagingId: "legacy" }, data: { defaultPackagingId: null } });
    expect(m.tx.packaging.delete).toHaveBeenCalledWith({ where: { id: "legacy" } });
  });
  it("does not remove a package assigned to a product", async () => {
    m.tx.packaging.findFirst.mockResolvedValue({ id: "legacy", code: "SMALL-PARCEL", products: [{ name: "Pet tag" }], shippingRates: [] });
    const response = await DELETE(request(), params);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Pet tag");
    expect(m.tx.packaging.delete).not.toHaveBeenCalled();
  });
});
