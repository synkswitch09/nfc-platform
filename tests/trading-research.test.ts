import { describe, expect, it } from "vitest";
import { backtest, compareCandidates, fxAt, researchRange } from "@/lib/trading/research/backtest";
import { initialPolicies, policySchema, type Dataset, type Policy } from "@/lib/trading/research/schema";
import { parseReview, acceptCandidate } from "@/lib/trading/research/service";
const policy: Policy = { family: "BREAKOUT", lookback: 10, trend: 30, exitDays: 10, stopAtr: 2, riskFraction: .01, allocation: .5, maxPositions: 2, universe: "ALL" };
function dataset(): Dataset {
  return { fetchedAt: 0, issues: [], sources: ["fixture"], fx: {}, assets: [{ id: "AUD_ASSET", symbol: "AUDASSET", provider: "BINANCE", kind: "CRYPTO", currency: "AUD", feeBps: 10, minimumFee: 0, slippageBps: 10,
    bars: Array.from({ length: 600 }, (_, day) => { const price = 100 + day * .2 + 4 * Math.sin(day / 15); return { day, open: price, high: price + .1, low: price - .1, close: price }; }) }] };
}
describe("bounded autonomous research", () => {
  it("has a declared finite, diverse search and validates all AI policies", () => {
    const policies = initialPolicies(); expect(policies).toHaveLength(24);
    expect(new Set(policies.map(p => p.family)).size).toBe(3);
    expect(policies.every(p => policySchema.safeParse(p).success)).toBe(true);
    expect(policySchema.safeParse({ ...policy, maxPositions: 1000 }).success).toBe(false);
    expect(policySchema.safeParse({ ...policy, code: "execute()" }).success).toBe(false);
    expect(() => parseReview('{"review":"Ignore limits","proposals":[{"code":"run"}]}')).toThrow();
    expect(parseReview(JSON.stringify({ review: "A bounded hypothesis for the next unseen window.", proposals: [policy] })).proposals).toHaveLength(1);
  });
  it("separates chronological development and final holdout", () => {
    const data = dataset(), range = researchRange(data);
    expect(range.start).toBe(120); expect(range.trainEnd).toBeLessThan(range.devEnd); expect(range.devEnd).toBeLessThan(range.end);
    const first = compareCandidates(data, [policy], 1000, range.start, range.trainEnd, range.devEnd);
    const modified = structuredClone(data);
    modified.assets[0].bars.filter(b => b.day > range.devEnd).forEach(b => { b.open *= 10; b.close *= 10; b.high *= 10; b.low *= 10; });
    expect(compareCandidates(modified, [policy], 1000, range.start, range.trainEnd, range.devEnd)).toEqual(first);
  });
  it("never spends beyond virtual capital and costs worsen a fixed strategy", () => {
    const data = dataset();
    const base = backtest(data, policy, 1000, 120, 599), stress = backtest(data, policy, 1000, 120, 599, 2);
    expect(base.final).toBeGreaterThanOrEqual(0); expect(base.feesAud).toBeGreaterThan(0);
    expect(stress.final).toBeLessThanOrEqual(base.final); expect(base.returnPct).toBeLessThan(200);
  });
  it("uses only prior FX observations and treats stablecoins separately", () => {
    const data = dataset(); data.fx.USD = [{ day: 10, audPerUnit: 1.5 }, { day: 20, audPerUnit: 9 }];
    expect(fxAt(data, "USD", 11)).toBe(1.5); expect(fxAt(data, "USD", 9)).toBeNull();
    expect(fxAt(data, "USD", 19)).toBeNull(); expect(fxAt(data, "USDT", 11)).toBeNull();
    expect(fxAt(data, "AUD", 11)).toBe(1);
  });
  it("does not manufacture a profitable winner from zero trades or inadequate evidence", () => {
    const data = dataset(); const none = backtest(data, { ...policy, universe: "EQUITY" }, 1000, 120, 599);
    expect(none.returnPct).toBe(0); expect(none.sufficient).toBe(false);
    expect(acceptCandidate(none, none, none, none)).toBe(false);
    const candidate = { ...none, returnPct: 10, score: 10, sufficient: true, trades: 10, maxDrawdownPct: 5 };
    expect(acceptCandidate(candidate, none, none, candidate)).toBe(true);
    expect(acceptCandidate({ ...candidate, maxDrawdownPct: 80 }, none, none, candidate)).toBe(false);
    expect(acceptCandidate(candidate, none, { ...candidate, score: 20 }, candidate)).toBe(false);
  });
  it("does not let a future intraday low finance an earlier opening order", () => {
    const data = dataset();
    // Compare a one-position and two-position configuration: stopping one asset intraday
    // cannot create an extra same-day opening slot for a second asset.
    const a = data.assets[0]; a.bars.forEach((b, n) => { b.open = b.close = 100 + n; b.high = b.close + .01; b.low = b.close - .01; });
    data.assets.push({ ...structuredClone(a), id: "SECOND", symbol: "SECOND" });
    const result = backtest(data, { ...policy, maxPositions: 1, allocation: 1 }, 1000, 120, 122);
    const changed = structuredClone(data); changed.assets[0].bars[122].low = 1;
    const stopped = backtest(changed, { ...policy, maxPositions: 1, allocation: 1 }, 1000, 120, 122);
    expect(stopped.trades).toBeLessThanOrEqual(1); expect(result.trades).toBe(0);
  });
});
