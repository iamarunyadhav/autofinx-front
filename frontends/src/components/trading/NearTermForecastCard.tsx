import type { ForecastPayload } from "@/hooks/useQuickTrade";

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

export function NearTermForecastCard({ forecast, symbol }: { forecast?: ForecastPayload | null; symbol?: string }) {
  const current = forecast?.current_trend ?? forecast?.bias ?? "NEUTRAL";
  const decision = forecast?.decision_trend ?? forecast?.bias ?? "WAIT";
  const tone = forecastTone(decision);
  const formatPrice = (value?: number | null) => value == null ? "-" : value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  const context = forecast?.market_context;
  const gateMessage = gateReasonMessage(forecast?.gate_reason);
  const cautions = forecast?.context_caution ?? [];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      {symbol && <div className="mb-2 text-xs text-slate-400">{symbol} · Chart: {forecast?.context_timeframe ?? "loading"} · Expiry: {forecast?.horizon_seconds ?? "—"}s</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[180px]">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current Trend</div>
          <div className={`text-lg font-bold ${forecastTone(current)}`}>{current}</div>
          <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">
            {forecast?.horizon_seconds ? `${Math.round(forecast.horizon_seconds / 60)}m` : "Expiry"} Decision Trend
          </div>
          <div className={`text-2xl font-black ${tone}`}>{decision}</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 text-left sm:w-auto sm:text-right md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500" title="Model score, not a measured probability of a correct prediction">Model confidence</div>
            <div className="text-sm font-semibold text-slate-200">{forecast?.confidence?.toFixed(0) ?? "-"}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Reference</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(forecast?.reference_price ?? forecast?.current_price)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Predicted expiry</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(forecast?.predicted_expiry_price ?? forecast?.expected_mid_price)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Expected range</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{formatPrice(forecast?.predicted_low ?? forecast?.expected_low)} – {formatPrice(forecast?.predicted_high ?? forecast?.expected_high)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Move / confidence</div>
            <div className="text-sm font-semibold text-emerald-200 break-all">{forecast?.predicted_move_pct == null ? "-" : `${forecast.predicted_move_pct >= 0 ? "+" : ""}${forecast.predicted_move_pct.toFixed(3)}%`} · {forecast?.confidence?.toFixed(0) ?? "-"}%</div>
          </div>
        </div>
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
    </div>
  );
}
