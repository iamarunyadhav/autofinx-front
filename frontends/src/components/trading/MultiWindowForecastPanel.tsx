import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      {expanded && <ProviderShadowCards symbol={symbol} candles={windowCandles.short} workspaceId={workspaceId} integrationId={integrationId} />}
      {expanded && <AccuracyStatusCard workspaceId={workspaceId} />}
      {expanded && comparison.isError && (
        <div className="mt-2 text-xs text-rose-400">Comparison temporarily unavailable. Retrying automatically.</div>
      )}
    </div>
  );
}
