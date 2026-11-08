import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanDaily, discoverDataset, loadFx, retainHistory } from "@/lib/trading/research/data";
import { DAY, type Dataset } from "@/lib/trading/research/schema";
const now = Date.UTC(2026, 10, 8, 12), today = Math.floor(now / DAY);
function krakenRows() { return Array.from({ length: 721 }, (_, n) => [(today - 720 + n) * 86400, "1", "2", "1", "1.5", "1.5", "100", 10]); }
beforeEach(() => { vi.unstubAllEnvs(); vi.stubEnv("TRADING_IBKR_BASE_URL", ""); vi.stubEnv("TRADING_BINANCE_TESTNET", "false"); });
describe("automatic research data and currency discovery", () => {
  it("uses real historical quote conversions, excludes unfinished FX bars and inverts AUD/USD", async () => {
    const request = vi.fn(async () => Response.json({ error: [], result: { PAIR: krakenRows(), last: 0 } }));
    const direct = await loadFx("USDTAUD", false, request as typeof fetch, now), inverse = await loadFx("AUDUSD", true, request as typeof fetch, now);
    expect(direct).toHaveLength(720); expect(direct.at(-1)!.day).toBe(today - 1);
    expect(direct[0].audPerUnit).toBe(1.5); expect(inverse[0].audPerUnit).toBeCloseTo(1 / 1.5);
  });
  it("automatically picks supported liquid pairs without user symbols, FX fields or conids", async () => {
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.kraken.com") return Response.json({ error: [], result: { PAIR: krakenRows() } });
      if (url.pathname.endsWith("exchangeInfo")) return Response.json({ symbols: [{ symbol: "BTCUSDT", quoteAsset: "USDT", status: "TRADING", isSpotTradingAllowed: true }, { symbol: "ETHUSDT", quoteAsset: "USDT", status: "BREAK", isSpotTradingAllowed: true }] });
      return Response.json(Array.from({ length: 1000 }, (_, n) => [(today - 1000 + n) * DAY, "100", "101", "99", "100", "1"]));
    });
    const data = await discoverDataset(request as typeof fetch, now);
    expect(data.assets.map(a => a.id)).toEqual(["BTCUSDT"]);
    expect(data.fx.USD).toBeDefined(); expect(data.fx.USDT).toBeDefined();
    expect(data.issues.some(i => i.includes("IBKR is not connected"))).toBe(true);
  });
  it("does not fabricate data when the exchange or FX source refuses access", async () => {
    const request = vi.fn(async () => new Response("denied", { status: 451 }));
    await expect(discoverDataset(request as typeof fetch, now)).rejects.toThrow("No research-ready market data");
  });
  it("retains observed history as provider windows advance without reviving missing assets", () => {
    const old: Dataset = { fetchedAt: 1, assets: [], fx: { USD: [{ day: 1, audPerUnit: 1.5 }, { day: 2, audPerUnit: 1.6 }] }, issues: [], sources: [] };
    const next: Dataset = { ...old, fetchedAt: 2, fx: { USD: [{ day: 2, audPerUnit: 99 }, { day: 3, audPerUnit: 1.7 }] } };
    expect(retainHistory(old, next).fx.USD).toEqual([{ day: 1, audPerUnit: 1.5 }, { day: 2, audPerUnit: 1.6 }, { day: 3, audPerUnit: 1.7 }]);
    expect(retainHistory(old, next).fetchedAt).toBe(2);
  });
  it("rejects malformed OHLC rather than accepting an impossible profitable history", () => {
    expect(() => cleanDaily([{ day: today - 1, open: 100, high: 90, low: 80, close: 100 }], now)).toThrow();
    expect(cleanDaily([{ day: today, open: 1, high: 1, low: 1, close: 1 }], now)).toHaveLength(0);
  });
});
