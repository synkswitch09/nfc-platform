import { describe, expect, it, vi, afterEach } from "vitest";
import { canAccessTrading, tradingConfig } from "@/lib/trading/config";
import { checkConnection, readMarket, validateBars } from "@/lib/trading/connectors";
import { indicators, paperCycle } from "@/lib/trading/engine";
import { defaultSettings, fxRate, initialState, settingsSchema, type Bar, type Market } from "@/lib/trading/schema";
const now = Date.UTC(2026, 10, 8, 12);
function bars(): Bar[] {
  return Array.from({ length: 221 }, (_, n) => ({ time: now - (223 - n) * 86400000, open: 99, high: 101, low: 98, close: 100 })).map((b, n) => n === 220 ? { ...b, open: 101, high: 106, low: 100, close: 105 } : b);
}
function setup() {
  const settings = defaultSettings();
  settings.instruments = [{ ...settings.instruments[0], quoteCurrency: "AUD", symbol: "BTCAUD", enabled: true }];
  const market: Market = { instrumentId: "BTC", time: now, price: 105, bars: bars() };
  return { settings, market };
}
afterEach(() => vi.restoreAllMocks());
describe("private trading access and configuration", () => {
  it("requires the exact verified platform owner, never store staff or another administrator", () => {
    const user = { id: "owner", role: "ADMIN", emailVerifiedAt: new Date() };
    expect(canAccessTrading(user, "owner")).toBe(true);
    expect(canAccessTrading(user, undefined)).toBe(false);
    expect(canAccessTrading({ ...user, id: "other" }, "owner")).toBe(false);
    expect(canAccessTrading({ ...user, role: "STAFF" }, "owner")).toBe(false);
    expect(canAccessTrading({ ...user, emailVerifiedAt: null }, "owner")).toBe(false);
    expect(canAccessTrading(null, "owner")).toBe(false);
  });
  it("defaults to disabled and fixes Binance hosts; rejects insecure remote gateway configuration", () => {
    expect(tradingConfig({}).enabled).toBe(false);
    expect(tradingConfig({ TRADING_BINANCE_TESTNET: "true" }).binanceUrl).toBe("https://testnet.binance.vision");
    expect(() => tradingConfig({ TRADING_IBKR_BASE_URL: "http://public.example/v1/api" })).toThrow();
    expect(() => tradingConfig({ TRADING_IBKR_BASE_URL: "https://user:password@example.com" })).toThrow();
  });
  it("rejects duplicate contracts, excessive risk, enabled IBKR without conid and forex", () => {
    const settings = defaultSettings();
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, riskAud: 20 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, instruments: [settings.instruments[0], settings.instruments[0]] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, instruments: [{ ...settings.instruments[1], enabled: true }] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, instruments: [{ ...settings.instruments[1], enabled: true, kind: "FOREX", conid: "123" }] }).success).toBe(false);
  });
  it("requires explicit fresh FX and never equates USDT with USD", () => {
    const settings = defaultSettings();
    expect(fxRate(settings, "AUD", now)).toBe(1);
    settings.fx.USD = { audPerUnit: 1.5, asOf: new Date(now).toISOString() };
    expect(fxRate(settings, "USD", now)).toBe(1.5);
    expect(() => fxRate(settings, "USDT", now)).toThrow();
    expect(() => fxRate(settings, "USD", now + 86400001)).toThrow();
    expect(() => fxRate(settings, "USD", now - 120000)).toThrow();
  });
});
describe("paper execution and risk", () => {
  it("uses only preceding bars for breakout/exit thresholds", () => {
    const signal = indicators(bars())!;
    expect(signal.breakout).toBe(101); expect(signal.close).toBe(105);
    expect(indicators(bars().slice(0, 50))).toBe(null);
  });
  it("sizes entries within risk including both sides' fees; debits virtual cash only", () => {
    const { settings, market } = setup(), original = initialState(1000);
    const cycle = paperCycle(settings, original, [market], now);
    const buy = cycle.events.find(e => e.kind === "BUY")!;
    expect(buy).toBeDefined(); expect(buy.data!.riskAud).toBeLessThanOrEqual(5);
    expect(buy.data!.costAud).toBeLessThanOrEqual(250);
    expect(cycle.state.cashAud).toBeLessThan(1000); expect(original.cashAud).toBe(1000);
    expect(cycle.state.feesAud).toBeGreaterThan(0);
  });
  it("does not duplicate a signal on repeated cycles", () => {
    const { settings, market } = setup();
    const first = paperCycle(settings, initialState(1000), [market], now);
    const next = paperCycle(settings, first.state, [market], now + 1000);
    expect(next.events.filter(e => e.kind === "BUY")).toHaveLength(0);
    expect(next.state.positions).toHaveLength(1);
  });
  it("simulates gap exits at observed prices, charges exit fees and never re-enters on the same signal", () => {
    const { settings, market } = setup();
    const first = paperCycle(settings, initialState(1000), [market], now);
    const next = paperCycle(settings, first.state, [{ ...market, price: 70 }], now + 1000);
    expect(next.state.positions).toHaveLength(0);
    expect(next.events.find(e => e.kind === "SELL")!.data!.price).toBeLessThan(70);
    expect(next.state.realizedAud).toBeLessThan(-5); // A stop does not guarantee the initial risk budget.
    expect(next.state.feesAud).toBeGreaterThan(first.state.feesAud);
  });
  it("skips stale prices and bars, expired FX, and unaffordable whole shares", () => {
    const { settings, market } = setup();
    expect(paperCycle(settings, initialState(1000), [{ ...market, time: now - 360000 }], now).state.positions).toHaveLength(0);
    expect(paperCycle(settings, initialState(1000), [{ ...market, bars: market.bars.map(b => ({ ...b, time: b.time - 30 * 86400000 })) }], now).state.positions).toHaveLength(0);
    settings.instruments[0].quoteCurrency = "USDT";
    expect(paperCycle(settings, initialState(1000), [market], now).events.some(e => e.kind === "SKIP")).toBe(true);
    settings.instruments[0] = { ...settings.instruments[0], quoteCurrency: "AUD", provider: "IBKR", kind: "ETF", conid: "123", minimumFee: 5 };
    const cycle = paperCycle(settings, initialState(1000), [market], now);
    expect(cycle.state.positions).toHaveLength(0); expect(cycle.events[0].message).toContain("budget");
  });
  it("blocks new entries when an existing position cannot be valued", () => {
    const { settings, market } = setup();
    const first = paperCycle(settings, initialState(1000), [market], now);
    settings.instruments.push({ ...settings.instruments[0], id: "ETH", symbol: "ETHAUD" }); settings.maxPositions = 2;
    const next = paperCycle(settings, first.state, [{ ...market, instrumentId: "ETH" }], now);
    expect(next.valuationFresh).toBe(false); expect(next.state.positions).toHaveLength(1);
    expect(next.state.equityAud).toBe(first.state.equityAud);
  });
  it("pauses entries at drawdown but continues processing an available stop exit", () => {
    const { settings, market } = setup();
    const first = paperCycle(settings, initialState(1000), [market], now);
    const next = paperCycle(settings, { ...first.state, highWaterAud: 1200 }, [{ ...market, price: 70 }], now);
    expect(next.paused).toBe(true); expect(next.state.positions).toHaveLength(0);
    expect(next.events.some(e => e.kind === "PAUSE")).toBe(true);
  });
});
describe("provider reads", () => {
  it("rejects inconsistent OHLC and drops unfinished daily bars", () => {
    expect(validateBars([{ time: now - 1000, open: 1, high: 2, low: 1, close: 2 }], now)).toHaveLength(0);
    expect(() => validateBars([{ time: now - 86400000, open: 1, high: 2, low: 3, close: 2 }], now)).toThrow();
  });
  it("signs only read-only Binance account requests and omits zero balances", async () => {
    const calls: { url: string; method?: string }[] = [];
    const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(JSON.stringify(String(url).includes("/time") ? { serverTime: now } : { canTrade: true, balances: [{ asset: "BTC", free: "0.1", locked: "0" }, { asset: "ETH", free: "0", locked: "0" }] }));
    });
    const config = tradingConfig({ TRADING_BINANCE_API_KEY: "fake-key", TRADING_BINANCE_API_SECRET: "fake-secret" });
    const result = await checkConnection("BINANCE", config, request as typeof fetch);
    expect(result.balances).toHaveLength(1);
    expect(calls.every(c => c.method === "GET")).toBe(true);
    const signed = new URL(calls[1].url); expect(signed.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[1].url).not.toContain("fake-secret");
  });
  it("sanitizes provider errors so credentials cannot escape", async () => {
    const request = vi.fn(async () => { throw new Error("sensitive-url-and-key"); });
    await expect(checkConnection("BINANCE", tradingConfig({ TRADING_BINANCE_API_KEY: "a", TRADING_BINANCE_API_SECRET: "b" }), request as typeof fetch)).rejects.not.toThrow("sensitive");
  });
  it("rejects an IBKR contract with the wrong currency before consuming prices", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ currency: "USD", symbol: "IVV", secType: "STK" })));
    const instrument = { ...defaultSettings().instruments[1], conid: "123", enabled: true };
    await expect(readMarket(instrument, tradingConfig({ TRADING_IBKR_BASE_URL: "https://gateway.example/v1/api" }), request as typeof fetch, now)).rejects.toThrow("match");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects delayed and prefixed IBKR prices", async () => {
    let calls = 0;
    const request = vi.fn(async () => new Response(JSON.stringify(++calls === 1 ? { currency: "AUD", symbol: "IVV", secType: "STK" } : calls === 2 ? { data: [] } : [{ conid: 123, _updated: now, "31": "C100.00", "6509": "D" }])));
    await expect(readMarket({ ...defaultSettings().instruments[1], conid: "123" }, tradingConfig({ TRADING_IBKR_BASE_URL: "https://gateway.example/v1/api" }), request as typeof fetch, now)).rejects.toThrow("real-time");
  });
});
