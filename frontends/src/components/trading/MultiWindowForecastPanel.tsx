import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useMultiWindowForecast,
  useQuickTradeChart,
  type MultiWindowEntry,
  type MultiWindowLabel,
  type ForecastCandle,
} from "@/hooks/useQuickTrade";

/**
 * VNext Dynamic Decision Engine, Phase A item 4 -- 3-window (short/medium/
 * long) forecast comparison panel. Purely informational: an additional,
 * optional/collapsed-by-default card shown alongside the existing
 * single-window Direction/Trade Decision cards on Quick Trade -- it never
 * replaces them, never gates the BUY/SELL flow, and clicking nothing here
 * places or blocks a trade.
 *
 * Window definitions (label/timeframe/expiry) must match
 * `config/multi_window_forecast.php`'s `windows` list exactly -- the
 * backend is still the source of truth for what it actually computed (each
 * response entry echoes its own real `timeframe`/`expiry_seconds`), this
 * constant only decides which candle set to fetch/send for each label.
 */
const WINDOW_DEFINITIONS: Array<{ label: MultiWindowLabel; title: string; timeframe: string; description: string }> = [
  { label: "short", title: "Short (15m)", timeframe: "15m", description: "15 min chart · 15 min expiry" },
  { label: "medium", title: "Medium (1h)", timeframe: "1h", description: "1 hour chart · 1 hour expiry" },
  { label: "long", title: "Long (4h)", timeframe: "4h", description: "4 hour chart · 4 hour expiry" },
];

function closedCandles(candles: ForecastCandle[], timeframe: string): ForecastCandle[] {
  const seconds: Record<string, number> = { "15m": 900, "1h": 3600, "4h": 14400 };
  const interval = seconds[timeframe] ?? 900;
  const now = Date.now();
  return candles.filter((candle) => {
    if (!candle.timestamp) return false;
    const openMs = candle.timestamp < 1_000_000_000_000 ? candle.timestamp * 1000 : candle.timestamp;
    return openMs + interval * 1000 <= now;
  });
}

