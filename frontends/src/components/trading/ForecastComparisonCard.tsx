import type { ForecastPayload, UnifiedForecastPayload } from "@/hooks/useQuickTrade";

const direction = (value?: string | null) => value ? value.toUpperCase() : "UNAVAILABLE";

export function ForecastComparisonCard({ current, unified, agreement, selected, onSelect }: {
  current?: ForecastPayload | null;
  unified?: UnifiedForecastPayload | null;
  agreement?: string;
  botLabel?: string;
  selected: "current" | "unified";
  onSelect: (source: "current" | "unified") => void;
}) {
  return <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs uppercase tracking-wide text-slate-500">Forecast comparison</div><div className="text-sm text-slate-300">Selected: {selected === "current" ? "Current Forecast" : "Unified Forecast (Shadow)"}</div></div><div className="flex rounded-lg border border-slate-700 p-1 text-xs"><button className={`rounded px-2 py-1 ${selected === "current" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"}`} onClick={() => onSelect("current")}>Current Forecast</button><button className={`rounded px-2 py-1 ${selected === "unified" ? "bg-violet-500/20 text-violet-200" : "text-slate-400"}`} onClick={() => onSelect("unified")}>Unified Forecast</button></div></div>
    <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Current / Near-term</div><div className="text-lg font-bold text-slate-100">{direction(current?.bias)}</div><div className="text-xs text-slate-400">Engine confidence: {current?.confidence == null ? "Unknown" : `${current.confidence.toFixed(0)}%`}</div><div className="mt-2 text-xs text-slate-400">Range: {current?.expected_low ?? "—"} / {current?.expected_mid_price ?? "—"} / {current?.expected_high ?? "—"}</div><div className="text-xs text-slate-500">Horizon: {current?.horizon_seconds ? `${Math.round(current.horizon_seconds / 60)}m` : "Unknown"}</div></div><div className="rounded-xl border border-violet-500/20 p-3"><div className="text-xs text-violet-300">Unified Forecast · SHADOW</div><div className="text-lg font-bold text-slate-100">{direction(unified?.direction)}</div><div className="text-xs text-slate-400">Engine confidence: {unified?.confidence == null ? "Unknown" : `${unified.confidence.toFixed(0)}%`}</div><div className="mt-2 text-xs text-slate-400">Price range: Not available — direction-only forecast</div><div className="text-xs text-slate-500">Status: {unified?.status ?? "Unavailable"}</div></div></div>
    <div className={`text-xs ${agreement === "AGREE" ? "text-emerald-300" : agreement === "DISAGREE" ? "text-amber-300" : "text-slate-400"}`}>Agreement: {agreement ?? "UNAVAILABLE"} · UI decision support only; live execution source unchanged.</div>
  </div>;
}
