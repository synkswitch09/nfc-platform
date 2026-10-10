import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, Order } from "@prisma/client";
import { loyaltyConfigSchema, loyaltyExpiry, maximumRedeemPoints, parseLoyaltyConfig, proportionalPoints, redemptionCents } from "@/lib/loyalty-config";
import { parseAccountConfig } from "@/lib/account-config";
const m = vi.hoisted(() => ({ transaction: vi.fn(), notice: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("@/lib/order-notifications", () => ({ queueOrderNotice: m.notice }));
import { adjustLoyalty, loyaltyAccount, refundLoyalty, releaseLoyalty, reserveLoyalty, settleLoyalty } from "@/lib/loyalty";
const config = loyaltyConfigSchema.parse({});
describe("points economics", () => {
  it("keeps the agreed independent defaults", () => { expect(config).toMatchObject({ pointsPerDollar: 1, redemptionUnitPoints: 100, redemptionUnitCents: 200, minimumRedeemPoints: 100, maximumRedeemPercent: 10, expiryMonths: 12, allowCouponStacking: false }); });
  it("fails closed for a malformed CMS configuration", () => { expect(parseLoyaltyConfig({ loyalty: { pointsPerDollar: -1 } }).enabled).toBe(false); });
  it("preserves fail-closed rules through storefront account parsing", () => { const account = parseAccountConfig({ googleEnabled: false, loyalty: { pointsPerDollar: -1 } }); expect(parseLoyaltyConfig(account).enabled).toBe(false); expect(account.googleEnabled).toBe(false); });
  it("requires the minimum to follow the redemption unit", () => { expect(loyaltyConfigSchema.safeParse({ minimumRedeemPoints: 150 }).success).toBe(false); });
  it.each([[99, 20000, 0], [100, 1999, 0], [100, 2000, 100], [999, 9999, 400], [999, 20000, 900]])("caps balance %i on subtotal %i at %i points", (balance, subtotal, result) => { expect(maximumRedeemPoints(config, balance, subtotal)).toBe(result); });
  it("uses integral units with no fractional-cent promises", () => { expect(redemptionCents(config, 300)).toBe(600); for (const points of [0, 50, 150, 100.5]) expect(() => redemptionCents(config, points)).toThrow(); });
  it("handles leap years and month-end expiry without overflow", () => { expect(loyaltyExpiry(new Date("2024-02-29T12:34:00Z"), 12).toISOString()).toBe("2025-02-28T12:34:00.000Z"); expect(loyaltyExpiry(new Date("2026-01-31T12:34:00Z"), 1).toISOString()).toBe("2026-02-28T12:34:00.000Z"); });
  it("calculates cumulative partial returns and caps a full refund", () => { expect(proportionalPoints(101, 500, 1000)).toBe(50); expect(proportionalPoints(101, 1000, 1000)).toBe(101); expect(proportionalPoints(101, 2000, 1000)).toBe(101); });
});

type Row = Record<string, any>; // Stateful fake, exercising service arithmetic rather than mocking its outcomes.
let tx: Prisma.TransactionClient; let state: Record<string, Row[]>; let counter: number;
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "storeId_emailHash" || key === "walletId_eventKey") return matches(row, value);
    if (value && typeof value === "object" && !(value instanceof Date)) return Object.entries(value).every(([op, expected]) => op === "gt" ? row[key] > expected! : op === "gte" ? row[key] >= expected! : op === "lte" ? row[key] <= expected! : op === "in" ? (expected as unknown[]).includes(row[key]) : false);
    return row[key] === value;
  });
}
function read(model: string, row: Row | undefined) {
  if (!row) return null;
  const result = { ...row };
  if (model === "loyaltyReservation") result.allocations = state.loyaltyAllocation.filter(a => a.reservationId === row.id).map(a => ({ ...a, lot: { ...state.loyaltyLot.find(l => l.id === a.lotId) } }));
  return result;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z")); counter = 0;
  state = { loyaltyWallet: [], loyaltyLot: [], loyaltyReservation: [], loyaltyAllocation: [], loyaltyEntry: [] };
  const models: Row = {};
  for (const [model, rows] of Object.entries(state)) {
    const defaults = () => ({ id: `${model}-${++counter}`, createdAt: new Date(), updatedAt: new Date(), ...(model === "loyaltyWallet" ? { debtPoints: 0, userId: null } : {}), ...(model === "loyaltyLot" ? { revokedPoints: 0, expiredPoints: 0, orderId: null } : {}), ...(["loyaltyReservation", "loyaltyAllocation"].includes(model) ? { restoredPoints: 0 } : {}), ...(model === "loyaltyReservation" ? { status: "HELD" } : {}) });
    const create = vi.fn(async ({ data }: Row) => { const row = { ...defaults(), ...data }; rows.push(row); return read(model, row); });
    const update = vi.fn(async ({ where, data }: Row) => { const row = rows.find(r => matches(r, where)); if (!row) throw new Error("Row missing"); for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === "object" && !(v instanceof Date) ? row[k] + ((v as Row).increment ?? -(v as Row).decrement) : v; return read(model, row); });
    models[model] = {
      create, update,
      findUnique: vi.fn(async ({ where }: Row) => read(model, rows.find(r => matches(r, where)))),
      findUniqueOrThrow: vi.fn(async ({ where }: Row) => { const result = read(model, rows.find(r => matches(r, where))); if (!result) throw new Error("Missing row"); return result; }),
      findFirst: vi.fn(async ({ where }: Row) => read(model, rows.find(r => matches(r, where)))),
      findMany: vi.fn(async ({ where = {} }: Row) => rows.filter(r => matches(r, where)).sort((a, b) => model === "loyaltyLot" ? a.expiresAt - b.expiresAt : 0).map(r => read(model, r))),
      updateMany: vi.fn(async ({ where, data }: Row) => { const found = rows.filter(r => matches(r, where)); for (const r of found) await update({ where: { id: r.id }, data }); return { count: found.length }; }),
      upsert: vi.fn(async ({ where, create: data, update: dataUpdate }: Row) => rows.some(r => matches(r, where)) ? update({ where, data: dataUpdate }) : create({ data })),
      aggregate: vi.fn(async ({ where }: Row) => ({ _sum: { points: rows.filter(r => matches(r, where)).reduce((n, r) => n + r.points, 0) } })),
    };
  }
  models.user = { findUnique: vi.fn(async () => ({ id: "u", email: "Buyer@example.test", emailVerifiedAt: new Date(), status: "ACTIVE" })) };
  models.auditLog = { create: vi.fn() };
  tx = models as Prisma.TransactionClient;
  m.transaction.mockImplementation(callback => callback(tx));
});
afterEach(() => vi.useRealTimers());
const order = (data: Row = {}) => ({ id: "o", storeId: "s", userId: null, guestEmail: "buyer@example.test", currency: "AUD", storeDisplayName: "Kosykin", totalCents: 10000, loyaltySnapshot: config, loyaltyEligibleCents: 10000, loyaltyPointsUsed: 0, loyaltyDiscountCents: 0, ...data }) as unknown as Order;
const buyer = () => ({ id: "u", email: "BUYER@example.test", emailVerifiedAt: new Date() });
async function earned(data: Row = {}) { await settleLoyalty(tx, order(data)); return state.loyaltyWallet[0]; }
describe("durable points lifecycle", () => {
  it("credits only products after discounts and sends one editable-template notice", async () => { await earned({ loyaltyEligibleCents: 2095 }); await earned({ loyaltyEligibleCents: 2095 }); expect(state.loyaltyLot).toHaveLength(1); expect(state.loyaltyLot[0]).toMatchObject({ originalPoints: 20, remainingPoints: 20 }); expect(m.notice).toHaveBeenCalledOnce(); });
  it("never backfills a legacy order without a checkout snapshot", async () => { await settleLoyalty(tx, order({ loyaltySnapshot: null })); expect(state.loyaltyWallet).toHaveLength(0); });
  it("links guest points by verified email and separates brands", async () => { await earned(); const account = await loyaltyAccount(buyer(), "s"); expect(account.balance).toBe(100); expect(state.loyaltyWallet[0].userId).toBe("u"); expect((await loyaltyAccount(buyer(), "other-store")).balance).toBe(0); expect(state.loyaltyWallet).toHaveLength(2); });
  it("does not expose a guest balance to an unverified account", async () => { await earned(); await expect(loyaltyAccount({ ...buyer(), emailVerifiedAt: null }, "s")).rejects.toThrow("Verify"); expect(state.loyaltyWallet[0].userId).toBeNull(); });
  it("does not transfer a previously linked wallet to another user", async () => { await earned(); state.loyaltyWallet[0].userId = "someone-else"; await expect(loyaltyAccount(buyer(), "s")).rejects.toThrow("ownership"); });
  it("reserves earliest-expiring points and releases only once", async () => { await earned({ loyaltyEligibleCents: 30000 }); const redemption = order({ id: "redeem", userId: "u", loyaltyPointsUsed: 100, loyaltyDiscountCents: 200, loyaltyEligibleCents: 9800 }); await reserveLoyalty(tx, redemption, "u", config); expect(state.loyaltyLot[0].remainingPoints).toBe(200); expect(state.loyaltyReservation[0].status).toBe("HELD"); await releaseLoyalty(tx, redemption); await releaseLoyalty(tx, redemption); expect(state.loyaltyLot[0].remainingPoints).toBe(300); expect(state.loyaltyEntry.filter(e => e.kind === "RELEASED")).toHaveLength(1); });
  it("rejects an unverified redemption before deducting any balance", async () => { await earned({ loyaltyEligibleCents: 30000 }); vi.mocked(tx.user.findUnique).mockResolvedValueOnce({ emailVerifiedAt: null } as any); await expect(reserveLoyalty(tx, order({ loyaltyPointsUsed: 100 }), "u", config)).rejects.toThrow("verified"); expect(state.loyaltyLot[0].remainingPoints).toBe(300); });
  it("cannot reserve more than the spendable balance", async () => { await earned({ loyaltyEligibleCents: 9900 }); await expect(reserveLoyalty(tx, order({ loyaltyPointsUsed: 100, loyaltyDiscountCents: 200 }), "u", config)).rejects.toThrow("limit changed"); expect(state.loyaltyReservation).toHaveLength(0); });
  it("returns no expired spendable points on checkout cancellation", async () => { await earned(); const redemption = order({ id: "redeem", userId: "u", loyaltyPointsUsed: 100, loyaltyDiscountCents: 200, loyaltyEligibleCents: 9800 }); await reserveLoyalty(tx, redemption, "u", config); vi.setSystemTime(new Date("2028-01-01")); await releaseLoyalty(tx, redemption); expect((await loyaltyAccount(buyer(), "s")).balance).toBe(0); expect(state.loyaltyLot[0].expiredPoints).toBe(100); });
  it("cumulative partial refunds reverse only the incremental entitlement", async () => { await earned(); await refundLoyalty(tx, order(), 5000, "r1"); await refundLoyalty(tx, order(), 5000, "r1"); expect(state.loyaltyLot[0]).toMatchObject({ remainingPoints: 50, revokedPoints: 50 }); await refundLoyalty(tx, order(), 10000, "r2"); expect(state.loyaltyLot[0]).toMatchObject({ remainingPoints: 0, revokedPoints: 100 }); });
  it("expired unused points do not become a refund debt", async () => { await earned(); vi.setSystemTime(new Date("2028-01-01")); await refundLoyalty(tx, order(), 10000, "r"); expect(state.loyaltyWallet[0].debtPoints).toBe(0); expect(state.loyaltyLot[0].revokedPoints).toBe(100); });
  it("a spent refunded award offsets other credits before future ones", async () => { await earned(); state.loyaltyLot[0].remainingPoints = 0; await earned({ id: "other", loyaltyEligibleCents: 3000 }); await refundLoyalty(tx, order(), 10000, "r"); expect(state.loyaltyWallet[0].debtPoints).toBe(70); expect(state.loyaltyLot[1].remainingPoints).toBe(0); await earned({ id: "future", loyaltyEligibleCents: 9000 }); expect(state.loyaltyWallet[0].debtPoints).toBe(0); expect(state.loyaltyLot[2].remainingPoints).toBe(20); });
  it("full refunds restore spent redemption once and reverse its earned credit", async () => { await earned({ loyaltyEligibleCents: 30000 }); const redeemed = order({ id: "redeem", userId: "u", loyaltyPointsUsed: 100, loyaltyDiscountCents: 200, loyaltyEligibleCents: 9800, totalCents: 9800 }); await reserveLoyalty(tx, redeemed, "u", config); await settleLoyalty(tx, redeemed); expect((await loyaltyAccount(buyer(), "s")).balance).toBe(298); await refundLoyalty(tx, redeemed, 9800, "r"); await refundLoyalty(tx, redeemed, 9800, "r"); expect((await loyaltyAccount(buyer(), "s")).balance).toBe(300); expect(state.loyaltyReservation[0].restoredPoints).toBe(100); });
  it("can return a revoked held award after other credits paid its adjustment", async () => {
    await earned(); const redemption = order({ id: "redeem", userId: "u", loyaltyPointsUsed: 100, loyaltyDiscountCents: 200, loyaltyEligibleCents: 9800 });
    await reserveLoyalty(tx, redemption, "u", config); await refundLoyalty(tx, order(), 10000, "refund-original");
    await earned({ id: "future", loyaltyEligibleCents: 10000 });
    expect(state.loyaltyWallet[0].debtPoints).toBe(0); await releaseLoyalty(tx, redemption);
    expect((await loyaltyAccount(buyer(), "s")).balance).toBe(100);
    for (const lot of state.loyaltyLot) expect(lot.remainingPoints + lot.revokedPoints + lot.expiredPoints).toBeLessThanOrEqual(lot.originalPoints);
    expect(state.loyaltyLot.at(-1)!.expiresAt).toEqual(state.loyaltyLot[0].expiresAt);
  });
  it("never overfills an expired revoked lot when a held reservation returns", async () => {
    await earned(); const redemption = order({ id: "redeem", userId: "u", loyaltyPointsUsed: 100, loyaltyDiscountCents: 200, loyaltyEligibleCents: 9800 });
    await reserveLoyalty(tx, redemption, "u", config); await refundLoyalty(tx, order(), 10000, "refund-original"); await earned({ id: "future", loyaltyEligibleCents: 10000 });
    vi.setSystemTime(new Date("2028-01-01")); await releaseLoyalty(tx, redemption);
    expect((await loyaltyAccount(buyer(), "s")).balance).toBe(0);
    expect(state.loyaltyLot[0].remainingPoints + state.loyaltyLot[0].revokedPoints + state.loyaltyLot[0].expiredPoints).toBeLessThanOrEqual(100);
  });
  it("manual adjustments require this store and never spend reserved credits", async () => { const wallet = await earned(); const input = { walletId: wallet.id, storeId: "s", actorId: "a", config, points: 20, reason: "Customer service adjustment", key: "key" }; await expect(adjustLoyalty({ ...input, storeId: "wrong" })).rejects.toThrow("this store"); await adjustLoyalty(input); await adjustLoyalty(input); expect((await loyaltyAccount(buyer(), "s")).balance).toBe(120); expect(tx.auditLog.create).toHaveBeenCalledOnce(); await expect(adjustLoyalty({ ...input, key: "negative", points: -121 })).rejects.toThrow("exceeds available"); });
});
