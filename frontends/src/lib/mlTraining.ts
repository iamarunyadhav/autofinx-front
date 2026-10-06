import type { MlErrorCode, MlRunPhase, MlRunStatus, MlRunSummary } from "@/types/mlTraining";

/*
 * Shared helpers for the ML Training dashboard: formatting, the plain-language
 * glossary for promotion-policy reason codes, and the "effective" run state
 * (a RUNNING run with a dead heartbeat is shown STALLED before the server's
 * reaper catches up).
 */

/** Used until GET /system tells us the real `training.stall_seconds`. */
export const DEFAULT_STALL_SECONDS = 180;

/** Horizons the pipeline trains, used only when the overview has not listed any. */
export const ML_FALLBACK_HORIZONS = [15, 60, 120, 240, 1440];

export const mlHorizonLabel = (m: number | null | undefined) =>
  m == null ? "—" : m >= 1440 ? `${m / 1440}d` : m >= 60 ? `${m / 60}h` : `${m}m`;

export const mlCoin = (symbol: string | null | undefined) => (symbol ? symbol.replace(/USDT$/, "") : "—");

export const mlWords = (v?: string | null) => (v ? v.replaceAll("_", " ") : "—");

export const mlNumber = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });

/** 95 -> "1m 35s", 7300 -> "2h 1m". Null stays a dash, never a fabricated 0. */
export function mlDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export function mlAgo(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return `${mlDuration((nowMs - t) / 1000)} ago`;
}

export function mlDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/** Seconds from now until `iso` (negative when already past); null when unparsable. */
export function mlSecondsUntil(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (t - nowMs) / 1000 : null;
}

export const ACTIVE_STATUSES: MlRunStatus[] = ["QUEUED", "RUNNING"];

export type MlRunTone = "neutral" | "running" | "good" | "bad" | "warn";

export interface MlEffectiveRun {
  /** What to show: the server status, or STALLED / REJECTED / CHAMPION derived from it. */
  label: "QUEUED" | "RUNNING" | "STALLED" | "CHAMPION" | "REJECTED" | "FINISHED" | "FAILED" | "STOPPED" | "INTERRUPTED";
  tone: MlRunTone;
  stalled: boolean;
  /** Locally advanced heartbeat age (server value + time since it was fetched). */
  heartbeatAge: number | null;
  /** Locally ticking elapsed seconds for an active run. */
  elapsed: number | null;
}

/**
 * Derive the displayed state from server fields only. `fetchedAtMs` is when the
 * data arrived, so ages keep ticking between polls instead of freezing.
 */
export function mlEffectiveRun(run: MlRunSummary, stallSeconds: number, nowMs: number, fetchedAtMs: number): MlEffectiveRun {
  const drift = Math.max(0, (nowMs - fetchedAtMs) / 1000);
  const active = run.status === "RUNNING";
  const heartbeatAge = active && run.heartbeat_age_seconds != null ? run.heartbeat_age_seconds + drift : run.heartbeat_age_seconds;
  const elapsed = run.status === "RUNNING" && run.elapsed_seconds != null ? run.elapsed_seconds + drift : run.elapsed_seconds;
  const stalled = active && heartbeatAge != null && heartbeatAge > stallSeconds;

  let label: MlEffectiveRun["label"] = run.status;
  let tone: MlRunTone = "neutral";
  if (stalled) {
    label = "STALLED";
    tone = "bad";
  } else if (run.status === "RUNNING") {
    tone = "running";
  } else if (run.status === "FINISHED") {
    if (run.outcome === "CHAMPION") { label = "CHAMPION"; tone = "good"; }
    else if (run.outcome === "REJECTED") { label = "REJECTED"; tone = "neutral"; }
    else tone = "good";
  } else if (run.status === "FAILED" || run.status === "INTERRUPTED") {
    tone = "bad";
  } else if (run.status === "STOPPED") {
    tone = "warn";
  }
  return { label, tone, stalled, heartbeatAge: heartbeatAge ?? null, elapsed: elapsed ?? null };
}

