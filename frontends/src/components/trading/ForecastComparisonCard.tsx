import type { ForecastPayload, UnifiedForecastPayload, ForecastComparisonPayload } from "@/hooks/useQuickTrade";

const direction = (value?: string | null) => value ? value.toUpperCase() : "UNAVAILABLE";

export function ForecastComparisonCard({ current, unified, helpers, agreement, selected, onSelect }: {
  helpers?: ForecastComparisonPayload["helpers"];
  current?: ForecastPayload | null;
  unified?: UnifiedForecastPayload | null;
  agreement?: string;
  botLabel?: string;
  selected: "current" | "unified";
  onSelect: (source: "current" | "unified") => void;
}) {
  return <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs uppercase tracking-wide text-slate-500">Forecast comparison</div><div className="text-sm text-slate-300">Selected: {selected === "current" ? "Current Forecast" : "Unified Forecast (Shadow)"}</div></div><div className="flex rounded-lg border border-slate-700 p-1 text-xs"><button className={`rounded px-2 py-1 ${selected === "current" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"}`} onClick={() => onSelect("current")}>Current Forecast</button><button className={`rounded px-2 py-1 ${selected === "unified" ? "bg-violet-500/20 text-violet-200" : "text-slate-400"}`} onClick={() => onSelect("unified")}>Unified Forecast</button></div></div>
    <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Current / Near-term</div><div className="text-lg font-bold text-slate-100">{direction(current?.bias)}</div><div className="text-xs text-slate-400">Engine confidence: {current?.confidence == null ? "Unknown" : `${current.confidence.toFixed(0)}%`}</div><div className="mt-2 text-xs text-slate-400">Range: {current?.expected_low ?? "—"} / {current?.expected_mid_price ?? "—"} / {current?.expected_high ?? "—"}</div><div className="text-xs text-slate-500">Horizon: {current?.horizon_seconds ? `${Math.round(current.horizon_seconds / 60)}m` : "Unknown"}</div></div><div className="rounded-xl border border-violet-500/20 p-3"><div className="text-xs text-violet-300">Unified Forecast · SHADOW</div><div className="text-lg font-bold text-slate-100">{direction(unified?.direction)}</div><div className="text-xs text-slate-400">Engine confidence: {unified?.confidence == null ? "Unknown" : `${unified.confidence.toFixed(0)}%`}</div><div className="text-xs text-slate-400">Observed accuracy: {unified?.calibrated && unified.calibration_evidence?.hit_rate_pct != null ? `${unified.calibration_evidence.hit_rate_pct.toFixed(2)}% (${unified.calibration_evidence.sample_size ?? 0} samples)` : "Not enough evaluated samples"}</div><div className="mt-2 text-xs text-slate-400">Price range: Not available — direction-only forecast</div><div className="text-xs text-slate-500">Status: {unified?.status ?? "Unavailable"}</div></div></div>
    <div className={`text-xs ${agreement === "AGREE" ? "text-emerald-300" : agreement === "DISAGREE" ? "text-amber-300" : "text-slate-400"}`}>Agreement: {agreement ?? "UNAVAILABLE"} · UI decision support only; live execution source unchanged.</div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-cyan-500/20 p-3">
        <div className="text-xs text-cyan-300">MarketAnalysisEngine · Trend analysis</div>
        <div className="text-lg font-bold text-slate-100">{helpers ? direction(helpers.analysis.trendDirection) : "UNAVAILABLE"}</div>
        {helpers && <>
          <p className="text-xs text-slate-400">Composite: {helpers.analysis.trendCompositeScore.toFixed(3)} · Direction threshold: ±{helpers.analysis.minComposite}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-400">{helpers.analysis.windowBreakdown.map((window) => <div key={window.key}>{window.key}: {window.direction} · score {window.score.toFixed(3)} · {window.sample_size} candles · weight {(window.weight * 100).toFixed(0)}%</div>)}</div>
          {helpers.analysis.windowBreakdown.some((window) => window.sample_size < 8) && <p className="mt-2 text-xs text-amber-300">Insufficient candle history in one or more windows.</p>}
        </>}
        <p className="mt-2 text-xs text-slate-500">Short / medium / long lookbacks on the selected timeframe. Composite is a trend score, not accuracy.</p>
      </div>
      <div className="rounded-xl border border-amber-500/20 p-3">
        <div className="text-xs text-amber-300">ConfidenceEngine · Reliability weighting</div>
        <div className="text-lg font-bold text-slate-100">{helpers ? `Favors ${helpers.confidence.favoredDirection ?? "neither"}` : "UNAVAILABLE"}</div>
        {helpers && <>
          <p className="text-xs text-slate-400">Trend contribution: {helpers.confidence.trendContribution.toFixed(3)} · Forecast contribution: {helpers.confidence.forecastContribution.toFixed(3)}</p>
          <p className="text-xs text-slate-400">Forecast weight: {(helpers.confidence.forecastWeight * 100).toFixed(0)}%</p>
          <p className="mt-2 text-xs text-slate-400">{helpers.calibrated && helpers.confidence.hitRatePct != null ? `Unified calibration: ${helpers.confidence.hitRatePct.toFixed(2)}% hit rate · ${helpers.confidence.sampleSize} samples` : "Insufficient calibration evidence; forecast weight remains zero."}</p>
        </>}
        <p className="mt-2 text-xs text-slate-500">This helper weighs trend versus forecast evidence. It does not produce a separate BUY/SELL prediction or its own accuracy record.</p>
      </div>
    </div>
    <p className="text-xs text-slate-500">Compare direction, window disagreement and evaluated accuracy before judging an engine. Live quotes are display data; analysis uses candle history.</p>
  </div>;
}
