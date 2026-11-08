import { z } from "zod";
import { tradingConfig } from "../config";
import { datasetSchema, DAY, type Daily, type Dataset, type Series } from "./schema";
const number = z.coerce.number().positive().finite();
async function get(url: string, request: typeof fetch, headers: Record<string, string> = {}) {
  const r = await request(url, { headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`Data source returned HTTP ${r.status}`);
  return r.json() as Promise<unknown>;
}
export function cleanDaily(input: Daily[], now: number) {
  const today = Math.floor(now / DAY);
  const bars = input.filter(b => b.day < today).sort((a, b) => a.day - b.day);
  if (bars.some((b, i) => [b.open, b.high, b.low, b.close].some(v => !Number.isFinite(v) || v <= 0) || b.high < Math.max(b.open, b.close) || b.low > Math.min(b.open, b.close) || b.low > b.high || (i > 0 && b.day <= bars[i - 1].day))) throw new Error("Invalid historical bars");
  return bars;
}
export async function loadFx(pair: string, inverse: boolean, request: typeof fetch, now: number) {
  const raw = z.object({ error: z.array(z.string()), result: z.record(z.string(), z.unknown()) }).parse(await get(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`, request));
  if (raw.error.length) throw new Error("Reference FX pair unavailable");
  const rows = Object.entries(raw.result).find(([key, value]) => key !== "last" && Array.isArray(value))?.[1];
  const parsed = z.array(z.tuple([z.number(), z.unknown(), z.unknown(), z.unknown(), number]).rest(z.unknown())).parse(rows);
  const today = Math.floor(now / DAY);
  const rates = parsed.filter(r => Math.floor(r[0] * 1000 / DAY) < today).map(r => ({ day: Math.floor(r[0] * 1000 / DAY), audPerUnit: inverse ? 1 / r[4] : r[4] }));
  if (rates.length < 200 || today - rates.at(-1)!.day > 3 || rates.some((r, i) => i > 0 && r.day <= rates[i - 1].day)) throw new Error("Reference FX history is stale or incomplete");
  return rates;
}
export async function discoverDataset(request: typeof fetch = fetch, now = Date.now()): Promise<Dataset> {
  const config = tradingConfig(), assets: Series[] = [], issues: string[] = [], fx: Dataset["fx"] = {}, sources = ["Binance Spot daily OHLC", "Kraken public daily FX references (no Kraken account required)"];
  const rates = await Promise.allSettled([loadFx("USDTAUD", false, request, now), loadFx("AUDUSD", true, request, now)]);
  if (rates[0].status === "fulfilled") fx.USDT = rates[0].value; else issues.push("Automatic USDT/AUD reference unavailable; crypto research waits for valid FX.");
  if (rates[1].status === "fulfilled") fx.USD = rates[1].value; else issues.push("Automatic USD/AUD reference unavailable; US equities wait for valid FX.");
  if (fx.USDT) {
    let available = new Set<string>();
    try {
      const raw = z.object({ symbols: z.array(z.object({ symbol: z.string(), status: z.string(), quoteAsset: z.string(), isSpotTradingAllowed: z.boolean() })) }).parse(await get(`${config.binanceUrl}/api/v3/exchangeInfo`, request));
      available = new Set(raw.symbols.filter(s => s.status === "TRADING" && s.quoteAsset === "USDT" && s.isSpotTradingAllowed).map(s => s.symbol));
    } catch { issues.push("Binance market discovery unavailable; no crypto symbols assumed available."); }
    // A declared, liquid candidate pool; not a claim to cover the entire market. Listing/survivorship bias is disclosed.
    for (const symbol of ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"].filter(s => available.has(s))) {
      try {
        const rows = z.array(z.tuple([z.number(), number, number, number, number]).rest(z.unknown())).parse(await get(`${config.binanceUrl}/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000`, request));
        const bars = cleanDaily(rows.map(r => ({ day: Math.floor(r[0] / DAY), open: r[1], high: r[2], low: r[3], close: r[4] })), now);
        if (bars.length < 400 || Math.floor(now / DAY) - bars.at(-1)!.day > 3) throw new Error();
        assets.push({ id: symbol, symbol, provider: "BINANCE", kind: "CRYPTO", currency: "USDT", bars, feeBps: 15, minimumFee: 0, slippageBps: 15 });
      } catch { issues.push(`${symbol}: insufficient or unavailable historical data.`); }
    }
  }
  if (config.ibkrUrl && fx.USD) {
    const headers: Record<string, string> = config.ibkrProxyToken ? { authorization: `Bearer ${config.ibkrProxyToken}` } : {};
    sources.push("IBKR contract discovery and daily OHLC");
    for (const [symbol, kind] of [["VOO", "ETF"], ["QQQ", "ETF"], ["AAPL", "STOCK"], ["MSFT", "STOCK"], ["AMZN", "STOCK"], ["NVDA", "STOCK"]] as const) {
      try {
        const found = z.record(z.string(), z.array(z.object({ contracts: z.array(z.object({ conid: z.number().int().positive(), isUS: z.boolean() })) }))).parse(await get(`${config.ibkrUrl}/trsrv/stocks?symbols=${symbol}`, request, headers));
        const candidates = [...new Set((found[symbol] || []).flatMap(s => s.contracts.filter(c => c.isUS).map(c => c.conid)))];
        if (candidates.length !== 1) throw new Error("Ambiguous contract");
        const conid = String(candidates[0]);
        const info = z.object({ symbol: z.string(), currency: z.string(), secType: z.string() }).parse(await get(`${config.ibkrUrl}/iserver/contract/${conid}/info`, request, headers));
        if (info.symbol !== symbol || info.currency !== "USD" || info.secType !== "STK") throw new Error();
        const history = z.object({ data: z.array(z.object({ t: z.number(), o: number, h: number, l: number, c: number })) }).parse(await get(`${config.ibkrUrl}/iserver/marketdata/history?conid=${conid}&period=3y&bar=1d&outsideRth=false`, request, headers));
        const bars = cleanDaily(history.data.map(b => ({ day: Math.floor(b.t / DAY), open: b.o, high: b.h, low: b.l, close: b.c })), now);
        if (bars.length < 450 || Math.floor(now / DAY) - bars.at(-1)!.day > 7) throw new Error();
        assets.push({ id: symbol, symbol, conid, provider: "IBKR", kind, currency: "USD", bars, feeBps: 1, minimumFee: 1, slippageBps: 15 });
      } catch { issues.push(`${symbol}: IBKR discovery/history unavailable or ambiguous; excluded automatically.`); }
    }
  } else issues.push("IBKR is not connected or USD FX is unavailable. Stocks and ETFs are not evaluated yet.");
  const dataset = datasetSchema.parse({ fetchedAt: now, assets, fx, issues, sources });
  if (!assets.length) throw new Error("No research-ready market data. Check data-provider access; the system will retry automatically.");
  return dataset;
}

/** Retain already observed closed data as provider rolling windows advance. Missing assets stay unavailable. */
export function retainHistory(previous: Dataset | null, next: Dataset): Dataset {
  if (!previous) return next;
  function append<T extends { day: number }>(old: T[], fresh: T[]) {
    const observed = new Map(old.map(row => [row.day, row]));
    for (const row of fresh) if (!observed.has(row.day)) observed.set(row.day, row);
    return [...observed.values()].sort((a, b) => a.day - b.day);
  }
  return { ...next,
    assets: next.assets.map(asset => { const old = previous.assets.find(a => a.id === asset.id && a.currency === asset.currency && a.conid === asset.conid); return { ...asset, bars: append(old?.bars || [], asset.bars) }; }),
    fx: Object.fromEntries(Object.entries(next.fx).map(([currency, rows]) => [currency, append(previous.fx[currency] || [], rows)])),
  };
}