export const ML_TONE_CLASS: Record<MlRunTone, string> = {
  neutral: "border-slate-600/60 bg-slate-800/50 text-slate-300",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export const PHASES: MlRunPhase[] = ["queued", "exporting", "fitting", "evaluating", "promoting", "done"];

/*
 * Plain-language meaning of `outcome_reason` / `decision_reason` codes. Codes
 * come from App\Domain\Ml\Shadow\PromotionPolicy and ClassifierPromotionPolicy
 * plus the trainer's own failure reasons. A REJECTED model is a valid result,
 * so none of these read as an error. Unknown codes fall back to the raw code.
 */
const REASON_GLOSSARY: Record<string, string> = {
  first_champion_passed_absolute_checks: "First model for this coin and horizon; it passed every minimum check and is now the champion.",
  candidate_beats_champion_on_same_holdout: "The new model beat the current champion on the same unseen data, so it took over.",
  classifier_passed_fee_aware_gate: "Passed every check after fees, slippage and funding, so it became the champion.",
  classifier_beats_champion_fee_aware: "Beat the current champion after fees, so it took over.",
  insufficient_holdout_rows: "Not enough unseen test data to judge the model fairly.",
  insufficient_walk_forward_folds: "Not enough separate time windows to test it across different market conditions.",
  missing_forecast_metrics: "The test did not produce the numbers needed to judge the model.",
  mae_not_better_than_zero_return_baseline: "No better than simply guessing the price will not move.",
  fee_aware_net_negative_on_holdout: "Would have lost money on unseen data once fees are counted.",
  champion_not_comparable_on_same_holdout: "Cannot be compared with the current champion on the same test data, so the champion stays.",
  mae_not_better_than_champion: "Not more accurate than the current champion, so the champion stays.",
  fee_aware_net_worse_than_champion: "Earns less after fees than the current champion, so the champion stays.",
  holdout_net_not_positive_after_costs: "Fees would eat the edge: no profit left on unseen data after costs.",
  too_few_non_overlapping_trades: "Too few independent trades on the test data to trust the result.",
  average_net_per_trade_too_thin: "The average profit per trade is too thin to survive real-world costs.",
  edge_not_statistically_significant: "The edge could just be luck; it is not statistically convincing.",
  net_not_positive_across_folds: "Profitable in too few of the test windows; the edge is not consistent.",
  does_not_beat_always_buy: "A simple always-buy rule did as well or better.",
  does_not_beat_always_sell: "A simple always-sell rule did as well or better.",
  cancelled_by_operator: "Stopped by an operator before it finished.",
  interrupted: "The worker or host restarted while this was running.",
  timeout: "Ran past the time limit. The host may be overloaded.",
};

export function mlReasonText(code: string | null | undefined): string | null {
  if (!code) return null;
  return REASON_GLOSSARY[code] ?? code;
}

export const mlReasonKnown = (code: string | null | undefined) => Boolean(code && REASON_GLOSSARY[code]);

/** One-sentence verdict for a run, in plain words. */
export function mlVerdict(run: MlRunSummary, eff: MlEffectiveRun): { text: string; tone: MlRunTone } {
  if (eff.stalled) return { text: "No heartbeat for a while. The run looks stuck and will be marked interrupted automatically.", tone: "bad" };
  switch (run.status) {
    case "QUEUED": return { text: "Waiting in the queue. One model trains at a time.", tone: "neutral" };
    case "RUNNING": return { text: "Training in progress. Nothing is traded; this is shadow learning only.", tone: "running" };
    case "FINISHED":
      if (run.outcome === "CHAMPION") return { text: mlReasonText(run.outcome_reason) ?? "Became the champion model.", tone: "good" };
      if (run.outcome === "REJECTED") return { text: `Not promoted, which is a normal result. ${mlReasonText(run.outcome_reason) ?? ""}`.trim(), tone: "neutral" };
      return { text: "Finished.", tone: "good" };
    case "STOPPED": return { text: "Stopped by an operator.", tone: "warn" };
    case "INTERRUPTED": return { text: "The worker stopped heartbeating (restart or crash). It may be retried automatically.", tone: "bad" };
    case "FAILED": return { text: run.error_message ? `Failed: ${run.error_message}` : mlReasonText(run.error_code) ?? "Failed.", tone: "bad" };
    default: return { text: "", tone: "neutral" };
  }
}

/** 422 `code` -> plain sentence. */
const ERROR_CODE_TEXT: Record<MlErrorCode, string> = {
  ml_disabled: "ML shadow learning is switched off on the server.",
  already_active: "A run for this coin and horizon is already queued or running.",
  not_stoppable: "That run can no longer be stopped. It has probably just finished.",
  not_retryable: "That run cannot be retried (only failed, stopped or interrupted runs can).",
  unknown_symbol: "That coin is not one the ML pipeline collects.",
  unknown_horizon: "That horizon is not supported.",
};

export function mlErrorText(code: string | null | undefined, fallback: string): string {
  return (code && ERROR_CODE_TEXT[code as MlErrorCode]) || fallback;
}

export const ML_SHADOW_NOTE = "Shadow only: nothing on this page can place an order.";

/** Error from the ML Training API; `code` is the 422 `code` when the backend sent one. */
export class MlApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "MlApiError";
    this.status = status;
    this.code = code;
  }
}

/** Plain sentence for any error thrown by the ML Training API. */
export function mlErrorMessage(error: unknown): string {
  if (error instanceof MlApiError) return mlErrorText(error.code, error.message || "Request failed.");
  return error instanceof Error ? error.message : "Request failed.";
}
