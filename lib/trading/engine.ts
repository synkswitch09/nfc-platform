import { fxRate, type Bar, type Instrument, type Market, type Settings, type State } from "./schema";
export type PaperEvent = { kind: "BUY" | "SELL" | "PAUSE" | "SKIP"; instrumentId?: string; message: string; data?: Record<string, number | string> };
export function indicators(bars: Bar[]) {
  if (bars.length < 201) return null;
  const latest = bars.at(-1)!;
  const previous = bars.slice(0, -1);
  const sma = bars.slice(-200).reduce((sum, b) => sum + b.close, 0) / 200;
  const ranges = bars.slice(-14).map((b, i) => {
    const lastClose = bars[bars.length - 15 + i].close;
    return Math.max(b.high - b.low, Math.abs(b.high - lastClose), Math.abs(b.low - lastClose));
  });
  return { time: latest.time, close: latest.close, sma,
    atr: ranges.reduce((a, b) => a + b, 0) / ranges.length,
    breakout: Math.max(...previous.slice(-20).map(b => b.high)),
    exit: Math.min(...previous.slice(-10).map(b => b.low)) };
}
export function validMarket(market: Market | undefined, now: number) {
  return Boolean(market && Number.isFinite(market.price) && market.price > 0 &&
    Number.isFinite(market.time) && market.time <= now + 60000 && now - market.time <= 5 * 60000);
}
function fee(i: Instrument, notional: number) { return Math.max(i.minimumFee, notional * i.feeBps / 10000); }
export function paperCycle(settings: Settings, previous: State, markets: Market[], now = Date.now()) {
  const state: State = structuredClone(previous), events: PaperEvent[] = [];
  const byId = new Map(markets.map(m => [m.instrumentId, m]));
  const rates = new Map<string, number>();
  for (const i of settings.instruments.filter(i => i.enabled || state.positions.some(p => p.instrumentId === i.id))) {
    try { rates.set(i.id, fxRate(settings, i.quoteCurrency, now)); }
    catch (e) { events.push({ kind: "SKIP", instrumentId: i.id, message: (e as Error).message }); }
  }
  const completeValuation = state.positions.every(p => validMarket(byId.get(p.instrumentId), now) && rates.has(p.instrumentId));
  function markEquity() {
    if (!completeValuation) return;
    state.equityAud = state.cashAud + state.positions.reduce((sum, p) => sum + p.quantity * byId.get(p.instrumentId)!.price * rates.get(p.instrumentId)!, 0);
    state.highWaterAud = Math.max(state.highWaterAud, state.equityAud);
  }
  markEquity();
  let paused = completeValuation && state.highWaterAud - state.equityAud >= settings.drawdownAud;
  // Exits run before entry decisions, including when a drawdown threshold is reached.
  for (const position of [...state.positions]) {
    const i = settings.instruments.find(i => i.id === position.instrumentId)!;
    const market = byId.get(i.id), rate = rates.get(i.id);
    if (!validMarket(market, now) || !rate) { events.push({ kind: "SKIP", instrumentId: i.id, message: "Position cannot be monitored: missing fresh price or FX rate. No new entries allowed." }); continue; }
    const signal = indicators(market!.bars);
    const newBar = signal && signal.time > (state.processed[i.id] ?? 0);
    const oldStop = position.stop;
    if (newBar && signal.atr > 0) position.stop = Math.max(position.stop, signal.close - 2 * signal.atr);
    if (market!.price <= oldStop || market!.price <= position.stop || (newBar && signal.close < signal.exit)) {
      // Simulate observed execution, including gaps and adverse slippage. Never pretend a stop guarantees its price.
      const price = market!.price * (1 - i.slippageBps / 10000);
      const notional = price * position.quantity, fees = fee(i, notional) * rate;
      const proceeds = notional * rate - fees;
      state.cashAud = Math.max(0, state.cashAud + proceeds);
      state.realizedAud += proceeds - position.costAud; state.feesAud += fees;
      state.positions = state.positions.filter(p => p.instrumentId !== i.id);
      state.processed[i.id] = signal?.time ?? now;
      events.push({ kind: "SELL", instrumentId: i.id, message: "Paper exit at observed price, after estimated fees and slippage.", data: { quantity: position.quantity, price, feesAud: fees, pnlAud: proceeds - position.costAud } });
    }
  }
  markEquity();
  paused ||= completeValuation && state.highWaterAud - state.equityAud >= settings.drawdownAud;
  if (paused) events.push({ kind: "PAUSE", message: "Drawdown limit reached. New entries paused; existing paper positions continue to be monitored." });
  for (const i of settings.instruments.filter(i => i.enabled)) {
    const market = byId.get(i.id), rate = rates.get(i.id);
    if (!validMarket(market, now) || !rate) continue;
    const signal = indicators(market!.bars);
    if (!signal || signal.time <= (state.processed[i.id] ?? 0)) continue;
    // Reject stale daily signals (allow weekends/holidays for exchange-traded instruments).
    if (now - signal.time > (i.provider === "BINANCE" ? 3 : 7) * 86400000) {
      events.push({ kind: "SKIP", instrumentId: i.id, message: "Historical signal is stale." }); continue;
    }
    state.processed[i.id] = signal.time;
    if (paused || !completeValuation || state.positions.some(p => p.instrumentId === i.id) || state.positions.length >= settings.maxPositions) continue;
    if (!(signal.close > signal.sma && signal.close > signal.breakout && signal.atr > 0)) continue;
    const price = market!.price * (1 + i.slippageBps / 10000), stop = signal.close - 2 * signal.atr;
    if (stop <= 0 || price <= stop) continue;
    // Include entry + projected stop-exit costs in the risk budget.
    const exitPrice = stop * (1 - i.slippageBps / 10000);
    const fixedFees = 2 * i.minimumFee * rate;
    const perUnitRisk = (price - exitPrice + (price + exitPrice) * i.feeBps / 10000) * rate;
    const available = Math.min(settings.maxPositionAud, state.cashAud);
    let quantity = Math.min((settings.riskAud - fixedFees) / perUnitRisk,
      (available - i.minimumFee * rate) / (price * rate * (1 + i.feeBps / 10000)));
    // Conservative whole-share sizing until fractional execution is verified for the IBKR API.
    if (i.provider === "IBKR") quantity = Math.floor(quantity);
    else quantity = Math.floor(quantity * 1e8) / 1e8;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      events.push({ kind: "SKIP", instrumentId: i.id, message: "Risk/allocation budget cannot cover fees or a whole share. Do not increase risk automatically." }); continue;
    }
    const entryFee = fee(i, price * quantity) * rate;
    const cost = price * quantity * rate + entryFee;
    const projectedRisk = (price - exitPrice) * quantity * rate + entryFee + fee(i, exitPrice * quantity) * rate;
    if (cost > available + 1e-8 || projectedRisk > settings.riskAud + 1e-8) continue;
    state.cashAud = Math.max(0, state.cashAud - cost); state.feesAud += entryFee;
    state.positions.push({ instrumentId: i.id, quantity, entry: price, stop, costAud: cost, openedAt: new Date(now).toISOString() });
    events.push({ kind: "BUY", instrumentId: i.id, message: "Paper entry: closed daily breakout above the 200-day average.", data: { quantity, price, stop, costAud: cost, riskAud: projectedRisk, feesAud: entryFee } });
  }
  markEquity();
  return { state, events, paused, valuationFresh: completeValuation };
}
