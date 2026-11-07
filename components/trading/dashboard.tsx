"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/trading/schema";
import type { readiness } from "@/lib/trading/config";
import type { tradingView } from "@/lib/trading/service";
import "./trading.css";
type View = Awaited<ReturnType<typeof tradingView>>;
type Ready = ReturnType<typeof readiness>;
const money = (amount: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
export function TradingDashboard({ initial, ready }: { initial: View; ready: Ready }) {
  const router = useRouter();
  const [view, setView] = useState(initial), [settings, setSettings] = useState<Settings>(initial.settings);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState(false);
  const [balances, setBalances] = useState<Record<string, { asset: string; free: string; locked: string }[]>>({});
  async function refresh() {
    const response = await fetch("/api/assistants/trading", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh the private dashboard.");
    setView(await response.json());
  }
  useEffect(() => {
    const interval = setInterval(() => { void refresh().catch(() => undefined); }, 30000);
    return () => clearInterval(interval);
  }, []);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setStatus(""); setError(false);
    try {
      const response = await fetch("/api/assistants/trading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action failed.");
      if (action === "connection") setBalances(previous => ({ ...previous, [String(extra.provider)]: result.balances }));
      setStatus(result.skipped ? `Cycle skipped: ${result.skipped}` : action === "connection" ? "Connected. These account balances are read-only and are excluded from the paper portfolio." : "Saved. Paper mode only; no live orders sent.");
      await refresh(); router.refresh();
    } catch (e) { setError(true); setStatus(e instanceof Error ? e.message : "Please retry."); }
    finally { setBusy(false); }
  }
  const locked = view.enabled || view.state.positions.length > 0;
  const currencies = [...new Set(settings.instruments.filter(i => i.enabled).map(i => i.quoteCurrency))].filter(c => c !== "AUD");
  const latestReport = view.events.find(e => e.kind === "REPORT");
  return <div className="trading-workspace">
    <header className="trading-heading"><div><p className="trading-eyebrow">Personal workspace · Owner only</p><h1>Trading lab</h1><p>One private view for Binance crypto and IBKR stocks and ETFs.</p></div><span className="trading-badge">PAPER ONLY</span></header>
    <section className="trading-notice"><strong>{view.enabled ? view.entriesPaused ? "Entries paused · Monitoring open positions" : "Paper worker enabled" : "Paper worker stopped"}</strong><p>No real orders, transfers or withdrawals. Existing holdings are excluded. Last cycle: {view.lastRunAt ? new Date(view.lastRunAt).toLocaleString("en-AU") : "Not run yet"}. Portfolio values reflect the last successful observations and may be stale.</p></section>
    <div className="trading-metrics">
      <article><small>Virtual equity · AUD</small><strong>{money(view.state.equityAud)}</strong><span>Initial capital {money(view.settings.capitalAud)}</span></article>
      <article><small>Realized P&L · AUD</small><strong>{money(view.state.realizedAud)}</strong><span>After estimated execution costs</span></article>
      <article><small>Virtual cash · AUD</small><strong>{money(view.state.cashAud)}</strong><span>Not your broker balance</span></article>
      <article><small>Estimated fees · AUD</small><strong>{money(view.state.feesAud)}</strong><span>{view.state.positions.length} open paper positions</span></article>
    </div>
    <section className="trading-card"><h2>Connections</h2><p>Credentials are configured on the server. Account checks never place orders.</p>
      <div className="trading-connections">{(["BINANCE", "IBKR"] as const).map(provider => <article key={provider}><h3>{provider === "BINANCE" ? `Binance Spot${ready.binanceTestnet ? " · Testnet" : ""}` : "Interactive Brokers"}</h3><p>{(provider === "BINANCE" ? ready.binance : ready.ibkr) ? "Configured · Connection not yet verified" : "Server configuration required"}</p><button disabled={busy || !ready.enabled || !(provider === "BINANCE" ? ready.binance : ready.ibkr)} onClick={() => void act("connection", { provider })}>Check read-only connection</button>{balances[provider] && <ul>{balances[provider].length ? balances[provider].map(b => <li key={b.asset}>{b.asset}: {b.free} available · {b.locked} locked</li>) : <li>No non-zero balances returned.</li>}</ul>}</article>)}</div>
    </section>
    <section className="trading-card"><h2>Paper controls</h2><p>Pause entries keeps monitoring exits. Stop disables all paper monitoring. The scheduled worker must also be running on the server.</p><div className="trading-actions">
      <button disabled={busy || !ready.enabled || view.enabled} onClick={() => void act("start")}>Start paper worker</button>
      <button disabled={busy || !ready.enabled || !view.enabled} onClick={() => void act("stop")}>Stop worker</button>
      <button disabled={busy || !ready.enabled} onClick={() => void act(view.entriesPaused ? "resume-entries" : "pause-entries")}>{view.entriesPaused ? "Resume entries" : "Pause entries"}</button>
      <button disabled={busy || !ready.enabled} onClick={() => void act("cycle")}>Run one paper cycle</button>
      <button disabled={busy || !ready.enabled || view.enabled || !view.state.positions.length} onClick={() => void act("close-paper")}>Close all paper positions</button>
    </div><p className="trading-small">A stop is simulated at the next observed price, with slippage. It does not guarantee a maximum loss. This first version uses daily signals and checks exits on each worker cycle; it is not a historical backtest or a live execution system.</p></section>
    {status && <p className={`trading-status${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{status}</p>}
    <section className="trading-card"><h2>Strategy & limits</h2><p>Candidate strategy: buy a closed daily breakout over the previous 20-day high when above the 200-day average. Initial and trailing stop: 2× the average true range over 14 days. Exit on the stop or a daily close below the previous 10-day low. This strategy has not been validated for these instruments.</p>
      {locked && <p className="trading-small">Stop the worker and close paper positions before editing settings.</p>}
      <form onSubmit={event => { event.preventDefault(); void act("settings", { settings }); }}><fieldset disabled={busy || locked || !ready.enabled}>
        <div className="trading-fields">{([['capitalAud', 'Initial virtual capital (fixed)'], ['riskAud', 'Risk per trade · AUD'], ['maxPositionAud', 'Maximum allocation · AUD'], ['drawdownAud', 'Pause after drawdown · AUD'], ['maxPositions', 'Maximum open positions']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" step={key === "maxPositions" ? 1 : "0.01"} min="0" disabled={key === "capitalAud"} value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })}/></label>)}</div>
        <h3>Instruments</h3><p className="trading-small">Confirm the contract, exchange, currency and actual fee schedule before enabling each instrument. Fee estimates below are editable examples, not verified account tariffs. IBKR simulation uses whole shares.</p>
        {settings.instruments.map((instrument, index) => <div className="trading-instrument" key={instrument.id}><label className="trading-check"><input type="checkbox" checked={instrument.enabled} onChange={e => setSettings({ ...settings, instruments: settings.instruments.map((i, n) => n === index ? { ...i, enabled: e.target.checked } : i) })}/>{instrument.provider} · {instrument.kind}</label><div className="trading-fields">
          <label>Symbol<input value={instrument.symbol} required onChange={e => setSettings({ ...settings, instruments: settings.instruments.map((i, n) => n === index ? { ...i, symbol: e.target.value.toUpperCase() } : i) })}/></label>
          <label>Quote currency<select value={instrument.quoteCurrency} onChange={e => setSettings({ ...settings, instruments: settings.instruments.map((i, n) => n === index ? { ...i, quoteCurrency: e.target.value as typeof i.quoteCurrency } : i) })}>{["AUD", "USD", "USDT", "EUR", "GBP", "JPY"].map(c => <option key={c}>{c}</option>)}</select></label>
          {instrument.provider === "IBKR" && <label>Exact contract ID (conid)<input inputMode="numeric" value={instrument.conid || ""} onChange={e => setSettings({ ...settings, instruments: settings.instruments.map((i, n) => n === index ? { ...i, conid: e.target.value || undefined } : i) })}/></label>}
          {([['feeBps', 'Fee · basis points'], ['minimumFee', 'Minimum fee · quote currency'], ['slippageBps', 'Slippage · basis points']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" step="0.01" min="0" value={instrument[key]} onChange={e => setSettings({ ...settings, instruments: settings.instruments.map((i, n) => n === index ? { ...i, [key]: Number(e.target.value) } : i) })}/></label>)}
        </div></div>)}
        <button type="submit">Save paper settings</button>
      </fieldset></form><fieldset disabled={busy || !ready.enabled}>
        {!!currencies.length && <><h3>Reference exchange rates</h3><p className="trading-small">Enter the AUD value of one unit of each currency and its actual observation time. Rates expire after 24 hours. No new entries or exits are simulated using expired FX rates. USDT is not assumed to equal USD.</p>{currencies.map(currency => <div className="trading-fields" key={currency}><label>1 {currency} in AUD<input type="number" min="0" step="0.000001" value={settings.fx[currency]?.audPerUnit || ""} onChange={e => setSettings({ ...settings, fx: { ...settings.fx, [currency]: { asOf: settings.fx[currency]?.asOf || new Date().toISOString(), audPerUnit: Number(e.target.value) } } })}/></label><label>Observed at (UTC ISO timestamp)<input placeholder="2026-11-08T00:00:00.000Z" value={settings.fx[currency]?.asOf || ""} onChange={e => setSettings({ ...settings, fx: { ...settings.fx, [currency]: { audPerUnit: settings.fx[currency]?.audPerUnit || 0, asOf: e.target.value } } })}/></label></div>)}</>}
        {!!currencies.length && <button type="button" onClick={() => void act("fx", { fx: settings.fx })}>Update reference rates only</button>}
      </fieldset>
    </section>
    <section className="trading-card"><h2>Open paper positions</h2>{!view.state.positions.length ? <p>No positions. Waiting for valid data and a qualifying signal.</p> : <div className="trading-table-wrap"><table><thead><tr><th>Instrument</th><th>Quantity</th><th>Entry</th><th>Stop</th><th>Cost · AUD</th></tr></thead><tbody>{view.state.positions.map(p => <tr key={p.instrumentId}><td>{p.instrumentId}</td><td>{p.quantity.toPrecision(6)}</td><td>{p.entry.toFixed(4)}</td><td>{p.stop.toFixed(4)}</td><td>{money(p.costAud)}</td></tr>)}</tbody></table></div>}</section>
    <section className="trading-card"><div className="trading-heading"><div><h2>Claude review</h2><p>Explains recorded results; cannot place orders. Up to four reports per UTC day. API usage is recorded separately from customer assistants.</p></div><button disabled={busy || !ready.enabled || !ready.ai} onClick={() => void act("report")}>Generate review</button></div>{!ready.ai && <p className="trading-small">Configure the Claude API key and trading model on the server.</p>}{latestReport && <><small>{new Date(latestReport.createdAt).toLocaleString("en-AU")}</small><p className="trading-report">{latestReport.message}</p></>}</section>
    <section className="trading-card"><h2>Activity</h2>{view.events.filter(e => e.kind !== "REPORT").length ? view.events.filter(e => e.kind !== "REPORT").map(event => <article className="trading-event" key={event.id}><small>{new Date(event.createdAt).toLocaleString("en-AU")} · {event.kind}{event.instrumentId ? ` · ${event.instrumentId}` : ""}</small><p>{event.message}</p>{event.data && <pre>{JSON.stringify(event.data, null, 2)}</pre>}</article>) : <p>No activity yet. Configure a connection and run a paper cycle.</p>}</section>
  </div>;
}
