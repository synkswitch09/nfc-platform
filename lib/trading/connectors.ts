import { createHmac } from "node:crypto";
import { z } from "zod";
import { tradingConfig } from "./config";
import type { Bar, Instrument, Market } from "./schema";

type Config = ReturnType<typeof tradingConfig>;
export class MarketError extends Error {}
async function readJson(url: string, headers: Record<string, string> = {}, request: typeof fetch = fetch, method: "GET" | "POST" = "GET"): Promise<unknown> {
  try {
    const response = await request(url, { method, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new MarketError(`Provider request failed (HTTP ${response.status}); check permissions, session and market-data subscriptions.`);
    return await response.json();
  } catch (error) {
    if (error instanceof MarketError) throw error;
    throw new MarketError("Provider unavailable. Check network, credentials and gateway authentication.");
  }
}
const positive = z.coerce.number().positive().finite();
const barSchema = z.object({ time: positive, open: positive, high: positive, low: positive, close: positive });
export function validateBars(bars: Bar[], now: number): Bar[] {
  const parsed = z.array(barSchema).parse(bars);
  if (parsed.some((b, i) => b.low > Math.min(b.open, b.close) || b.high < Math.max(b.open, b.close) || b.low > b.high || (i > 0 && b.time <= parsed[i - 1].time)))
    throw new MarketError("Provider returned inconsistent historical bars.");
  return parsed.filter(b => b.time + 86400000 <= now); // Closed daily bars only; never use an unfinished signal.
}
async function binance(path: string, params: Record<string, string>, c: Config, request: typeof fetch, signed = false) {
  const query = new URLSearchParams(params);
  const headers: Record<string, string> = {};
  if (signed) {
    if (!c.binanceKey || !c.binanceSecret) throw new MarketError("Configure the Binance read-only API credentials.");
    const clock = z.object({ serverTime: positive }).parse(await readJson(`${c.binanceUrl}/api/v3/time`, {}, request));
    query.set("timestamp", String(clock.serverTime)); query.set("recvWindow", "5000");
    query.set("signature", createHmac("sha256", c.binanceSecret).update(query.toString()).digest("hex"));
    headers["X-MBX-APIKEY"] = c.binanceKey;
  }
  return readJson(`${c.binanceUrl}${path}?${query}`, headers, request);
}
async function ibkr(path: string, c: Config, request: typeof fetch) {
  if (!c.ibkrUrl) throw new MarketError("Configure the private IBKR Web API gateway.");
  return readJson(`${c.ibkrUrl}${path}`, c.ibkrProxyToken ? { authorization: `Bearer ${c.ibkrProxyToken}` } : {}, request, path === "/iserver/auth/status" ? "POST" : "GET");
}
export async function checkConnection(provider: "BINANCE" | "IBKR", c = tradingConfig(), request: typeof fetch = fetch) {
  if (provider === "BINANCE") {
    const account = z.object({ canTrade: z.boolean(), balances: z.array(z.object({ asset: z.string(), free: z.string(), locked: z.string() })) }).parse(await binance("/api/v3/account", {}, c, request, true));
    return { provider, environment: c.binanceTestnet ? "TESTNET" : "LIVE ACCOUNT · READ ONLY", balances: account.balances.filter(b => Number(b.free) > 0 || Number(b.locked) > 0).slice(0, 100) };
  }
  const auth = z.object({ authenticated: z.boolean(), connected: z.boolean().optional(), competing: z.boolean().optional() }).parse(await ibkr("/iserver/auth/status", c, request));
  if (!auth.authenticated || auth.competing || auth.connected === false) throw new MarketError("Sign in to the IBKR gateway and resolve any competing session.");
  const accounts = z.array(z.object({ accountId: z.string() }).passthrough()).parse(await ibkr("/portfolio/accounts", c, request));
  if (!c.ibkrAccount || !accounts.some(a => a.accountId === c.ibkrAccount)) throw new MarketError("Configured IBKR account is not available in this gateway session.");
  const ledger = await ibkr(`/portfolio/${encodeURIComponent(c.ibkrAccount)}/ledger`, c, request);
  const balances = z.record(z.string(), z.object({ cashbalance: z.number().optional(), settledcash: z.number().optional() }).passthrough()).parse(ledger);
  return { provider, environment: "ACCOUNT QUERY ONLY", balances: Object.entries(balances).map(([asset, b]) => ({ asset, free: String(b.settledcash ?? b.cashbalance ?? 0), locked: "0" })) };
}
export async function readMarket(instrument: Instrument, c = tradingConfig(), request: typeof fetch = fetch, now = Date.now()): Promise<Market> {
  if (instrument.provider === "BINANCE") {
    const info = z.object({ symbols: z.array(z.object({ symbol: z.string(), quoteAsset: z.string(), status: z.string(), isSpotTradingAllowed: z.boolean() })) }).parse(await binance("/api/v3/exchangeInfo", { symbol: instrument.symbol }, c, request));
    const pair = info.symbols.find(s => s.symbol === instrument.symbol);
    if (!pair || pair.quoteAsset !== instrument.quoteCurrency || pair.status !== "TRADING" || !pair.isSpotTradingAllowed)
      throw new MarketError("Binance symbol, quote currency or Spot availability does not match the configuration.");
    const [raw, ticker] = await Promise.all([
      binance("/api/v3/klines", { symbol: instrument.symbol, interval: "1d", limit: "230" }, c, request),
      binance("/api/v3/ticker/24hr", { symbol: instrument.symbol }, c, request),
    ]);
    const rows = z.array(z.tuple([z.number(), z.string(), z.string(), z.string(), z.string()]).rest(z.unknown())).parse(raw);
    const price = z.object({ lastPrice: positive, closeTime: positive }).parse(ticker);
    return { instrumentId: instrument.id, price: price.lastPrice, time: price.closeTime,
      bars: validateBars(rows.map(r => ({ time: r[0], open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]) })), now) };
  }
  if (!instrument.conid) throw new MarketError("Set the exact IBKR contract ID first.");
  const contract = z.object({ currency: z.string(), symbol: z.string(), secType: z.string() }).parse(await ibkr(`/iserver/contract/${instrument.conid}/info`, c, request));
  if (contract.currency !== instrument.quoteCurrency || contract.symbol !== instrument.symbol || contract.secType !== "STK")
    throw new MarketError("IBKR contract must match the configured stock/ETF symbol and currency. Derivatives and forex are disabled.");
  const raw = await ibkr(`/iserver/marketdata/history?conid=${instrument.conid}&period=2y&bar=1d&outsideRth=false`, c, request);
  const history = z.object({ data: z.array(z.object({ t: z.number(), o: positive, h: positive, l: positive, c: positive })) }).parse(raw);
  // The first snapshot call initializes the subscription; the next cycle can consume it if it is not ready yet.
  const snapshots = z.array(z.object({ conid: z.number(), _updated: z.number().optional(), "31": z.union([z.string(), z.number()]).optional(), "6509": z.string().optional() })).parse(await ibkr(`/iserver/marketdata/snapshot?conids=${instrument.conid}&fields=31,6509`, c, request));
  const snapshot = snapshots.find(s => String(s.conid) === instrument.conid);
  const text = String(snapshot?.["31"] ?? "").replaceAll(",", "");
  if (!snapshot?._updated || !/^\d+(\.\d+)?$/.test(text) || !Number(text) || !snapshot["6509"]?.startsWith("R"))
    throw new MarketError("A fresh real-time IBKR price is required. Check the data subscription or retry after snapshot initialization.");
  return { instrumentId: instrument.id, price: Number(text), time: snapshot._updated,
    bars: validateBars(history.data.map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })), now) };
}
// Deliberately no order, transfer or withdrawal endpoints in this paper-only release.
