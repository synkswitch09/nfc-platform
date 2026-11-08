# Autonomous paper research — capital is the only strategy input

The main Trading Lab now asks for initial virtual AUD capital (AUD 1,000 by default) and Start.
After that, its scheduled worker chooses and evaluates strategies without asking the owner to
set stops, position counts, assets, currencies, contract IDs or review timing. Broker/provider
credentials and authenticated IBKR sessions still require initial service setup. No implementation
can autonomously supply the owner's credentials or override a provider's access restrictions.

This is a research system, not real execution or a guarantee of finding the globally best strategy.
It searches a finite declared family of policies and can conclude that cash is the best qualified
reference so far. No live order, withdrawal or transfer methods are introduced.

## Automatic cycle

1. Discover usable market data and historical AUD conversion quotes. The declared pool is BTC,
   ETH, SOL, BNB, XRP and ADA on Binance Spot, and VOO, QQQ, AAPL, MSFT, AMZN and NVDA on IBKR.
   Only supported symbols/contracts with enough data are included. IBKR contracts are resolved
   and checked against symbol, currency and STK type; ambiguous contracts are skipped.
   Missing IBKR access does not turn simulated crypto into a claim about equities.
2. Compare 24 predeclared combinations of breakout, trend pullback and mean-reversion signals.
   Policies vary lookback, trend filter, exit channel, ATR stop distance, risk per entry,
   allocation, maximum open positions (1–8) and universe subset (core, crypto, equities or all).
   All start with the same virtual capital; these are independent comparisons, not 24 real deposits.
3. Use the earliest 60% of evaluable history for training and the next 20% for validation.
   Candidate selection uses those development periods only. Evaluate the selected candidate
   ONCE on the last 20%, plus a predefined doubled-cost stress test. The final test is not
   used to pick another initial candidate.
4. Compare with cash and equal-weight buy-and-hold over the same dates. Promotion requires
   positive net performance, at least three closed strategy trades, at least 20 dates,
   maximum close-to-close drawdown at most 35%, positive doubled-cost performance and a
   return/drawdown score more than one point above the reference scores. These are fixed
   eligibility rules, not a statistical proof of skill.
5. Claude reviews the recorded results and proposes 1–4 bounded parameter objects. It cannot
   execute code, change the search limits, request arbitrary assets/URLs, access secrets or
   place orders. Proposals are schema-validated, compared on development data, and one is frozen.
6. The frozen challenger must face 20 NEW calendar dates with closed market data after the previous sealed window.
   Each version freezes its actual asset IDs. A newly connected market can enter the NEXT
   candidate pool, never be retroactively added to the incumbent. Missing frozen assets make
   that comparison unavailable instead of silently dropping positions.
   Old final tests may become training observations in a later generation, but are never
   reused as a new final test to prove improvement. If no new data or too few trades exist,
   the result is waiting/inconclusive; the system does not manufacture a winner.
7. Compare challenger, incumbent/cash and buy-and-hold on the new window. Promote only if
   eligibility rules pass, then queue the next Claude review. Otherwise keep the incumbent.
   Each promoted version's displayed paper run begins after promotion, not retroactively.

The score is annualized simple net return minus 1.5 times maximum observed daily drawdown.
Neither that objective nor these search bounds establish a universal optimum. Twenty dates
and three trades may still be weak evidence; the UI never calls a promotion proven profitability.
More trials create selection bias even when final windows are disjoint. The fixed current
asset pool can contain survivorship bias and omits assets/strategies outside the pool.

## Simulation mechanics and costs

- Signals use prior CLOSED daily bars; entries are filled at the next available open.
- Opening orders cannot use future intraday lows to free cash or position slots. Intraday
  stop checks occur after all opening entries. Gaps through a stop fill at the adverse open.
- IBKR simulates whole shares and reserves sale proceeds until the next observed trading date,
  rather than immediately financing new entries with unsettled cash.
