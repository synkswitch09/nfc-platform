import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ order: vi.fn(), origin: vi.fn(), unique: vi.fn(), create: vi.fn(), update: vi.fn(), shipment: vi.fn(), lock: vi.fn(), tx: vi.fn(), print: vi.fn(), audit: vi.fn(), remote: vi.fn(), configured: vi.fn(), hold: vi.fn(), orderLock: vi.fn(), put: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/config", () => ({ currentAppEnvironment: () => "staging" }));
vi.mock("@/lib/db", () => ({ db: { order: { findFirst: m.order }, shippingOrigin: { findFirst: m.origin }, shipment: { findUnique: m.unique, findUniqueOrThrow: m.unique, findFirst: m.shipment, create: m.create, update: m.update, updateMany: m.lock }, auditLog: { create: m.audit }, $transaction: m.tx } }));
vi.mock("@/lib/shippit", () => ({ assertShippitConfigured: m.configured, shippitOrderPayload: () => ({}), shippitRequest: m.remote, parseShippitTracking: () => "TRACK-123", parseShippitLabel: () => ({ url: "https://label", carrier: "Carrier" }), downloadShippitLabel: async () => Buffer.from("%PDF-test") }));
vi.mock("@/lib/storage", () => ({ getStorageProvider: () => ({ put: m.put, delete: m.remove }) }));
vi.mock("@/lib/storage/keys", () => ({ createDocumentStorageKey: (_env: string, _store: string, id: string) => `${id}.pdf` }));
import { bookShippitParcel, createShippitParcel, refreshShippitLabel } from "@/lib/shippit-fulfilment";
const parcel = { weightGrams: 100, lengthMm: 200, widthMm: 100, heightMm: 30 };
const order = { id: "o", orderNumber: "K1", shippingCountry: "AU", status: "PAID", shippingOriginSnapshot: { id: "origin" }, payments: [{ status: "SUCCEEDED", refundedAmountCents: 0 }] };
beforeEach(() => {
  vi.resetAllMocks();
  m.remove.mockResolvedValue(undefined);
  m.put.mockResolvedValue(undefined);
  m.order.mockResolvedValue(order);
  m.origin.mockResolvedValue({ id: "origin", country: "AU" });
  m.create.mockResolvedValue({ id: "box" });
  m.update.mockResolvedValue({ id: "box", providerShipmentId: "TRACK-123" });
  m.remote.mockResolvedValue({ response: [{ success: true }] });
  m.lock.mockResolvedValue({ count: 1 });
  m.hold.mockResolvedValue(0);
  m.orderLock.mockResolvedValue({ id: "o" });
  m.tx.mockImplementation(fn => fn({ order: { update: m.orderLock }, orderSupportRequest: { count: m.hold }, shipment: { updateMany: m.lock, findUniqueOrThrow: m.unique, update: m.update }, printJob: { create: m.print }, auditLog: { create: m.audit } }));
});
it("reuses a stable checkout parcel without repeating the external create POST", async () => {
  m.unique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "box", providerShipmentId: "TRACK-123" });
  await createShippitParcel("o", "s", undefined, parcel, "standard", "auto-001");
  await createShippitParcel("o", "s", undefined, parcel, "standard", "auto-001");
  expect(m.remote).toHaveBeenCalledTimes(1);
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.origin.mock.calls[0][0].where).toEqual({ storeId: "s", active: true, id: "origin" });
});
it("checks missing credentials before persisting an ambiguous external intent", async () => {
  m.configured.mockImplementation(() => { throw new Error("Secret missing"); });
  await expect(createShippitParcel("o", "s", undefined, parcel, "standard", "auto-001")).rejects.toThrow("Secret missing");
  expect(m.create).not.toHaveBeenCalled();
  expect(m.remote).not.toHaveBeenCalled();
});
it("never retries an existing creation intent without tracking", async () => {
  m.unique.mockResolvedValue({ id: "box", providerShipmentId: null });
  expect(await createShippitParcel("o", "s", undefined, parcel, "standard", "auto-001")).toMatchObject({ providerShipmentId: null });
  expect(m.remote).not.toHaveBeenCalled();
});
it("queues only one print job when label persistence races", async () => {
  m.shipment.mockResolvedValue({ id: "box", providerShipmentId: "TRACK-123", order: { status: "PAID", sourceDomain: "kosykin.com.au" } });
  m.lock.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  m.unique.mockResolvedValue({ id: "box", labelStorageKey: "saved.pdf" });
  await Promise.all([refreshShippitLabel("box", "s", undefined), refreshShippitLabel("box", "s", undefined)]);
  expect(m.print).toHaveBeenCalledTimes(1);
  expect(m.remove).toHaveBeenCalledTimes(1);
});
it.each(["PAID", "PROCESSING"])("never books a carrier while production is %s", async status => {
  m.shipment.mockResolvedValue({ trackingNumber: "TRACK-123", labelStorageKey: "saved.pdf", order: { ...order, status } });
  await expect(bookShippitParcel("box", "s", "actor")).rejects.toThrow("ready order");
  expect(m.remote).not.toHaveBeenCalled();
});
it("requires every automatic label before booking", async () => {
  m.shipment.mockResolvedValue({ trackingNumber: "TRACK-123", labelStorageKey: "saved.pdf", order: { ...order, status: "READY_TO_SHIP", shippitPreparation: { status: "PENDING" } } });
  await expect(bookShippitParcel("box", "s", "actor")).rejects.toThrow("all checkout labels");
  expect(m.remote).not.toHaveBeenCalled();
});
it("does not repeat an uncertain carrier booking", async () => {
  m.shipment.mockResolvedValue({ id: "box", trackingNumber: "TRACK-123", labelStorageKey: "saved.pdf", order: { ...order, status: "READY_TO_SHIP", shippitPreparation: { status: "COMPLETE" } } });
  m.lock.mockResolvedValue({ count: 0 });
  await expect(bookShippitParcel("box", "s", "actor")).rejects.toThrow("reconciliation");
  expect(m.remote).not.toHaveBeenCalled();
});

it("blocks carrier booking while a verified support hold is active", async () => {
  m.shipment.mockResolvedValue({ id: "box", orderId: "o", trackingNumber: "TRACK", labelStorageKey: "label.pdf", bookedAt: null, order: { status: "READY_TO_SHIP", payments: [{ status: "SUCCEEDED", refundedAmountCents: 0 }] } });
  m.hold.mockResolvedValue(1);
  await expect(bookShippitParcel("box", "s", undefined)).rejects.toThrow("Order paused");
  expect(m.remote).not.toHaveBeenCalled(); expect(m.lock).not.toHaveBeenCalled();
});
