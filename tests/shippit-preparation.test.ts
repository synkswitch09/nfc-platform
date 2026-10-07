import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ jobs: vi.fn(), claim: vi.fn(), order: vi.fn(), create: vi.fn(), label: vi.fn() }));
vi.mock("@/lib/config", () => ({ currentAppEnvironment: () => "staging" }));
vi.mock("@/lib/db", () => ({ db: { shippitPreparation: { findMany: m.jobs, updateMany: m.claim }, order: { findUnique: m.order } } }));
vi.mock("@/lib/shippit-fulfilment", () => ({ createShippitParcel: m.create, refreshShippitLabel: m.label }));
import { automaticShippitService, checkoutShippitParcels, processShippitPreparations, queueShippitPreparation } from "@/lib/shippit-preparation";
const dimensions = { weightGrams: 350, lengthMm: 250, widthMm: 150, heightMm: 40 };
const order = { id: "o", storeId: "s", checkoutEnvironment: "STAGING", status: "PAID", shippingProviderKey: "shippit", shippingServiceCode: "express", payments: [{ status: "SUCCEEDED", refundedAmountCents: 0 }], items: [{ shippingSnapshot: { ...dimensions, shippingPackageType: "BOX" } }], packagingSnapshot: { parcels: [{ ...dimensions, quantity: 2 }] }, shipments: [] };
beforeEach(() => {
  vi.resetAllMocks();
  m.jobs.mockResolvedValue([{ orderId: "o", attempts: 0 }]);
  m.claim.mockResolvedValue({ count: 1 });
  m.order.mockResolvedValue(order);
  m.create.mockResolvedValue({ id: "box", providerShipmentId: "TRACK-123" });
  m.label.mockResolvedValue({ labelStorageKey: "private-label.pdf" });
});
describe("checkout to automatic labels", () => {
  it("expands the saved physical boxes without multiplying their per-box weight", () => {
    expect(checkoutShippitParcels(order.packagingSnapshot)).toEqual([dimensions, dimensions]);
    expect(() => checkoutShippitParcels({ parcels: [{ ...dimensions, quantity: 31 }] })).toThrow();
    expect(() => checkoutShippitParcels({ parcels: [{ ...dimensions, weightGrams: 0, quantity: 1 }] })).toThrow();
    expect(() => checkoutShippitParcels(null)).toThrow();
  });
  it("preserves express/standard from checkout, including manual fallback rates", () => {
    expect(automaticShippitService("shippit", "express")).toBe("express");
    expect(automaticShippitService("manual", "STANDARD")).toBe("standard");
    expect(automaticShippitService("manual", "pickup")).toBeNull();
    expect(automaticShippitService("etsy", "standard")).toBeNull();
  });
  it("queues the label workflow transactionally with payment", async () => {
    const upsert = vi.fn();
    await queueShippitPreparation({ shippitPreparation: { upsert } } as never, order);
    expect(upsert).toHaveBeenCalledWith({ where: { orderId: "o" }, create: { orderId: "o" }, update: {} });
  });
  it("uses a stable per-box reference and the checkout measurements before manufacturing", async () => {
    await processShippitPreparations("o");
    expect(m.create).toHaveBeenCalledWith("o", "s", undefined, dimensions, "express", "auto-001");
    expect(m.label).toHaveBeenCalledWith("box", "s", undefined);
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", attempts: 0 }) }));
  });
  it("resumes the remaining box and completes without creating the first box twice", async () => {
    m.order.mockResolvedValue({ ...order, shipments: [{ idempotencyKey: "shippit:o:auto-001", labelStorageKey: "first.pdf" }] });
    await processShippitPreparations("o");
    expect(m.create).toHaveBeenCalledWith("o", "s", undefined, dimensions, "express", "auto-002");
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETE" }) }));
  });
  it("does not run a job claimed by another worker", async () => {
    m.claim.mockResolvedValue({ count: 0 });
    await processShippitPreparations("o");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("retries label allocation automatically without creating a new parcel reference", async () => {
    m.label.mockRejectedValue(new Error("Label allocation pending"));
    await processShippitPreparations("o");
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", lastError: "Label allocation pending" }) }));
  });
  it("flags uncertain creation for reconciliation instead of making a new box", async () => {
    m.create.mockResolvedValue({ id: "box", providerShipmentId: null });
    await processShippitPreparations("o");
    expect(m.label).not.toHaveBeenCalled();
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));
  });
  it.each([{ status: "PAYMENT_PENDING" }, { checkoutEnvironment: "PRODUCTION" }, { payments: [{ status: "REFUNDED", refundedAmountCents: 3500 }] }, { payments: [{ status: "SUCCEEDED", refundedAmountCents: 500 }] }])("stops unpaid, refunded or cross-environment orders: %j", async change => {
    m.order.mockResolvedValue({ ...order, ...change });
    await processShippitPreparations("o");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("never uses checkout fallback measurements for an unmeasured product", async () => {
    m.order.mockResolvedValue({ ...order, items: [{ shippingSnapshot: { ...dimensions, weightGrams: null, shippingPackageType: "BOX" } }] });
    await processShippitPreparations("o");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));
  });
  it("keeps existing manual boxes for review instead of silently duplicating them", async () => {
    m.order.mockResolvedValue({ ...order, shipments: [{ idempotencyKey: "shippit:o:old-manual-reference" }] });
    await processShippitPreparations("o");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));
  });
});
