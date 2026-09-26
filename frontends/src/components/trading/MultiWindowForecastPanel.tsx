import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useMultiWindowForecast,
  useQuickTradeChart,
  type MultiWindowEntry,
  type MultiWindowLabel,
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
    short: shortChart.data?.candles ?? [],
    medium: mediumChart.data?.candles ?? [],
    long: longChart.data?.candles ?? [],
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
      {expanded && comparison.isError && (
        <div className="mt-2 text-xs text-rose-400">Comparison temporarily unavailable. Retrying automatically.</div>
      )}
    </div>
  );
}
