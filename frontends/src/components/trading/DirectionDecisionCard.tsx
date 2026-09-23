import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ForecastPayload, SignalPreview } from "@/hooks/useQuickTrade";

/**
 * Part A2 — the headline card that replaces the old single ambiguous verdict.
 *
 * It answers two DIFFERENT questions on two rows, and never blends them:
 *
 *   Direction (before fees)    where the model thinks price goes by expiry
 *   Trade decision (after fees) whether that move is worth trading
 *
 * Every number rendered here comes from the backend payload
 * (`forecast.direction`, `forecast.trade_decision`, `forecast.cost_model`) —
 * there are no hardcoded percentages in this file, by design (spec
 * constraint 5). When a value is absent it renders as "—", never as a
 * plausible-looking default.
 */

const TONE = {
  BUY: {
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/8",
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    bar: "bg-emerald-400",
  },
  SELL: {
    text: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-rose-500/8",
    chip: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    bar: "bg-rose-400",
  },
  WAIT: {
    text: "text-amber-300",
    border: "border-amber-500/30",
    bg: "bg-amber-500/6",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bar: "bg-amber-400",
  },
  NEUTRAL: {
    text: "text-slate-300",
    border: "border-slate-800",
    bg: "bg-slate-950/60",
    chip: "border-slate-600 bg-slate-800 text-slate-300",
    bar: "bg-slate-500",
  },
} as const;

type ToneKey = keyof typeof TONE;

function toneFor(value?: string | null): (typeof TONE)[ToneKey] {
  if (value === "BUY" || value === "SELL" || value === "WAIT" || value === "NEUTRAL") return TONE[value];
  return TONE.NEUTRAL;
}

/** Plain-language reason for a gate, never the raw backend enum. */
const GATE_LABEL: Record<string, string> = {
  cost: "Expected move does not cover fees and slippage",
  low_volume: "Trading volume is unusually low right now",
  stale_data: "Price data is stale — waiting for a fresh quote",
  candle_gap: "The candle feed has a gap — waiting for it to catch up",
};

const DIRECTION_ARROW: Record<string, string> = { BUY: "↑", SELL: "↓", NEUTRAL: "→" };

function pct(value?: number | null, digits = 3): string {
  return value == null || Number.isNaN(value) ? "—" : `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(digits)}%`;
}

function timeOf(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString();
}

/** Ticks once a second so the "next decision in Ns" countdown is live.
 * Same local-display-clock pattern NearTermForecastCard already uses. */
function useSecondTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export interface DirectionDecisionCardProps {
  forecast?: ForecastPayload | null;
  /** The indicator vote (SignalPreviewService). Shown SMALL and BELOW, and
   * always labelled as a vote share — it is not a probability (finding F5). */
  signal?: SignalPreview | null;
  symbol?: string;
  timeframe?: string;
  isLoading?: boolean;
  isStalled?: boolean;
}

