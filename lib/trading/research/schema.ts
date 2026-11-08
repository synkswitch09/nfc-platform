import { z } from "zod";
export const DAY = 86400000;
export const policySchema = z.object({
  family: z.enum(["BREAKOUT", "PULLBACK", "REVERSION"]),
  lookback: z.number().int().min(5).max(60), trend: z.number().int().min(20).max(120),
  exitDays: z.number().int().min(3).max(30), stopAtr: z.number().min(0.75).max(6),
  riskFraction: z.number().min(0.0025).max(0.04), allocation: z.number().min(0.1).max(1),
  maxPositions: z.number().int().min(1).max(8),
  universe: z.enum(["ALL", "CRYPTO", "EQUITY", "CORE"]),
}).strict();
export type Policy = z.infer<typeof policySchema>;
export const dailySchema = z.object({ day: z.number().int().nonnegative(), open: z.number().positive(), high: z.number().positive(), low: z.number().positive(), close: z.number().positive() }).strict();
export type Daily = z.infer<typeof dailySchema>;
export const seriesSchema = z.object({
  id: z.string(), symbol: z.string(), provider: z.enum(["BINANCE", "IBKR"]),
  kind: z.enum(["CRYPTO", "ETF", "STOCK"]), currency: z.enum(["AUD", "USD", "USDT"]), conid: z.string().optional(),
  bars: z.array(dailySchema), feeBps: z.number().min(0).max(100), minimumFee: z.number().min(0).max(100), slippageBps: z.number().min(0).max(100),
}).strict();
export type Series = z.infer<typeof seriesSchema>;
export const datasetSchema = z.object({
  fetchedAt: z.number(), assets: z.array(seriesSchema).max(12),
  fx: z.record(z.string(), z.array(z.object({ day: z.number(), audPerUnit: z.number().positive() }).strict())),
  issues: z.array(z.string()), sources: z.array(z.string()),
}).strict();
export type Dataset = z.infer<typeof datasetSchema>;
export type Metrics = { start: number; end: number; initial: number; final: number; returnPct: number; maxDrawdownPct: number; feesAud: number; trades: number; skipped: number; score: number; sufficient: boolean };
export type Trial = { policy: Policy; training: Metrics; validation: Metrics };
export type Evaluation = { generation: number; policy: Policy; metrics: Metrics; cash: Metrics; hold: Metrics; accepted: boolean; note: string };
export type LabState = {
  stage: "INITIAL" | "REVIEW" | "FORWARD"; generation: number;
  champion?: Policy; challenger?: Policy; candidates?: Trial[];
  evaluations: Evaluation[]; reviews: { generation: number; text: string; model: string; inputTokens: number; outputTokens: number; at: number }[];
  events: { at: number; text: string }[]; sealEnd?: number; devEnd?: number; initialStart?: number;
  live?: Metrics; liveHold?: Metrics; latestDataDay?: number; lastReviewAttempt?: number;
};
export function emptyLab(): LabState { return { stage: "INITIAL", generation: 0, evaluations: [], reviews: [], events: [] }; }
export function note(state: LabState, text: string, now = Date.now()) { state.events = [{ at: now, text }, ...state.events].slice(0, 60); }
export function initialPolicies(): Policy[] {
  // Small declared search budget, not an unbounded parameter sweep.
  return Array.from({ length: 24 }, (_, n) => policySchema.parse({
    family: ["BREAKOUT", "PULLBACK", "REVERSION"][n % 3], lookback: [10, 20, 40][Math.floor(n / 3) % 3], trend: [50, 100][Math.floor(n / 6) % 2],
    exitDays: [5, 10, 20][n % 3], stopAtr: [1, 2, 3, 4][Math.floor(n / 3) % 4],
    riskFraction: [0.005, 0.01, 0.02, 0.04][n % 4], allocation: [0.25, 0.5, 1][Math.floor(n / 4) % 3],
    maxPositions: [1, 2, 4, 8][Math.floor(n / 2) % 4], universe: ["ALL", "CRYPTO", "EQUITY", "CORE"][Math.floor(n / 6) % 4],
  }));
}