- Entry sizing uses cash only, with no leverage or extra capital. Each policy's risk budget
  includes estimated entry/exit fees and slippage. Losses can exceed planned stop risk.
- Binance assumptions: 15 basis points fee and 15 basis points slippage per fill. IBKR US
  stocks/ETF assumptions: 1 basis point fee with a USD 1 minimum and 15 basis points slippage.
  These conservative modeling assumptions are not the owner's verified account tariff;
  costs are automatically stressed at twice the assumptions. Taxes are not modeled.
- Endpoint comparisons include a hypothetical final liquidation for net comparable value.
  That boundary liquidation is not counted as a successful closed strategy trade.
- AUD conversion uses public Kraken daily USDT/AUD and AUD/USD reference quotes; USD and USDT
  are not silently equated. Prior-day rates fund opening transactions; same-day closed rates
  value end-of-day positions. A reference older than three dates cannot be used. These are
  valuation references, not actual conversion fills, and do not require a Kraken account.
- Kraken's OHLC history is limited to roughly 720 observations. No longer history is invented.
  Observed closed bars and FX are retained as rolling windows advance; overlapping observations
  remain fixed for reproducibility. Provider corrections are not automatically retrofitted.
  Binance/IBKR history and corporate-action adjustments are provider-dependent; data outages,
  spread, liquidity, lot filters and intraday order paths can differ in actual execution.

## Persistence, cost limits and operation

`TradingResearch` stores the experiment stage, current version, challenger and cached data.
`TradingResearchBatch` keeps immutable generation snapshots, a SHA-256 fingerprint and results.
The worker uses expiring database leases with token-checked transactional commits. Concurrent
workers cannot commit duplicate generations. Pausing takes effect between active bounded cycles.
The old manual worker is disabled when autonomous research starts, preventing two active modes.

Claude uses `TRADING_AI_MODEL`, or the first enabled model in the existing assistant catalogue,
and the existing `ANTHROPIC_API_KEY`. Each response is limited to 1,400 output tokens with a
bounded input summary. Attempts, including failures, are capped at four per UTC day, with a
one-hour retry cooldown. Token usage and model IDs are recorded separately from customer quotas.
Successful reviews normally occur only after completed windows, not on each price update.
Invalid/unavailable reviews retain the incumbent and retry; they never authorize real trading.

The scheduler checks every five minutes. Forward comparison work is throttled to hourly and
source discovery is refreshed at most every six hours; only closed daily observations count.
Capital is fixed once the experiment starts so comparison history is not silently reset.

The production deployment workflow now runs `ensure-trading-worker.py`. If `TRADING_ENABLED=true`
and an owner and worker secret are configured, it creates/updates a dedicated same-image
Container Apps Job (`<app>-trading`) on a five-minute schedule. Staging remains manual. The job
receives only APP_URL and a worker bearer secret, never broker or Claude secrets. Existing
unmanaged jobs are not overwritten. The app must be redeployed to provision/update this job.
API and compute charges are separate from the virtual AUD 1,000 and depend on provider/Azure
pricing; no claim of zero infrastructure cost is made.

UI: `/trading` on the assistant host, or `/admin/trading` on a store host. The previous manual
lab remains in an optional collapsed section for history; it is not required by this workflow.
Start once, then let the scheduler run. The owner can pause at any time. No account balances
or real holdings are automatically allocated to the experiment.

## Validation

Unit tests cover bounded AI proposals, chronological split integrity, historical FX timing,
conservative execution order, insufficient evidence, unavailable providers and discovery.
A disposable PostgreSQL CI check covers capital-only start, concurrent cycle leases, immutable
batch persistence, review sequencing and strictly increasing forward windows. Live Binance
access may be unavailable from some hosting jurisdictions; do not evade a provider restriction.
Configure an eligible deployment/data source and leave results unavailable when access fails.

References:
- https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/walk-forward-optimization
- https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf
- https://support.kraken.com/articles/advanced-api-faq