export function DirectionDecisionCard({
  forecast,
  signal,
  symbol,
  timeframe,
  isLoading,
  isStalled,
}: DirectionDecisionCardProps) {
  const now = useSecondTick();

  const direction = forecast?.direction;
  const decision = forecast?.trade_decision;
  // Fall back to the legacy fields so this card still renders correctly
  // against an older backend, rather than showing an empty shell.
  const directionValue = direction?.value ?? forecast?.bias ?? null;
  const decisionValue = decision?.value ?? forecast?.decision_trend ?? null;

  const directionTone = toneFor(directionValue);
  const decisionTone = toneFor(decisionValue);

  const expectedMovePct = direction?.expected_move_pct ?? forecast?.predicted_move_pct ?? null;
  const requiredMovePct = decision?.required_move_pct ?? forecast?.cost_model?.required_move_pct ?? null;
  const maxAchievablePct = decision?.max_achievable_move_pct ?? null;
  const costPct = decision?.cost_pct ?? forecast?.cost_model?.cost_pct ?? null;
  const gateReason = decision?.gate_reason ?? forecast?.gate_reason ?? null;

  // The bar shows how far the expected move gets towards the required move.
  // Purely a rendering of two backend numbers; no threshold is invented here.
  const progressPct =
    expectedMovePct != null && requiredMovePct != null && requiredMovePct > 0
      ? Math.min(100, (Math.abs(expectedMovePct) / requiredMovePct) * 100)
      : null;
  const ceilingPct =
    maxAchievablePct != null && requiredMovePct != null && requiredMovePct > 0
      ? Math.min(100, (maxAchievablePct / requiredMovePct) * 100)
      : null;

  const expiryTime = timeOf(forecast?.expiry_at);
  const closeTime = timeOf(forecast?.decision_candle_close_at ?? forecast?.candle_timing?.decision_candle_close_at);

  // "Next decision in Ns" — derived from the candle close the decision is
  // anchored to, counting down live rather than freezing at fetch time.
  const nextCloseSeconds = (() => {
    const anchor = forecast?.candle_timing?.decision_candle_close_at ?? forecast?.decision_candle_close_at;
    const tfSeconds = forecast?.candle_timing?.timeframe_seconds;
    if (!anchor || !tfSeconds) return null;
    const nextMs = new Date(anchor).getTime() + tfSeconds * 1000;
    if (Number.isNaN(nextMs)) return null;
    return Math.max(0, Math.round((nextMs - now) / 1000));
  })();

  const formingBarExcluded = forecast?.input_candles_include_forming_bar === false;
  const showStalled = isStalled && !forecast;
  const showComputing = isLoading && !forecast && !showStalled;

  // Indicator vote (F5): a VOTE SHARE, not a probability. Rendered small,
  // below, and always with that wording.
  const voteDirection = (signal?.direction ?? "neutral").toUpperCase();
  const voteTone = toneFor(voteDirection === "NEUTRAL" ? "NEUTRAL" : voteDirection);
  const voteShare = signal?.confidence ?? null;
  const voteDisagrees =
    directionValue != null && voteDirection !== "NEUTRAL" && voteDirection !== directionValue;

  return (
    <div className={cn("rounded-[24px] border p-5 transition-all duration-500", decisionTone.border, decisionTone.bg)}>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-widest text-slate-500">
          {symbol ?? "—"} · Chart {forecast?.context_timeframe ?? timeframe ?? "—"} · Expiry{" "}
          {forecast?.horizon_seconds ? `${Math.round(forecast.horizon_seconds / 60)}m` : "—"}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {formingBarExcluded && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
              CLOSED CANDLES ONLY
            </span>
          )}
          {forecast?.decision_cache?.status === "reused" && (
            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">
              CACHED THIS CANDLE
            </span>
          )}
          {forecast?.cost_model?.fee_model === "maker_entry" && (
            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-violet-200">
              MAKER-ENTRY MODEL (SHADOW)
            </span>
          )}
        </div>
      </div>

      {showComputing && (
        <div className="mt-3 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-200">
          Computing the live decision for this selection… this is not a WAIT verdict yet, the first read is still in
          flight.
        </div>
      )}
      {showStalled && (
        <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          The decision engine did not respond in time — this is NOT a confirmed WAIT signal, it is a stalled read.
          Retrying automatically.
        </div>
      )}

      {/* ── Row 1: DIRECTION (before fees) ── */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-800/70 pb-4">
        <div className="min-w-[210px]">
          <div className="text-xs uppercase tracking-wider text-slate-500">Direction — before fees</div>
          <div className={cn("text-3xl font-black sm:text-4xl", directionTone.text)}>
            {directionValue ? `${DIRECTION_ARROW[directionValue] ?? ""} ${directionValue}` : "—"}
          </div>
        </div>
        <div className="text-sm text-slate-300">
          Model expects{" "}
          <span className={cn("font-semibold", directionTone.text)}>
            {expectedMovePct != null && expectedMovePct >= 0 ? "+" : ""}
            {pct(expectedMovePct)}
          </span>{" "}
          by <span className="font-semibold text-slate-200">{expiryTime}</span>
          {direction?.expiry_score != null && (
            <span className="text-slate-500"> · score {direction.expiry_score.toFixed(2)}</span>
          )}
        </div>
        <div className="ml-auto text-[11px] uppercase tracking-wider text-slate-600">Costs ignored</div>
      </div>

      {/* ── Row 2: TRADE DECISION (after fees) ── */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-4">
        <div className="min-w-[210px]">
          <div className="text-xs uppercase tracking-wider text-slate-500">Trade decision — after fees</div>
          <div className={cn("text-3xl font-black sm:text-4xl", decisionTone.text)}>{decisionValue ?? "—"}</div>
        </div>
        <div className="text-sm text-slate-300">
          {decisionValue === "WAIT" ? (
            <>
              Needs <span className="font-semibold text-amber-200">{pct(requiredMovePct)}</span>, max possible now{" "}
              <span className="font-semibold text-amber-200">{pct(maxAchievablePct)}</span>
            </>
          ) : (
            <>
              Clears the <span className="font-semibold text-slate-200">{pct(requiredMovePct)}</span> needed after{" "}
              <span className="font-semibold text-slate-200">{pct(costPct)}</span> round-trip cost
            </>
          )}
        </div>
        <div className="ml-auto text-[11px] uppercase tracking-wider text-slate-600">Fee-aware</div>
      </div>

      {/* ── The numeric reason, always shown for a WAIT ── */}
      {progressPct != null && (
        <div className="mt-3">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            {ceilingPct != null && (
              <div
                className="absolute inset-y-0 left-0 bg-slate-700"
                style={{ width: `${ceilingPct}%` }}
                title="The most this chart/expiry could move at current volatility"
              />
            )}
            <div
              className={cn("absolute inset-y-0 left-0", decisionTone.bar)}
              style={{ width: `${progressPct}%` }}
            />
            <div className="absolute inset-y-0 right-0 w-px bg-slate-400" title="Required move after fees" />
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-[11px] text-slate-500">
            <span>
              Expected <span className="text-slate-300">{pct(expectedMovePct)}</span>
            </span>
            <span>
              Max possible <span className="text-slate-300">{pct(maxAchievablePct)}</span>
            </span>
            <span>
              Required <span className="text-slate-300">{pct(requiredMovePct)}</span>
            </span>
          </div>
        </div>
      )}

      {gateReason && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <span className="font-semibold uppercase tracking-wide">Gate: {gateReason.replace(/_/g, " ")}</span>
          {" — "}
          {GATE_LABEL[gateReason] ?? "A data-quality safety gate is active."}
        </div>
      )}

      {/* ── Candle timing (Part B) ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          Based on candle closed at <span className="text-slate-300">{closeTime}</span>
        </span>
        {forecast?.seconds_since_last_close != null && (
          <span>
            <span className="text-slate-300">{forecast.seconds_since_last_close.toFixed(0)}s</span> since that close
          </span>
        )}
        {nextCloseSeconds != null && (
          <span>
            Next decision in <span className="text-slate-300">{nextCloseSeconds}s</span>
          </span>
        )}
        {forecast?.candle_timing?.timestamps_available === false && (
          <span className="text-amber-400">Candle close times unavailable — forming bar could not be excluded</span>
        )}
      </div>

      {/* ── Indicator vote: small, below, never a bare percentage ── */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800/70 pt-3">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Indicator vote</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", voteTone.chip)}>
          {voteDirection}
        </span>
        <span className="text-[11px] text-slate-400">
          vote share {voteShare == null ? "—" : `${Math.round(voteShare)}%`}
        </span>
        <span
          className="text-[11px] text-slate-600"
          title="This is the share of indicator votes that agreed, not a measured probability that the prediction is right."
        >
          (uncalibrated score, not a probability)
        </span>
        {signal && (
          <span className="text-[11px] text-slate-600">
            ▲ {signal.bullish_score} · {signal.neutral_score} neutral · ▼ {signal.bearish_score}
          </span>
        )}
        {voteDisagrees && (
          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
            disagrees with direction
          </span>
        )}
      </div>
    </div>
  );
}
