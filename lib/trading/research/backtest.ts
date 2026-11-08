import { type Dataset, type Daily, type Metrics, type Policy, type Series, type Trial } from "./schema";
function eligible(asset: Series, policy: Policy) {
  return policy.universe === "ALL" || (policy.universe === "CRYPTO" && asset.kind === "CRYPTO") || (policy.universe === "EQUITY" && asset.kind !== "CRYPTO") || (policy.universe === "CORE" && ["BTCUSDT", "ETHUSDT", "VOO", "QQQ"].includes(asset.id));
}
export function fxAt(dataset: Dataset, currency: string, day: number) {
  if (currency === "AUD") return 1;
  const rows = dataset.fx[currency] || [];
  let low = 0, high = rows.length;
  while (low < high) { const middle = (low + high) >> 1; if (rows[middle].day <= day) low = middle + 1; else high = middle; }
  const row = rows[low - 1];
  return row && day - row.day <= 3 ? row.audPerUnit : null;
}
function stats(bars: Daily[], index: number, policy: Policy) {
  if (index < Math.max(policy.trend, policy.lookback, policy.exitDays, 15)) return null;
  const b = bars[index], mean = (n: number) => bars.slice(index - n + 1, index + 1).reduce((sum, item) => sum + item.close, 0) / n;
  const previous = bars.slice(index - policy.lookback, index);
  const ranges = bars.slice(index - 13, index + 1).map((item, n) => Math.max(item.high - item.low, Math.abs(item.high - bars[index - 14 + n].close), Math.abs(item.low - bars[index - 14 + n].close)));
  let gain = 0, loss = 0;
  for (let n = index - 6; n <= index; n++) { const change = bars[n].close - bars[n - 1].close; gain += Math.max(0, change); loss += Math.max(0, -change); }
  const rsi = gain + loss === 0 ? 50 : 100 * gain / (gain + loss);
  const trend = mean(policy.trend), short = mean(Math.min(20, policy.lookback)), atr = ranges.reduce((a, value) => a + value, 0) / 14;
  const entry = policy.family === "BREAKOUT" ? b.close > Math.max(...previous.map(item => item.high)) && b.close > trend
    : policy.family === "PULLBACK" ? b.close > trend && b.close < short && b.close < bars[index - 1].close
    : rsi < 30 && b.close > trend;
  const exit = b.close < Math.min(...bars.slice(index - policy.exitDays, index).map(item => item.low)) || (policy.family === "REVERSION" && rsi > 55);
  return { entry, exit, atr, close: b.close, strength: b.close / trend };
}
function cost(asset: Series, notional: number, stress: number) { return Math.max(asset.minimumFee, notional * asset.feeBps / 10000) * stress; }
export function metrics(initial: number, final: number, start: number, end: number, maxDrawdownPct = 0, feesAud = 0, trades = 0, skipped = 0): Metrics {
  const returnPct = 100 * (final / initial - 1), days = Math.max(1, end - start + 1);
  return { initial, final, start, end, returnPct, maxDrawdownPct, feesAud, trades, skipped,
    score: returnPct * 365 / days - 1.5 * maxDrawdownPct, sufficient: trades >= 3 && days >= 20 };
}
export function researchRange(dataset: Dataset) {
  if (!dataset.assets.length) throw new Error("No assets");
  const start = Math.max(...dataset.assets.map(a => Math.max(a.bars[Math.min(120, a.bars.length - 1)].day, (dataset.fx[a.currency]?.[0]?.day ?? a.bars[0].day) + 1)));
  const end = Math.min(Math.max(...dataset.assets.map(a => a.bars.at(-1)!.day)), ...Object.values(dataset.fx).filter(a => a.length).map(a => a.at(-1)!.day));
  if (end - start < 300) throw new Error("At least 300 evaluable days plus indicator history are required.");
  const length = end - start + 1, trainEnd = start + Math.floor(length * 0.6) - 1, devEnd = start + Math.floor(length * 0.8) - 1;
  return { start, end, trainEnd, devEnd };
}
/** Daily event simulation: prior closed-bar signals, next open fills, and conservative gap stops. */
export function backtest(dataset: Dataset, policy: Policy, capital: number, start: number, end: number, stress = 1): Metrics {
  const assets = dataset.assets.filter(a => eligible(a, policy));
  const indexed = assets.map(asset => ({ asset, lookup: new Map(asset.bars.map((bar, index) => [bar.day, index])), index: -1 }));
  const positions = new Map<string, { qty: number; stop: number }>();
  const unsettled: { amount: number; availableOn: number }[] = [];
  let cash = capital, equity = capital, peak = capital, drawdown = 0, fees = 0, trades = 0, skipped = 0;
  for (const item of indexed) item.index = item.asset.bars.findLastIndex(b => b.day < start);
  for (let day = start; day <= end; day++) {
    for (let n = unsettled.length - 1; n >= 0; n--) if (unsettled[n].availableOn <= day) { cash += unsettled[n].amount; unsettled.splice(n, 1); }
    const sold = new Set<string>();
    const sell = (asset: Series, native: number, fx: number) => {
      const position = positions.get(asset.id)!;
      const fill = native * (1 - asset.slippageBps * stress / 10000), fee = cost(asset, fill * position.qty, stress) * fx;
      const proceeds = fill * position.qty * fx - fee;
      if (asset.provider === "IBKR") unsettled.push({ amount: proceeds, availableOn: asset.bars.find(b => b.day > day)?.day ?? day + 4 });
      else cash += proceeds;
      fees += fee; trades++;
      positions.delete(asset.id); sold.add(asset.id);
    };
    for (const item of indexed) {
      const n = item.lookup.get(day); if (n === undefined) continue;
      item.index = n;
      const position = positions.get(item.asset.id), fx = fxAt(dataset, item.asset.currency, day - 1), signal = stats(item.asset.bars, n - 1, policy), bar = item.asset.bars[n];
      if (!position || !fx) continue;
      if (signal) position.stop = Math.max(position.stop, signal.close - signal.atr * policy.stopAtr);
      if (signal?.exit || bar.open <= position.stop) sell(item.asset, bar.open, fx);

    }
    const candidates = indexed.flatMap(item => {
      const n = item.lookup.get(day); if (n === undefined || n < 1 || day - item.asset.bars[n - 1].day > 7) return [];
      const signal = stats(item.asset.bars, n - 1, policy);
      return signal?.entry && signal.atr > 0 ? [{ ...item, n, signal }] : [];
    }).sort((a, b) => b.signal.strength - a.signal.strength || a.asset.id.localeCompare(b.asset.id));
    const openingEquity = cash + unsettled.reduce((sum, receipt) => sum + receipt.amount, 0) + indexed.reduce((sum, item) => {
      const p = positions.get(item.asset.id); if (!p || item.index < 0) return sum;
      const fx = fxAt(dataset, item.asset.currency, day - 1); if (!fx) return sum;
      const price = item.lookup.has(day) ? item.asset.bars[item.index].open : item.asset.bars[item.index].close;
      return sum + p.qty * price * fx;
    }, 0);
    for (const item of candidates) {
      const { asset, signal, n } = item;
      if (positions.size >= policy.maxPositions || positions.has(asset.id) || sold.has(asset.id)) continue;
      const fx = fxAt(dataset, asset.currency, day - 1); if (!fx) { skipped++; continue; }
      const bar = asset.bars[n], entry = bar.open * (1 + asset.slippageBps * stress / 10000), stop = signal.close - policy.stopAtr * signal.atr;
      if (stop <= 0 || entry <= stop) continue;
      const exit = stop * (1 - asset.slippageBps * stress / 10000), budget = Math.min(cash, openingEquity * policy.allocation);
      const fixed = 2 * asset.minimumFee * stress * fx;
      const perUnit = (entry - exit + (entry + exit) * asset.feeBps * stress / 10000) * fx;
      let qty = Math.min((openingEquity * policy.riskFraction - fixed) / perUnit,
        (budget - asset.minimumFee * stress * fx) / (entry * fx * (1 + asset.feeBps * stress / 10000)));
      qty = asset.provider === "IBKR" ? Math.floor(qty) : Math.floor(qty * 1e8) / 1e8;
      if (!(qty > 0)) { skipped++; continue; }
      const fee = cost(asset, entry * qty, stress) * fx, total = entry * qty * fx + fee;
      const loss = (entry - exit) * qty * fx + fee + cost(asset, exit * qty, stress) * fx;
      if (total > budget + 1e-8 || loss > openingEquity * policy.riskFraction + 1e-8) { skipped++; continue; }
      cash -= total; fees += fee; positions.set(asset.id, { qty, stop });

    }
    // Intraday stops happen AFTER all opening orders: future lows must not free cash/slots for earlier entries.
    for (const item of indexed) {
      const n = item.lookup.get(day), p = positions.get(item.asset.id), fx = fxAt(dataset, item.asset.currency, day - 1);
      if (n !== undefined && p && fx && item.asset.bars[n].low <= p.stop) sell(item.asset, p.stop, fx);
    }
    equity = cash + unsettled.reduce((sum, receipt) => sum + receipt.amount, 0);
    for (const item of indexed) {
      const p = positions.get(item.asset.id); if (!p) continue;
      const fx = fxAt(dataset, item.asset.currency, day);
      if (!fx || item.index < 0 || day - item.asset.bars[item.index].day > 7) throw new Error("Position valuation lacks a current historical FX/price observation.");
      equity += p.qty * item.asset.bars[item.index].close * fx;
    }
    peak = Math.max(peak, equity); drawdown = Math.max(drawdown, 100 * (peak - equity) / peak);
  }
  // Liquidate for comparable terminal net P&L; this is a hypothetical boundary exit, not a strategy signal.
  for (const item of indexed) {
    const p = positions.get(item.asset.id); if (!p) continue;
    const fx = fxAt(dataset, item.asset.currency, end); if (!fx || item.index < 0) throw new Error("Missing terminal valuation");
    const fill = item.asset.bars[item.index].close * (1 - item.asset.slippageBps * stress / 10000), fee = cost(item.asset, fill * p.qty, stress) * fx;
    cash += fill * p.qty * fx - fee; fees += fee;
  }
  cash += unsettled.reduce((sum, receipt) => sum + receipt.amount, 0);
  drawdown = Math.max(drawdown, 100 * (peak - cash) / peak);
  return metrics(capital, Math.max(0, cash), start, end, drawdown, fees, trades, skipped);
}
export function buyAndHold(dataset: Dataset, capital: number, start: number, end: number): Metrics {
  const assets = dataset.assets.filter(a => a.bars.some(b => b.day >= start && b.day <= end));
  if (!assets.length) return metrics(capital, capital, start, end);
  let cash = capital, fees = 0, final = capital, peak = capital, dd = 0;
  const holdings = new Map<string, { asset: Series; qty: number }>(), attempted = new Set<string>();
  for (let day = start; day <= end; day++) {
    for (const asset of assets) {
      if (attempted.has(asset.id)) continue;
      const bar = asset.bars.find(b => b.day === day); if (!bar) continue;
      const fx = fxAt(dataset, asset.currency, day - 1); if (!fx) continue;
      attempted.add(asset.id);
      const price = bar.open * (1 + asset.slippageBps / 10000), allocation = Math.min(cash, capital / assets.length);
      let qty = Math.max(0, (allocation - asset.minimumFee * fx) / (price * fx * (1 + asset.feeBps / 10000)));
      if (asset.provider === "IBKR") qty = Math.floor(qty);
      const fee = cost(asset, qty * price, 1) * fx;
      if (!qty || qty * price * fx + fee > allocation + 1e-8) continue;
      cash -= qty * price * fx + fee; fees += fee; holdings.set(asset.id, { asset, qty });
    }
    final = cash;
    for (const p of holdings.values()) {
      const bar = p.asset.bars.findLast(b => b.day <= day), fx = fxAt(dataset, p.asset.currency, day);
      if (!bar || !fx) throw new Error("Missing benchmark valuation");
      final += p.qty * bar.close * fx;
    }
    peak = Math.max(peak, final); dd = Math.max(dd, 100 * (peak - final) / peak);
  }
  for (const p of holdings.values()) {
    const last = p.asset.bars.findLast(b => b.day <= end)!, fx = fxAt(dataset, p.asset.currency, end)!;
    const price = last.close * (1 - p.asset.slippageBps / 10000), fee = cost(p.asset, p.qty * price, 1) * fx;
    final -= p.qty * last.close * fx - (p.qty * price * fx - fee); fees += fee;
  }
  final = Math.max(0, final); dd = Math.max(dd, 100 * (peak - final) / peak);
  return metrics(capital, final, start, end, dd, fees, holdings.size);
}
export function compareCandidates(dataset: Dataset, policies: Policy[], capital: number, start: number, trainEnd: number, devEnd: number): Trial[] {
  return policies.map(policy => ({ policy, training: backtest(dataset, policy, capital, start, trainEnd), validation: backtest(dataset, policy, capital, trainEnd + 1, devEnd) }))
    .sort((a, b) => {
      const score = (trial: Trial) => Math.min(trial.training.score, trial.validation.score) + trial.validation.score * 0.25 - (!trial.training.sufficient || !trial.validation.sufficient ? 10000 : 0);
      return score(b) - score(a);
    });
}
