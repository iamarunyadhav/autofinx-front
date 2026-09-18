import type { ForecastPayload } from "@/hooks/useQuickTrade";

export function forecastTone(bias?: string): string {
  return bias === "BUY" ? "text-emerald-300" : bias === "SELL" ? "text-rose-300" : "text-slate-300";
}

export function NearTermForecastCard({ forecast }: { forecast?: ForecastPayload | null }) {
  const bias = forecast?.bias ?? "NEUTRAL";
  const tone = forecastTone(bias);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Near-term forecast</div>
          <div className={`text-lg font-bold ${tone}`}>{bias}</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 text-left sm:w-auto sm:text-right md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Confidence</div>
            <div className="text-sm font-semibold text-slate-200">{forecast?.confidence?.toFixed(0) ?? "-"}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Expected</div>
            <div className="text-sm font-semibold text-slate-200 break-all">{forecast?.expected_mid_price ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Range low</div>
            <div className="text-sm font-semibold text-rose-200 break-all">{forecast?.expected_low ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Range high</div>
            <div className="text-sm font-semibold text-emerald-200 break-all">{forecast?.expected_high ?? "-"}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-slate-400">
        {forecast?.summary ?? "Forecast waits for fresh candle and decision data."}
        {forecast?.horizon_seconds ? ` Trade forecast horizon ${Math.round(forecast.horizon_seconds / 60)}m; chart context ${forecast.context_timeframe ?? "unknown"}; ATR ${forecast.atr_pct?.toFixed(3)}%.` : ""}
        {forecast?.resolution_warning && <span className="block mt-1 text-amber-300">{forecast.resolution_warning}</span>}
      </div>
    </div>
  );
}
