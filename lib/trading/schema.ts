import { z } from "zod";

export const instrumentSchema = z.object({
  id: z.string().regex(/^[A-Z0-9_-]{1,30}$/),
  provider: z.enum(["BINANCE", "IBKR"]),
  symbol: z.string().regex(/^[A-Z0-9.]{1,25}$/),
  kind: z.enum(["CRYPTO", "ETF", "STOCK", "FOREX"]),
  quoteCurrency: z.enum(["AUD", "USD", "USDT", "EUR", "GBP", "JPY"]),
  conid: z.string().regex(/^\d{1,15}$/).optional(),
  enabled: z.boolean(),
  feeBps: z.number().min(0).max(200),
  minimumFee: z.number().min(0).max(100), // Native quote currency, per fill.
  slippageBps: z.number().min(0).max(200),
}).strict().superRefine((item, ctx) => {
  if (item.enabled && item.provider === "IBKR" && !item.conid)
    ctx.addIssue({ code: "custom", path: ["conid"], message: "IBKR contract ID is required." });
  if (item.provider === "BINANCE" && item.kind !== "CRYPTO")
    ctx.addIssue({ code: "custom", path: ["kind"], message: "This connector supports Binance Spot crypto only." });
  if (item.enabled && item.kind === "FOREX")
    ctx.addIssue({ code: "custom", path: ["enabled"], message: "Forex execution is not supported in this first version." });
});
export const settingsSchema = z.object({
  capitalAud: z.number().min(50).max(100000),
  riskAud: z.number().positive().max(100),
  maxPositionAud: z.number().positive().max(100000),
  drawdownAud: z.number().positive().max(10000),
  maxPositions: z.number().int().min(1).max(3),
  instruments: z.array(instrumentSchema).min(1).max(6),
  // Explicit native-currency -> AUD conversions. USDT must not be silently treated as USD.
  fx: z.record(z.string().regex(/^[A-Z]{3,4}$/), z.object({
    audPerUnit: z.number().positive().max(1000),
    asOf: z.iso.datetime(),
  }).strict()),
}).strict().superRefine((settings, ctx) => {
  if (settings.riskAud > settings.capitalAud * 0.01)
    ctx.addIssue({ code: "custom", path: ["riskAud"], message: "Risk may not exceed 1% of virtual capital." });
  if (settings.maxPositionAud > settings.capitalAud || settings.drawdownAud > settings.capitalAud * 0.2 || settings.drawdownAud < settings.riskAud)
    ctx.addIssue({ code: "custom", path: ["drawdownAud"], message: "Check allocation and drawdown limits (maximum drawdown 20% of capital)." });
  if (new Set(settings.instruments.map(i => i.id)).size !== settings.instruments.length ||
      new Set(settings.instruments.map(i => `${i.provider}:${i.conid || i.symbol}`)).size !== settings.instruments.length)
    ctx.addIssue({ code: "custom", path: ["instruments"], message: "Instrument IDs and contracts must be unique." });
});
export type Instrument = z.infer<typeof instrumentSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Bar = { time: number; open: number; high: number; low: number; close: number };
export type Market = { instrumentId: string; price: number; time: number; bars: Bar[] };
const positionSchema = z.object({
  instrumentId: z.string(), quantity: z.number().positive(), entry: z.number().positive(),
  stop: z.number().positive(), costAud: z.number().positive(), openedAt: z.string(),
});
export const stateSchema = z.object({
  cashAud: z.number().nonnegative(), highWaterAud: z.number().positive(),
  equityAud: z.number().nonnegative(), realizedAud: z.number(), feesAud: z.number().nonnegative(),
  positions: z.array(positionSchema), processed: z.record(z.string(), z.number()),
});
export type State = z.infer<typeof stateSchema>;
export function initialState(capitalAud: number): State {
  return { cashAud: capitalAud, highWaterAud: capitalAud, equityAud: capitalAud, realizedAud: 0, feesAud: 0, positions: [], processed: {} };
}
export function defaultSettings(): Settings {
  return { capitalAud: 1000, riskAud: 5, maxPositionAud: 250, drawdownAud: 50, maxPositions: 1, fx: {}, instruments: [
    { id: "BTC", provider: "BINANCE", symbol: "BTCUSDT", kind: "CRYPTO", quoteCurrency: "USDT", enabled: false, feeBps: 10, minimumFee: 0, slippageBps: 10 },
    { id: "SP500", provider: "IBKR", symbol: "IVV", kind: "ETF", quoteCurrency: "AUD", enabled: false, feeBps: 8, minimumFee: 5, slippageBps: 10 },
    { id: "STOCK", provider: "IBKR", symbol: "AAPL", kind: "STOCK", quoteCurrency: "USD", enabled: false, feeBps: 0, minimumFee: 1, slippageBps: 10 },
  ] };
}
export function fxRate(settings: Settings, currency: string, now = Date.now()) {
  if (currency === "AUD") return 1;
  const rate = settings.fx[currency];
  if (!rate || Date.parse(rate.asOf) > now + 60000 || now - Date.parse(rate.asOf) > 86400000)
    throw new Error(`Update the ${currency}/AUD reference rate (maximum age 24 hours).`);
  return rate.audPerUnit;
}
