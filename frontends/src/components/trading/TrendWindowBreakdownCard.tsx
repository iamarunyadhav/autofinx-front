import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type TrendDirection = "bullish" | "bearish" | "neutral";

interface TrendWindow {
  key: string;
  label: string;
  weight: number;
  candles: number;
  move_pct: number;
  reference_move_pct: number;
  score: number;
  direction: TrendDirection;
  sample_size: number;
}

interface BacktestPayload {
  sample_size: number;
  hits: number;
  hit_rate_pct: number | null;
  avg_confidence_pct: number | null;
  computed_at: string | null;
}

interface TrendScorePayload {
  direction: TrendDirection;
  composite_score: number;
  min_composite: number;
  agreement_count: number;
  window_count: number;
  windows: TrendWindow[];
  horizon_seconds: number;
  backtest: BacktestPayload | null;
}

// Same bullish/bearish/neutral palette as SignalSummaryCard -- kept
// identical on purpose so the two Robot Signal-adjacent cards never
// disagree visually about what a color means.
function directionBoxClass(direction: TrendDirection) {
  switch (direction) {
    case "bullish":
      return "border-emerald-500/20 bg-emerald-500/5 text-emerald-300";
    case "bearish":
      return "border-rose-500/20 bg-rose-500/5 text-rose-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-100";
  }
}

function directionBadgeClass(direction: TrendDirection) {
  switch (direction) {
    case "bullish":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-400/30";
    case "bearish":
      return "bg-rose-500/10 text-rose-300 border-rose-400/30";
    default:
      return "bg-slate-500/10 text-slate-300 border-slate-400/30";
  }
}

function formatHorizon(seconds: number) {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

/**
 * Multi-Window Forecast Engine Part B/C -- shows the same 0.5/0.3/0.2
 * weighted short/medium/long trend score the auto-start-direction gate
 * itself reads (MultiWindowTrendScoringService), plus the honest
 * walk-forward backtest hit-rate for this bot's effective horizon
 * (ForecastHorizonBacktestService). Never claims accuracy it hasn't
 * measured -- an empty/low-sample backtest says so plainly instead of
 * hiding the line or inventing a number.
 */
export function TrendWindowBreakdownCard({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: ["ratio-bot-trend-score", botId],
    queryFn: async () => {
      const response = await api.get<TrendScorePayload>(`/ratio-bots/${botId}/trend-score`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  const data = query.data;
  if (!data) {
    return null;
  }

  const backtest = data.backtest;
  const hasBacktestSample = !!backtest && backtest.sample_size > 0 && backtest.hit_rate_pct !== null;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Trend Window Breakdown</h3>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
            directionBadgeClass(data.direction),
          )}
        >
          {data.direction} · {data.composite_score.toFixed(2)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {data.windows.map((window) => (
          <div
            key={window.key}
            className={cn("space-y-1 rounded-lg border px-3 py-2 text-xs", directionBoxClass(window.direction))}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{window.label}</span>
              <span className="text-[10px] opacity-70">w={window.weight.toFixed(1)} · {window.candles}c</span>
            </div>
            <div className="tabular-nums">
              move {window.move_pct >= 0 ? "+" : ""}{window.move_pct.toFixed(2)}% / atr {window.reference_move_pct.toFixed(2)}%
            </div>
            <div className="tabular-nums opacity-80">score {window.score >= 0 ? "+" : ""}{window.score.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Agreement: {data.agreement_count}/{data.window_count} windows</span>
        <span>Horizon: {formatHorizon(data.horizon_seconds)}</span>
        <span>
          Backtest hit-rate:{" "}
          {hasBacktestSample
            ? `${backtest!.hit_rate_pct!.toFixed(1)}% (${backtest!.sample_size} samples)`
            : "not enough history yet"}
        </span>
      </div>
    </div>
  );
}
