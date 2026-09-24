import { useEffect, useState } from "react";
import type { ForecastCalculationMeta, ForecastPayload } from "@/hooks/useQuickTrade";
import { DECISION_BADGE_CLASS, QUEUE_WAIT_AMBER_MS, decisionBadgeTone } from "@/lib/decisionBadge";

export function forecastTone(bias?: string): string {
  return bias === "BUY" ? "text-emerald-300" : bias === "SELL" ? "text-rose-300" : "text-slate-300";
}

/** Plain-language reason shown when a WAIT decision came from a new context safety gate,
 * rather than exposing the raw backend enum string to the user. */
function gateReasonMessage(reason?: ForecastPayload["gate_reason"]): string | null {
  if (reason === "low_volume") return "Waiting — trading volume is unusually low right now.";
  if (reason === "stale_data") return "Waiting — price data is stale; holding off until a fresh quote arrives.";
  return null;
}

const CAUTION_LABEL: Record<string, string> = {
  near_resistance: "Approaching resistance",
  near_support: "Approaching support",
};

/** Ticks once a second purely to re-render the "decision computed Ns ago"
 * badge below -- mirrors the same pattern `usePredictionClock()` already
 * uses in useQuickTrade.ts for prediction-expiry checks. Local to this
 * component since it's a display concern, not a data-fetching one. */
function useClockTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export interface NearTermForecastCardProps {
  forecast?: ForecastPayload | null;
  symbol?: string;
  /** Additive worker-latency telemetry (queue_wait_ms/compute_ms), from the
   * same async forecast job that produced `forecast` -- see
   * `App\Jobs\CalculateTradeForecast::handle()`. Optional: callers that
   * don't have it (e.g. Robot Trade's own forecast source) simply don't
   * get the latency breakdown tooltip, the rest of the card is unaffected. */
  calculation?: ForecastCalculationMeta | null;
  /** True while a forecast request is in flight (initial load, or a
   * refetch after the previous verdict's ~20s validity window expired)
   * AND no current `forecast` is available yet -- distinct from a genuine
   * WAIT decision so a slow/backlogged worker doesn't silently look like
   * an ordinary "wait" verdict. Pass `query.isLoading || query.isFetching`
   * from the caller's `useQuickTradeForecast()` result. */
  isLoading?: boolean;
  /** True when the async forecast worker did not respond in time (see
   * `backgroundForecast()`'s bounded retry loop in useQuickTrade.ts) --
   * again distinct from a genuine WAIT decision. */
  isStalled?: boolean;
}