function decisionBadgeClass(value?: string | null): string {
  if (value === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (value === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (value === "WAIT") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-slate-800 text-slate-400 border-slate-700";
}

function WindowCard({ definition, entry }: {
  definition: (typeof WINDOW_DEFINITIONS)[number];
  entry?: MultiWindowEntry;
}) {
  const forecast = entry?.forecast;
  const direction = forecast?.direction?.value ?? forecast?.bias ?? null;
  const tradeDecision = forecast?.trade_decision?.value ?? forecast?.decision_trend ?? null;
  const confidence = forecast?.confidence;
  const gateReason = forecast?.trade_decision?.gate_reason ?? forecast?.gate_reason ?? null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{definition.title}</div>
        {entry?.status === "calculating" && (
          <span className="text-[11px] text-slate-500">Calculating…</span>
        )}
        {entry?.status === "unavailable" && (
          <span className="text-[11px] text-rose-400">Unavailable</span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500">{definition.description}</div>

      {entry?.status === "ready" && forecast ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Direction</span>
            <Badge variant="outline" className={cn("text-xs", decisionBadgeClass(direction))}>
              {direction ?? "UNKNOWN"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Trade decision</span>
            <Badge variant="outline" className={cn("text-xs", decisionBadgeClass(tradeDecision))}>
              {tradeDecision ?? "UNKNOWN"}
            </Badge>
          </div>
          <div className="text-[11px] text-slate-500">
            Confidence: {confidence == null ? "Unknown" : `${confidence.toFixed(0)}%`}
          </div>
          {gateReason && (
            <div className="text-[11px] text-amber-400">WAIT reason: {gateReason.replaceAll("_", " ")}</div>
          )}
          {forecast.summary && (
            <div className="text-[11px] text-slate-500">{forecast.summary}</div>
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-600">
          {entry?.status === "unavailable" ? (entry.error ?? "This window could not be computed.") : "Waiting for a fresh forecast…"}
        </div>
      )}
    </div>
  );
}

const PYTHON_TIMEFRAMES = [
  { value: "5m", label: "5 min", source: "5m", seconds: 300 },
  { value: "15m", label: "15 min", source: "15m", seconds: 900 },
  { value: "45m", label: "45 min (derived)", source: "15m", seconds: 2700 },
  { value: "1h", label: "1 hour", source: "1h", seconds: 3600 },
  { value: "4h", label: "4 hour", source: "4h", seconds: 14400 },
] as const;

type PythonTimeframe = (typeof PYTHON_TIMEFRAMES)[number]["value"];
type PythonPredictionResult = {
  available?: boolean;
  direction?: string | null;
  predicted_return_pct?: number | null;
  provider_version?: string | null;
  reason?: string | null;
  evidence?: {
    model_holdout_direction_accuracy_pct?: number | null;
    model_holdout_rows?: number | null;
    model_evaluation?: {
      walk_forward?: { fold_count?: number | null; trade_fold_count?: number | null; mean_direction_accuracy_pct?: number | null; mean_average_net_return_pct?: number | null };
      cost_assumptions?: { estimated_round_trip_cost_pct?: number | null; minimum_edge_bps?: number | null };
      expected_net_return_pct?: number | null;
    } | null;
  };
};

function derive45MinuteCandles(candles: ForecastCandle[]): ForecastCandle[] {
  const byTimestamp = new Map(closedCandles(candles, "15m").map((candle) => {
    const timestamp = candle.timestamp && candle.timestamp < 1_000_000_000_000 ? candle.timestamp * 1000 : candle.timestamp;
    return [timestamp ?? 0, candle] as const;
  }));
  const output: ForecastCandle[] = [];
  byTimestamp.forEach((first, openMs) => {
    if (!openMs || openMs % 2_700_000 !== 0) return;
    const bars = [first, byTimestamp.get(openMs + 900_000), byTimestamp.get(openMs + 1_800_000)];
    if (bars.some((bar) => !bar)) return;
    const complete = bars as ForecastCandle[];
    output.push({ timestamp: openMs, open: complete[0].open, high: Math.max(...complete.map((bar) => bar.high)), low: Math.min(...complete.map((bar) => bar.low)), close: complete[2].close, volume: complete.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) });
  });
  return output.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
}

function PythonShadowDecisionCard({ symbol, workspaceId, integrationId, mode }: { symbol: string; workspaceId?: string; integrationId?: string; mode?: "paper" | "live" }) {
  const [timeframe, setTimeframe] = useState<PythonTimeframe>("5m");
  const selected = PYTHON_TIMEFRAMES.find((option) => option.value === timeframe) ?? PYTHON_TIMEFRAMES[0];
  const chart = useQuickTradeChart({ workspaceId, symbol, timeframe: selected.source, chartType: "area", indicatorSet: [], mode, integrationId });
  const candles = useMemo(() => timeframe === "45m" ? derive45MinuteCandles(chart.data?.candles ?? []) : closedCandles(chart.data?.candles ?? [], timeframe), [chart.data?.candles, timeframe]);
  const lastTimestamp = candles.at(-1)?.timestamp ?? null;
  const query = useQuery({
    queryKey: ["python-shadow-decision", symbol, timeframe, lastTimestamp],
    queryFn: () => authorizedFetch("/quick-trade/prediction-observatory", "POST", { symbol, market_type: "crypto", timeframe, horizon_seconds: selected.seconds, current_quote: candles.at(-1)?.close, candles, workspace_id: workspaceId, integration_id: integrationId }) as Promise<{ providers?: Record<string, { result?: PythonPredictionResult }> }>,
    enabled: Boolean(symbol) && candles.length >= 20,
    // Re-query only when the immutable last closed candle changes. This avoids
    // duplicate prediction-observation records for one model input.
    staleTime: Infinity,
    retry: false,
  });
  const datasets = useQuery({
    queryKey: ["prediction-fresh-datasets", workspaceId],
    queryFn: () => authorizedFetch("/quick-trade/prediction-fresh-datasets", "GET", undefined, { params: { workspace_id: workspaceId } }) as Promise<FreshDatasetDashboard>,
    enabled: !!workspaceId,
    staleTime: 30000,
  });
  const liveAccuracy = useQuery({
    queryKey: ["python-shadow-live-accuracy", workspaceId, symbol, timeframe],
    queryFn: () => authorizedFetch("/quick-trade/prediction-accuracy-report", "POST", { workspace_id: workspaceId, symbol, timeframe, provider: "external_ml" }) as Promise<{ groups?: Array<{ provider: string; provider_version?: string; timeframe: string; direction_accuracy_pct?: number | null; samples: number; shadow_health?: { status?: string; reason?: string }; non_overlapping?: { samples?: number; direction_accuracy_pct?: number | null } }> }>,
    enabled: !!workspaceId,
    staleTime: 30000,
  });
  const result = query.data?.providers?.external_ml?.result;
  const registered = new Set((datasets.data?.registry ?? []).filter((entry) => entry.status === "SHADOW_ONLY").map((entry) => entry.candidate_id));
  const candidate = (datasets.data?.candidates ?? []).find((entry) => entry.symbol === symbol.toUpperCase() && entry.timeframe === timeframe && registered.has(entry.id));
  const accuracy = result?.evidence?.model_holdout_direction_accuracy_pct ?? candidate?.metrics?.metrics?.direction_accuracy_pct;
  const holdoutRows = result?.evidence?.model_holdout_rows ?? candidate?.metrics?.holdout_rows;
  const evaluation = result?.evidence?.model_evaluation;
  const walkForward = evaluation?.walk_forward;
  const costs = evaluation?.cost_assumptions;
  const observed = (liveAccuracy.data?.groups ?? []).find((group) => group.provider === "external_ml" && group.timeframe === timeframe && group.provider_version === result?.provider_version);
  const latestCloseMs = lastTimestamp == null ? null : (lastTimestamp < 1_000_000_000_000 ? lastTimestamp * 1000 : lastTimestamp) + selected.seconds * 1000;
  const staleInput = latestCloseMs != null && Date.now() - latestCloseMs > selected.seconds * 2000;

  return <div className="mt-4 rounded-xl border border-violet-900/60 bg-violet-950/10 p-3">
    {staleInput && <div className="mb-3 rounded-md border border-amber-900/70 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-300">WAIT: latest closed candle is stale. Refresh market data before using this model.</div>}
    {result?.available && result.reason && <div className="mb-3 rounded-md border border-amber-900/70 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-300">WAIT reason: {result.reason.replace(/_/g, " ")}</div>}
    {result?.available && <div className="mb-3 grid gap-2 rounded-md border border-violet-900/50 bg-slate-950/40 p-2 text-[11px] text-slate-400 md:grid-cols-3">
      <span>Walk-forward: {walkForward?.mean_direction_accuracy_pct == null ? "not recorded" : `${walkForward.mean_direction_accuracy_pct.toFixed(1)}%`}</span>
      <span>Trade-valid folds: {walkForward?.trade_fold_count ?? 0}/{walkForward?.fold_count ?? 0}</span>
      <span>Estimated cost: {costs?.estimated_round_trip_cost_pct == null ? "not recorded" : `${costs.estimated_round_trip_cost_pct.toFixed(3)}%`} | Net edge: {evaluation?.expected_net_return_pct == null ? "not recorded" : `${evaluation.expected_net_return_pct.toFixed(4)}%`}</span>
    </div>}
    {result?.available && <div className="mb-3 rounded-md border border-sky-900/60 bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-400">Live shadow outcomes for this model version: {observed?.samples ? `${observed.direction_accuracy_pct?.toFixed(1) ?? "n/a"}% direction accuracy, n=${observed.samples}` : "not enough settled observations yet"}. This is separate from training holdout accuracy.</div>}
    {result?.available && observed?.shadow_health && <div className={cn("mb-3 rounded-md border px-2 py-1.5 text-[11px]", observed.shadow_health.status === "SHADOW_HEALTHY" ? "border-emerald-900/70 bg-emerald-950/20 text-emerald-300" : observed.shadow_health.status === "REVIEW_REQUIRED" ? "border-rose-900/70 bg-rose-950/20 text-rose-300" : "border-amber-900/70 bg-amber-950/20 text-amber-300")}>Shadow health: {observed.shadow_health.status?.replaceAll("_", " ")} - {observed.shadow_health.reason?.replaceAll("_", " ")}. Review-only; it never changes live execution.</div>}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-[11px] uppercase tracking-wide text-violet-300">Python ML shadow decision · closed candles only</div><div className="mt-1 text-xs text-slate-400">Manual decision support only. Never places, blocks, or changes a live order.</div></div>
      <Badge variant="outline" className="border-violet-800 text-[10px] text-violet-300">Shadow only</Badge>
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
      <Select value={timeframe} onValueChange={(value) => setTimeframe(value as PythonTimeframe)}><SelectTrigger className="h-9 border-slate-800 bg-slate-950 text-xs"><SelectValue /></SelectTrigger><SelectContent>{PYTHON_TIMEFRAMES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      <div className="text-[11px] text-slate-500">{timeframe === "45m" ? "45m is derived from three consecutive closed 15m Binance Futures candles." : `Native Binance Futures ${timeframe} candles.`}</div>
    </div>
    {query.isLoading || chart.isLoading ? <div className="mt-3 text-xs text-slate-500">Reading the latest closed-candle model input…</div> : candles.length < 20 ? <div className="mt-3 text-xs text-amber-400">WAIT · at least 20 fully closed {timeframe} candles are required.</div> : !result ? <div className="mt-3 text-xs text-amber-400">WAIT · Python provider is disabled or unavailable on the server.</div> : result.available ? <div className="mt-3 grid gap-3 md:grid-cols-3"><div><div className="text-[11px] text-slate-500">Python direction</div><Badge variant="outline" className={cn("mt-1 text-sm", decisionBadgeClass(result.direction))}>{result.direction ?? "WAIT"}</Badge></div><div><div className="text-[11px] text-slate-500">Predicted return</div><div className="mt-1 text-sm font-medium text-slate-200">{result.predicted_return_pct == null ? "—" : `${result.predicted_return_pct.toFixed(4)}%`}</div></div><div><div className="text-[11px] text-slate-500">Holdout direction accuracy</div><div className="mt-1 text-sm font-medium text-slate-200">{accuracy == null ? "Not recorded" : `${accuracy.toFixed(1)}%${holdoutRows ? ` · n=${holdoutRows}` : ""}`}</div></div></div> : <div className="mt-3 text-xs text-amber-400">WAIT · {result.reason?.replaceAll("_", " ") ?? "model not trained or not published for this symbol/timeframe"}</div>}
    <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">Model: {result?.provider_version ?? `${symbol.toUpperCase()}-${timeframe} pending`} · Holdout accuracy is an out-of-sample metric, not a promise for this individual decision.</div>
  </div>;
}

function ProviderShadowCards({ symbol, candles, workspaceId, integrationId }: { symbol: string; candles: ForecastCandle[]; workspaceId?: string; integrationId?: string }) {
  const query = useQuery({
    queryKey: ["prediction-observatory", symbol, candles.length, candles.at(-1)?.timestamp],
    queryFn: () => authorizedFetch("/quick-trade/prediction-observatory", "POST", {
      symbol, market_type: "crypto", timeframe: "15m", horizon_seconds: 900,
      current_quote: candles.at(-1)?.close, candles, workspace_id: workspaceId, integration_id: integrationId,
    }) as Promise<{ providers?: Record<string, { result?: { direction?: string | null; confidence?: number | null; predicted_expiry_price?: number | null; predicted_return_pct?: number | null; predicted_low?: number | null; predicted_high?: number | null; provider_version?: string; data_quality?: string; available?: boolean; reason?: string | null } }> }>,
    enabled: candles.length >= 8,
    refetchInterval: 15000,
    staleTime: 0,
  });
  const providers = Object.entries(query.data?.providers ?? {});
  const directions = providers.map(([, provider]) => provider.result?.direction).filter(Boolean);
  const agreement = directions.length > 1 && new Set(directions).size === 1;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">Prediction engines · closed candles · shadow only</div>
      {query.isLoading ? <div className="mt-2 text-xs text-slate-600">Reading provider outputs…</div> : (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className={agreement ? "text-emerald-400" : "text-amber-400"}>
            {directions.length < 2 ? "Waiting for multiple engines" : agreement ? `Engines agree: ${directions[0]}` : "Engines disagree — review evidence"}
          </span>
        </div>
      )}
      {!query.isLoading && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {providers.map(([key, provider]) => {
            const result = provider.result;
            return <div key={key} className="rounded-lg border border-slate-800 px-3 py-2 text-xs">
              <span className="text-slate-400"><span className="text-slate-200">{key.replaceAll("_", " ")}</span> · {result?.available ? (result.direction ?? "NEUTRAL") : (result?.reason ?? "Unavailable")}</span>
              <span className="text-slate-500">{result?.confidence == null ? "—" : `${Number(result.confidence).toFixed(0)}%`} · {result?.data_quality ?? "UNKNOWN"}</span>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

function AccuracyStatusCard({ workspaceId }: { workspaceId?: string }) {
  const query = useQuery({
    queryKey: ["prediction-accuracy-report"],
    queryFn: () => authorizedFetch("/quick-trade/prediction-accuracy-report", "POST", { workspace_id: workspaceId }) as Promise<{ status?: string; groups?: Array<{ provider: string; timeframe: string; direction_accuracy_pct?: number | null; samples: number }>; metrics?: { samples?: number; mae?: number | null; rmse?: number | null; range_coverage_pct?: number | null } }>,
    enabled: !!workspaceId,
    staleTime: 30000,
  });
  const groups = query.data?.groups ?? [];
  const metrics = query.data?.metrics;
  return <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
    <div className="text-[11px] uppercase tracking-wide text-slate-500">Historical accuracy</div>
    {query.isLoading ? <div className="mt-2 text-xs text-slate-600">Loading accuracy report…</div> : groups.length === 0 ? (
      <div className="mt-2 text-xs text-amber-400">INSUFFICIENT_DATA · closed outcomes are still being collected</div>
    ) : <div className="mt-2 grid gap-2 md:grid-cols-2">{groups.map((group) =>
      <div key={`${group.provider}-${group.timeframe}`} className="flex justify-between text-xs text-slate-400">
        <span>{group.provider} · {group.timeframe}</span><span>{group.direction_accuracy_pct ?? "—"}% ({group.samples})</span>
      </div>)}
    </div>}
    {!query.isLoading && metrics && <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
      <span>Samples: {metrics.samples ?? 0}</span>
      <span>MAE: {metrics.mae ?? "—"}</span>
      <span>Range: {metrics.range_coverage_pct == null ? "—" : `${metrics.range_coverage_pct}%`}</span>
    </div>}
  </div>;
}

type FreshDatasetDashboard = {
  datasets?: Array<{
    id: string; name: string; status: string; started_at?: string | null; sealed_at?: string | null;
    ready_pairs: number; total_pairs: number;
    pairs: Array<{ symbol: string; timeframe: string; rows: number; minimum_rows: number; gaps: number; misaligned: number; stale_seconds?: number | null; state: string }>;
  }>;
  candidates?: Array<{
    id: string; dataset_id: string; symbol: string; timeframe: string; provider: string; status: string;
    metrics?: { quality_gate?: { passed?: boolean }; metrics?: { direction_accuracy_pct?: number; mae?: number; baseline_mae?: number }; holdout_rows?: number };
  }>;
  registry?: Array<{ candidate_id: string; status: string; execution: boolean; influence: boolean }>;
};

function FreshDatasetStatusCard({ workspaceId }: { workspaceId?: string }) {
  const query = useQuery({
    queryKey: ["prediction-fresh-datasets", workspaceId],
    queryFn: () => authorizedFetch("/quick-trade/prediction-fresh-datasets", "GET", undefined, { params: { workspace_id: workspaceId } }) as Promise<FreshDatasetDashboard>,
    enabled: !!workspaceId,
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const latest = query.data?.datasets?.[0];
  const candidates = query.data?.candidates ?? [];
  const registry = new Map((query.data?.registry ?? []).map((entry) => [entry.candidate_id, entry]));

  return <div className="mt-3 rounded-xl border border-cyan-900/60 bg-slate-950/40 p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] uppercase tracking-wide text-cyan-300">Fresh canonical dataset · Binance Futures · shadow only</div>
      <Badge variant="outline" className="border-cyan-900 text-[10px] text-cyan-300">Never executes</Badge>
    </div>
    {query.isLoading ? <div className="mt-2 text-xs text-slate-600">Reading fresh dataset quality…</div> : query.isError ? (
      <div className="mt-2 text-xs text-slate-500">Fresh dataset dashboard is unavailable until its migration is deployed.</div>
    ) : !latest ? <div className="mt-2 text-xs text-amber-400">No fresh dataset started yet. Old market history is not used here.</div> : (
      <div className="mt-2 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
          <span><span className="font-medium">{latest.name}</span> · {latest.status}</span>
          <span className="text-slate-500">Ready pairs: {latest.ready_pairs}/{latest.total_pairs}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {latest.pairs.map((pair) => <div key={`${pair.symbol}-${pair.timeframe}`} className="rounded-lg border border-slate-800 px-2.5 py-2 text-[11px]">
            <div className="flex justify-between text-slate-300"><span>{pair.symbol} · {pair.timeframe}</span><span className={pair.state === "READY_FOR_TRAINING" ? "text-emerald-400" : "text-amber-400"}>{pair.state}</span></div>
            <div className="mt-1 text-slate-500">{pair.rows}/{pair.minimum_rows} candles · gaps {pair.gaps} · invalid {pair.misaligned}</div>
          </div>)}
        </div>
        {candidates.length > 0 && <div className="border-t border-slate-800 pt-2 text-[11px]">
          {candidates.slice(0, 4).map((candidate) => {
            const score = candidate.metrics?.metrics?.direction_accuracy_pct;
            const entry = registry.get(candidate.id);
            return <div key={candidate.id} className="flex justify-between gap-2 py-0.5 text-slate-400"><span>{candidate.symbol} · {candidate.timeframe} · {candidate.status}</span><span>{score == null ? "No holdout score" : `${score.toFixed(1)}% holdout`} {entry ? `· ${entry.status}` : ""}</span></div>;
          })}
        </div>}
      </div>
    )}
  </div>;
}

export function MultiWindowForecastPanel({
  workspaceId,
  symbol,
  exchange,
  mode,
  integrationId,
  stakeAmount,
}: {
  workspaceId?: string;
  symbol: string;
  exchange?: string;
  mode?: "paper" | "live";
  integrationId?: string;
  stakeAmount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  // Each window needs its OWN candles at its OWN chart timeframe -- these
  // are separate REST polls from the ticket's primary chart. Disabled
  // (symbol "") while the panel is collapsed, so opening this is the only
  // thing that starts the extra network activity.
  const shortChart = useQuickTradeChart({
    workspaceId, symbol: expanded ? symbol : "", timeframe: "15m", chartType: "area", indicatorSet: [], mode,
  });
  const mediumChart = useQuickTradeChart({
    workspaceId, symbol: expanded ? symbol : "", timeframe: "1h", chartType: "area", indicatorSet: [], mode,
  });
  const longChart = useQuickTradeChart({
    workspaceId, symbol: expanded ? symbol : "", timeframe: "4h", chartType: "area", indicatorSet: [], mode,
  });

  const windowCandles = {
    short: closedCandles(shortChart.data?.candles ?? [], "15m"),
    medium: closedCandles(mediumChart.data?.candles ?? [], "1h"),
    long: closedCandles(longChart.data?.candles ?? [], "4h"),
  };

  const comparison = useMultiWindowForecast({
    symbol,
    exchange,
    stakeAmount,
    mode,
    workspaceId,
    integrationId,
    windowCandles,
    enabled: expanded && !!symbol,
  });

  const entriesByLabel = new Map((comparison.data?.windows ?? []).map((w) => [w.window_label, w]));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Multi-window forecast comparison</div>
          <div className="text-sm text-slate-300">
            Compare the short/medium/long forecasts side by side — informational only, never places or blocks a trade.
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {WINDOW_DEFINITIONS.map((definition) => (
            <WindowCard key={definition.label} definition={definition} entry={entriesByLabel.get(definition.label)} />
          ))}
        </div>
      )}
      {expanded && <PythonShadowDecisionCard symbol={symbol} workspaceId={workspaceId} integrationId={integrationId} mode={mode} />}
      {expanded && <ProviderShadowCards symbol={symbol} candles={windowCandles.short} workspaceId={workspaceId} integrationId={integrationId} />}
      {expanded && <AccuracyStatusCard workspaceId={workspaceId} />}
      {expanded && <FreshDatasetStatusCard workspaceId={workspaceId} />}
      {expanded && comparison.isError && (
        <div className="mt-2 text-xs text-rose-400">Comparison temporarily unavailable. Retrying automatically.</div>
      )}
    </div>
  );
}