export function NearTermForecastCard({ forecast, symbol, calculation, isLoading, isStalled }: NearTermForecastCardProps) {
  const now = useClockTick();
  const current = forecast?.current_trend ?? forecast?.bias ?? "NEUTRAL";
  const decision = forecast?.decision_trend ?? forecast?.bias ?? "WAIT";
  const tone = forecastTone(decision);
  const formatPrice = (value?: number | null) => value == null ? "-" : value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  // Both values originate from the forecast response. In particular, the
  // reference is the backend's accepted quote, never a browser-only price.
  const referencePrice = forecast?.reference_price ?? forecast?.current_price;
  const predictedPrice = forecast?.predicted_expiry_price ?? forecast?.expected_mid_price;
  const expectedDelta = referencePrice != null && predictedPrice != null
    ? predictedPrice - referencePrice
    : forecast?.predicted_move;
  const expectedDeltaPct = referencePrice != null && referencePrice > 0 && expectedDelta != null
    ? (expectedDelta / referencePrice) * 100
    : forecast?.predicted_move_pct;
  const deltaTone = expectedDelta == null || expectedDelta === 0
    ? "text-slate-300"
    : expectedDelta > 0 ? "text-emerald-300" : "text-rose-300";
  const context = forecast?.market_context;
  const gateMessage = gateReasonMessage(forecast?.gate_reason);
  const cautions = forecast?.context_caution ?? [];

  // How long ago THIS decision_trend/BUY-SELL-WAIT verdict was computed --
  // distinct from `live_feed.age_seconds` above, which is the age of the
  // input quote, not the age of the decision itself. `forecast.generated_at`
  // is set once per forecast() call (TradeForecastService::forecast()), so
  // this genuinely reflects "how stale is the verdict on screen right now",
  // ticking live via useClockTick() rather than freezing at fetch time.
  const decisionAgeMs = forecast?.generated_at ? Math.max(0, now - new Date(forecast.generated_at).getTime()) : null;
  const decisionAgeSeconds = decisionAgeMs != null ? decisionAgeMs / 1000 : null;
  // A flat "stale past 8s" cutoff is misleading once expiries range from 1
  // minute to 60+ minutes: 15s is nothing next to an hour-long decision but
  // looks alarmingly stale next to a 1-minute one. Scale the cutoff to the
  // chart timeframe instead (10% of it), with the old 8s kept as a floor so
  // short-timeframe behaviour is unchanged.
  const decisionStaleThresholdSeconds = forecast?.context_timeframe_seconds
    ? Math.max(8, forecast.context_timeframe_seconds * 0.1)
    : 8;
  // N1 red tier: the async worker's own validity window for this result
  // (valid_until - requested_at, 20s today). Only known when `calculation`
  // is supplied (Quick Trade); Ratio Bot / Robot Trade keep the two-tier badge.
  const validitySeconds = calculation && calculation.valid_until > calculation.requested_at
    ? calculation.valid_until - calculation.requested_at
    : null;
  // N1 second half (B2 is live): the Quick Trade decision is cached per CLOSED
  // candle, so `generated_at` is the moment that candle's decision was first
  // computed and legitimately ages for a whole candle. There the honest
  // statement is which close the decision is based on and when the next one
  // lands; the colour then judges how old the RESULT on screen is (fetched
  // from the worker), not how old the cached candle decision is.
  const anchorCloseIso = forecast?.candle_timing?.decision_candle_close_at ?? forecast?.decision_candle_close_at ?? null;
  const anchorCloseMs = anchorCloseIso ? new Date(anchorCloseIso).getTime() : NaN;
  const timeframeSeconds = forecast?.candle_timing?.timeframe_seconds ?? forecast?.context_timeframe_seconds ?? null;
  const closeAnchored = Number.isFinite(anchorCloseMs) && timeframeSeconds != null && timeframeSeconds > 0;
  const nextUpdateSeconds = closeAnchored
    ? Math.max(0, Math.round((anchorCloseMs + (timeframeSeconds as number) * 1000 - now) / 1000))
    : null;
  const resultAgeSeconds = calculation?.generated_at
    ? Math.max(0, (now - calculation.generated_at * 1000) / 1000)
    : null;
  const badgeAgeSeconds = closeAnchored ? (resultAgeSeconds ?? decisionAgeSeconds) : decisionAgeSeconds;
  const badgeTone = badgeAgeSeconds != null
    ? decisionBadgeTone({
      ageSeconds: badgeAgeSeconds,
      thresholdSeconds: decisionStaleThresholdSeconds,
      validitySeconds,
      queueWaitMs: calculation?.queue_wait_ms ?? null,
    })
    : null;
  const latencyTitle = calculation
    ? `Worker queue wait ${calculation.queue_wait_ms}ms + compute ${calculation.compute_ms}ms for this verdict. Stale past ${decisionStaleThresholdSeconds.toFixed(0)}s (10% of the ${forecast?.context_timeframe ?? "chart"} timeframe)${validitySeconds != null ? `; expired past ${validitySeconds}s` : ""}; queue wait over ${QUEUE_WAIT_AMBER_MS}ms is flagged as worker latency.${resultAgeSeconds != null ? ` Result fetched ${resultAgeSeconds.toFixed(1)}s ago.` : ""}`
    : undefined;
  const showStalled = isStalled && !forecast;
  const showComputing = isLoading && !forecast && !showStalled;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      {symbol && <div className="mb-2 text-xs text-slate-400">{symbol} · Chart: {forecast?.context_timeframe ?? "loading"} · Expiry: {forecast?.horizon_seconds ?? "—"}s</div>}
      {showComputing && (
        <div className="mb-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-200">
          Computing the live decision for this selection… this is not a WAIT verdict yet, the first read is still in flight.
        </div>
      )}
      {showStalled && (
        <div className="mb-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          The decision engine did not respond in time (worker backlog or offline) — this is NOT a confirmed WAIT signal, it is a stalled read. Retrying automatically.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[180px]">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current Trend</div>
          <div className={`text-lg font-bold ${forecastTone(current)}`}>{current}</div>
          <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">
            {forecast?.horizon_seconds ? `${Math.round(forecast.horizon_seconds / 60)}m` : "Expiry"} Decision Trend
          </div>
          <div className={`text-2xl font-black ${tone}`}>{decision}</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 text-left sm:w-auto sm:text-right md:grid-cols-5">
          <div>
            <div className="text-xs text-slate-500" title="Model score, not a measured probability of a correct prediction">Model confidence</div>
            <div className="text-sm font-semibold text-slate-200">{forecast?.confidence?.toFixed(0) ?? "-"}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Reference</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(referencePrice)}</div>
            {forecast?.reference_price_source && <div className="text-[10px] text-slate-500">{forecast.reference_price_source === "fresh_canonical_quote" ? "Fresh server quote" : "Latest candle close"}</div>}
          </div>
          <div>
            <div className="text-xs text-slate-500">Predicted expiry</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(predictedPrice)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Expected change</div>
            <div className={`text-sm font-semibold break-all ${deltaTone}`}>
              {expectedDelta == null ? "-" : `${expectedDelta >= 0 ? "+" : ""}${formatPrice(expectedDelta)}`}
            </div>
            <div className={`text-[11px] ${deltaTone}`}>
              {expectedDeltaPct == null ? "" : `${expectedDeltaPct >= 0 ? "+" : ""}${expectedDeltaPct.toFixed(3)}%`}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Expected range</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(forecast?.predicted_low ?? forecast?.expected_low)} – {formatPrice(forecast?.predicted_high ?? forecast?.expected_high)}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 ${forecast?.reference_price_source === "fresh_canonical_quote"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
          {forecast?.reference_price_source === "fresh_canonical_quote" ? "LIVE SERVER QUOTE" : "CANDLE-CLOSE REFERENCE"}
        </span>
        {forecast?.live_feed && (
          <span className={`rounded-full border px-2 py-0.5 ${forecast.live_feed.fresh
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>
            {forecast.live_feed.fresh
              ? `QUOTE ${forecast.live_feed.age_seconds ?? "?"}s · LAG ${forecast.live_feed.event_lag_ms ?? "?"}ms`
              : "QUOTE STALE"}
          </span>
        )}
        {badgeTone != null && closeAnchored && (
          <span title={latencyTitle} className={`rounded-full border px-2 py-0.5 ${DECISION_BADGE_CLASS[badgeTone]}`}>
            Based on {new Date(anchorCloseMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} candle close · next update in {nextUpdateSeconds}s
          </span>
        )}
        {badgeTone != null && !closeAnchored && decisionAgeSeconds != null && (
          <span title={latencyTitle} className={`rounded-full border px-2 py-0.5 ${DECISION_BADGE_CLASS[badgeTone]}`}>
            DECISION {decisionAgeSeconds.toFixed(1)}s old
          </span>
        )}
        {forecast?.forecast_stability && forecast.forecast_stability !== "UNKNOWN" && (
          <span className={`rounded-full border px-2 py-0.5 ${forecast.forecast_stability === "HIGH"
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : forecast.forecast_stability === "LOW"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : "border-slate-600 bg-slate-800 text-slate-300"}`}>
            STABILITY {forecast.forecast_stability}
          </span>
        )}
        {forecast?.gate_reason && (
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-rose-200">SAFETY WAIT</span>
        )}
      </div>
      {context && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800/80 pt-2 text-xs text-slate-400">
          {context.volume_status && context.volume_status !== "unknown" && (
            <span>
              Volume: <span className={
                context.volume_status === "contracting" ? "text-amber-300" :
                context.volume_status === "expanding" ? "text-emerald-300" : "text-slate-300"
              }>{context.volume_status}</span>
            </span>
          )}
          {context.support != null && (
            <span>Support: <span className="text-slate-300">{formatPrice(context.support)}</span></span>
          )}
          {context.resistance != null && (
            <span>Resistance: <span className="text-slate-300">{formatPrice(context.resistance)}</span></span>
          )}
        </div>
      )}
      {cautions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {cautions.map((c) => (
            <span key={c} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              {CAUTION_LABEL[c] ?? c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs leading-relaxed text-slate-400">
        {gateMessage ?? forecast?.summary ?? "Forecast waits for fresh candle and decision data."}
        {forecast?.horizon_seconds ? ` Target ${forecast.expiry_at ? new Date(forecast.expiry_at).toLocaleTimeString() : "-"}; chart context ${forecast.context_timeframe ?? "unknown"}; ${forecast.analysis_window?.candles_used ?? "-"} candles; ATR ${forecast.atr_pct?.toFixed(3)}%.` : ""}
        {forecast?.resolution_warning && <span className="block mt-1 text-amber-300">{forecast.resolution_warning}</span>}
      </div>
      {forecast?.forecast_stability && forecast.forecast_stability !== "UNKNOWN" && (
        <div className={`mt-2 text-xs ${forecast.forecast_stability === "LOW" ? "text-amber-300" : "text-slate-400"}`}>
          Signal stability: {forecast.forecast_stability.toLowerCase()}
          {forecast.forecast_stability_flips != null ? ` (${forecast.forecast_stability_flips} recent flips)` : ""}.
        </div>
      )}
    </div>
  );
}
