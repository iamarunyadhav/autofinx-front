import { memo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

type Comparison = {
  status: string; predicted_direction: string | null; actual_direction: string | null;
  direction_correct: boolean | null; price_in_predicted_range: boolean | null;
  predicted_price: number | null; actual_price: number | null; price_error_pct?: number | null;
};
type ResearchRow = {
  trade_id: string; symbol: string; mode: string; side: string; entry_at: string; status: string;
  entry_price: number; exit_price: number | null; stake_amount: number; quantity: number | null;
  net_pnl_booked: number | null; gross_pnl: number | string | null; timeframe: string; expiry_seconds: number;
  prediction_direction?: string | null; prediction_confidence?: number | null; actual_trade_direction?: string | null;
  direction_match_at_trade_exit?: boolean | null; prediction_horizon_direction?: string | null;
  prediction_horizon_direction_correct?: boolean | null; trade_result?: string; net_profit_positive?: boolean | null;
  fees: { source: string; entry_actual: string | number | null; exit_actual: string | number | null; funding_actual_cost: string | number | null; total_used: string | number | null };
  primary_comparison: Comparison; shadow_comparison: Comparison;
  outcome_evaluation?: { status?: string; primary?: Comparison; evaluated_at?: string; net_pnl?: number | null } | null;
  timeline: Array<Record<string, unknown>>;
  research_snapshot: Record<string, unknown> | null;
  slippage: Record<string, unknown>;
  data_quality: { sample_count: number; price_history: string; training_eligible: boolean };
  // Part A3 — the two predictions, stored at entry and evaluated separately.
  direction_prediction?: { value: string | null; expiry_score: number | null; expected_move_pct: number | null } | null;
  trade_decision_prediction?: {
    value: string | null; required_move_pct: number | null;
    max_achievable_move_pct: number | null; gate_reason: string | null; fee_model: string | null;
  } | null;
  direction_correct?: boolean | null;
  direction_evaluation_status?: string | null;
  trade_decision_correct?: boolean | null;
  trade_decision_evaluation_status?: string | null;
  gross_direction_correct?: boolean | null;
  // Part A4 — what following the direction would have netted.
  wait_shadow?: {
    status: string; direction: string | null; trade_decision: string | null;
    hypothetical_net_usdt: number | null; would_have_profited: boolean | null;
    wait_saved_usdt: number | null; wait_missed_usdt: number | null;
  } | null;
  manual_override?: boolean | null;
};
// Part A3 — the four aggregate audit metrics, computed server-side.
type AuditSummary = {
  trade_count: number;
  direction_evaluated: number; direction_correct_count: number; direction_not_applicable: number;
  direction_accuracy_pct: number | null;
  trade_decision_evaluated: number; trade_decision_correct_count: number;
  trade_decision_accuracy_pct: number | null;
  wait_decisions_evaluated: number;
  wait_decision_saved_usdt: number; wait_decision_missed_usdt: number; wait_decision_net_benefit_usdt: number;
  manual_override_count: number; min_samples_for_accuracy: number; status: string; note: string;
};
type ResearchResponse = {
  as_of: string; rows: ResearchRow[]; next_cursor: string | null; has_more: boolean;
  sample_storage_ready: boolean; collection_enabled: boolean; shadow_enabled: boolean; shadow_only: boolean;
  summary: Record<"primary" | "shadow", { evaluable: number; correct: number; accuracy_pct: number | null; status: string }>;
  audit_summary?: AuditSummary;
};
// Part D1/D2/D3.
type AccuracyBucket = {
  bucket: string; n: number; status: string;
  direction_evaluated: number; direction_accuracy_pct: number | null;
  trade_decision_evaluated: number; trade_decision_accuracy_pct: number | null;
  avg_gross_pnl: number | null; avg_net_pnl: number | null;
  avg_abs_move_pct: number | null; cost_pct: number;
  break_even_accuracy_pct: number | null; tradeable: boolean; tradeable_reason: string;
};
type Reliability = {
  sample_size: number; status: string; calibrated: boolean; brier_score: number | null;
  avg_confidence_correct: number | null; avg_confidence_incorrect: number | null; separation: number | null;
  calibration: Array<{ bucket: string; n: number; avg_confidence_pct: number | null;
    observed_hit_rate_pct: number | null; raw_hit_rate_pct: number | null; calibrated: boolean }>;
};
type AccuracyReport = {
  sample_size: number;
  thresholds: { bucket_min_samples: number; tradeable_min_samples: number; calibration_min_samples: number };
  overall: Omit<AccuracyBucket, "bucket">;
  buckets: Record<string, AccuracyBucket[]>;
  confidence_reliability: { indicator_vote: Reliability; forecast_confidence: Reliability };
  audit_summary: AuditSummary;
  note: string;
};
type ResearchSummary = {
  sample_size: number; evaluated_live_forecasts: number; direction_accuracy_pct: number | null;
  range_hit_rate_pct: number | null; net_profit_rate_pct: number | null; net_pnl: number;
  price_mae: number | null; median_price_error: number | null;
  direction_breakdown: Record<string, { predictions: number; evaluated: number; accuracy_pct: number | null }>;
  status: string; note: string;
};
type BacktestResult = {
  bot_instance_id: string; horizon_seconds: number; confidence_bucket: string;
  sample_size: number; hits: number; raw_hit_rate_pct: number | null;
  calibrated: boolean; hit_rate_pct: number | null; avg_confidence_pct: number | null;
  computed_at: string | null;
};
type BacktestRun = {
  id: string; symbol: string; timeframe: string; horizon_seconds: number; status: string;
  candles_written: number; result_rows: number; error_message: string | null;
  queued_at: string | null; started_at: string | null; finished_at: string | null;
};
type ReliabilityBucket = {
  confidence_bucket: string; confidence_midpoint: number; actual_hit_rate_pct: number | null;
  raw_hit_rate_pct: number | null; sample_size: number; calibrated: boolean;
};
type ReadinessReport = {
  bot_type: string; bot_instance_id: string; horizon_seconds: number;
  data_source: Record<string, unknown>;
  performance: {
    direction_accuracy_pct: number | null; price_mae: number | null; range_hit_rate_pct: number | null;
    net_pnl: number | null; max_drawdown_amount: number | null; max_drawdown_pct: number | null;
    holdout_pnl_sample_size: number | null;
  };
  calibration: {
    reliability_curve: ReliabilityBucket[]; brier_score: number | null; brier_score_sample_size: number;
    overconfident_buckets: Array<Record<string, unknown>>;
  };
  promotion_gate: { status: string; reasons: string[]; details: Record<string, unknown> };
  known_limitations: string[];
};

const GATE_STATUS_STYLE: Record<string, string> = {
  VALIDATED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  NOT_TRADEABLE: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  NOT_VALIDATED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  INSUFFICIENT_DATA: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

const truth = (value: boolean | null) => value === null ? "Unknown" : value ? "TRUE" : "FALSE";
const number = (value: unknown) => value == null ? "—" : Number(value).toFixed(6);
// Spreadsheet formula injection protection. Do not alter legitimate numeric negatives.
function csvCell(value: unknown) {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csv(rows: Array<Record<string, unknown>>) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return "\uFEFF" + [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\r\n");
}

// Memoized: this panel is only used on QuickTradePage, which re-renders on
// every WS price tick — without memo this whole export/analysis table
// (and its own query) would needlessly re-render every tick even though
// its props (workspaceId, symbol) rarely change.
export const QuickTradeResearchPanel = memo(function QuickTradeResearchPanel({ workspaceId, symbol, timeframe = "1m", expirySeconds = 300 }: { workspaceId?: string; symbol: string; timeframe?: string; expirySeconds?: number }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchRow | null>(null);
  // Scope filters for the analytics sections below (summary, backtest
  // results, model readiness) — independent of the live trading page's own
  // symbol/timeframe/expiry, which are passed in as props. Defaulted from
  // those props; QuickTradePage already remounts this panel via a `key`
  // that includes symbol/timeframe/duration, so these reset naturally when
  // the page's own selection changes.
  const [filterSymbol, setFilterSymbol] = useState(symbol);
  const [filterTimeframe, setFilterTimeframe] = useState(timeframe);
  const [filterExpiry, setFilterExpiry] = useState(expirySeconds);
  const filters = { symbol, from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined };
  const report = useQuery({
    queryKey: ["quick-trade-research", workspaceId, symbol, from, to, cursor, asOf],
    queryFn: () => authorizedFetch(`/workspaces/${workspaceId}/quick-trades/research`, "GET", undefined,
      { params: { ...filters, cursor, as_of: asOf, limit: 50 } }) as Promise<ResearchResponse>,
    enabled: !!workspaceId, refetchInterval: 30000,
  });
  const summary = useQuery({
    queryKey: ["quick-trade-research-summary", workspaceId, filterSymbol, filterTimeframe, filterExpiry],
    queryFn: () => authorizedFetch("/workspaces/" + workspaceId + "/quick-trades/research/summary", "GET", undefined,
      { params: { symbol: filterSymbol, timeframe: filterTimeframe, expiry_seconds: filterExpiry, limit: 1000 } }) as Promise<ResearchSummary>,
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
  const backtest = useQuery({
    queryKey: ["quick-trade-backtest-results", workspaceId, filterSymbol, filterTimeframe, filterExpiry],
    queryFn: () => authorizedFetch("/workspaces/" + workspaceId + "/quick-trades/research/backtest-results", "GET", undefined,
      { params: { symbol: filterSymbol, timeframe: filterTimeframe, expiry_seconds: filterExpiry } }) as Promise<{ status: string; status_source: string; runs: BacktestRun[]; results: BacktestResult[]; note: string }>,
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
  const botInstanceId = `binance_futures:${filterSymbol.toUpperCase()}:${filterTimeframe}`;
  // Part D1/D2/D3 — bucketed accuracy, break-even and confidence reliability,
  // served by the same research exporter (no parallel pipeline).
  const accuracy = useQuery({
    queryKey: ["quick-trade-accuracy-report", workspaceId, filterSymbol, filterTimeframe, filterExpiry],
    queryFn: () => authorizedFetch("/workspaces/" + workspaceId + "/quick-trades/research/accuracy-report", "GET", undefined,
      { params: { symbol: filterSymbol, timeframe: filterTimeframe, expiry_seconds: filterExpiry, limit: 2000 } }) as Promise<AccuracyReport>,
    enabled: !!workspaceId,
    refetchInterval: 60000,
  });
  const readiness = useQuery({
    queryKey: ["quick-trade-readiness", workspaceId, botInstanceId, filterExpiry],
    queryFn: () => authorizedFetch("/workspaces/" + workspaceId + "/quick-trades/research/readiness", "GET", undefined,
      { params: { bot_type: "quick_trade", bot_instance_id: botInstanceId, horizon_seconds: filterExpiry,
        symbol: filterSymbol, timeframe: filterTimeframe } }) as Promise<ReadinessReport>,
    enabled: !!workspaceId,
    refetchInterval: 60000,
  });
  const startBacktest = useMutation({
    mutationFn: () => authorizedFetch("/workspaces/" + workspaceId + "/quick-trades/research/backtest", "POST", {
      symbol, timeframe, expiry_seconds: expirySeconds, exchange: "binance_futures", candle_limit: 500,
    }),
    onSuccess: () => { void backtest.refetch(); setMessage("Backtest queued on analytics worker."); },
    onError: (error) => setMessage("Backtest could not be queued: " + (error instanceof Error ? error.message : "unknown error")),
  });
  const reset = () => { setCursor(null); setAsOf(null); setSelected([]); setDetail(null); };

  async function exportData(format: "json" | "summary" | "timeline", selectedOnly: boolean) {
    if (!workspaceId) return;
    setBusy(true); setMessage("Preparing export…");
    try {
      const all: ResearchRow[] = [];
      let next: string | null = null;
      let cutoff: string | null = null;
      // Part A3 — accumulated from the backend's own per-page audit_summary
      // rather than re-derived in the browser, so the exported numbers are the
      // same ones the API reports.
      const auditSummaryPages: AuditSummary[] = [];
      const seen = new Set<string>();
      do {
        const page = await authorizedFetch(`/workspaces/${workspaceId}/quick-trades/research/export`, "POST", {
          ...filters, trade_ids: selectedOnly ? selected : undefined, cursor: next, as_of: cutoff, limit: 100,
        }) as ResearchResponse;
        for (const row of page.rows) if (!seen.has(row.trade_id)) { all.push(row); seen.add(row.trade_id); }
        if (page.audit_summary) auditSummaryPages.push(page.audit_summary);
        cutoff = page.as_of; next = page.next_cursor;
        setMessage(`Preparing ${all.length} trades…`);
        if (next) await new Promise((resolve) => window.setTimeout(resolve, 2500));
      } while (next);
      const name = `quick-trades-${symbol}-${new Date().toISOString().replaceAll(":", "-")}`;
      const evaluated = all.filter((row) => row.primary_comparison.direction_correct !== null);
      const directionCorrect = evaluated.filter((row) => row.primary_comparison.direction_correct === true).length;
      const netRows = all.filter((row) => row.net_profit_positive !== null);
      const netWins = netRows.filter((row) => row.net_profit_positive === true).length;
      const totalNet = all.reduce((sum, row) => sum + (Number(row.net_pnl_booked) || 0), 0);
      const auditSummary = { total_trades: all.length, evaluated_horizon_predictions: evaluated.length,
        horizon_direction_correct: directionCorrect, horizon_direction_accuracy_pct: evaluated.length ? Number((directionCorrect / evaluated.length * 100).toFixed(2)) : null,
        settled_net_profit_trades: netRows.length, net_profit_wins: netWins,
        net_profit_accuracy_pct: netRows.length ? Number((netWins / netRows.length * 100).toFixed(2)) : null,
        total_net_pnl: Number(totalNet.toFixed(8)), net_profitable: totalNet > 0,
        // Part A3 — the four new metrics, summed across pages from the
        // backend's own per-page audit_summary. Percentages are recomputed
        // from the summed counts (you cannot average percentages across
        // pages), and stay null below the backend's own minimum sample size
        // rather than being reported off a handful of trades.
        ...(() => {
          const sum = (key: keyof AuditSummary) =>
            auditSummaryPages.reduce((total, page) => total + (Number(page[key]) || 0), 0);
          const minSamples = auditSummaryPages[0]?.min_samples_for_accuracy ?? 30;
          const dirEval = sum("direction_evaluated");
          const dirCorrect = sum("direction_correct_count");
          const decEval = sum("trade_decision_evaluated");
          const decCorrect = sum("trade_decision_correct_count");
          return {
            direction_evaluated: dirEval,
            direction_correct: dirCorrect,
            direction_not_applicable: sum("direction_not_applicable"),
            direction_accuracy_pct: dirEval >= minSamples ? Number((dirCorrect / dirEval * 100).toFixed(2)) : null,
            trade_decision_evaluated: decEval,
            trade_decision_correct: decCorrect,
            trade_decision_accuracy_pct: decEval >= minSamples ? Number((decCorrect / decEval * 100).toFixed(2)) : null,
            wait_decisions_evaluated: sum("wait_decisions_evaluated"),
            wait_decision_saved_usdt: Number(sum("wait_decision_saved_usdt").toFixed(8)),
            wait_decision_missed_usdt: Number(sum("wait_decision_missed_usdt").toFixed(8)),
            wait_decision_net_benefit_usdt: Number(sum("wait_decision_net_benefit_usdt").toFixed(8)),
            manual_override_count: sum("manual_override_count"),
            min_samples_for_accuracy: minSamples,
          };
        })(),
        note: "Direction accuracy is fee-free; trade-decision accuracy is fee-aware and covers BUY/SELL decisions only. WAIT correctness is measured by the saved/missed columns, never as a pass/fail. Unknown data is excluded, never counted as false." };
      if (format === "json") {
        saveFile(`${name}.json`, JSON.stringify({ schema_version: 1, exported_at: new Date().toISOString(), as_of: cutoff,
          filters, trade_count: all.length, audit_summary: auditSummary, training_note: "Pre-entry features and post-entry labels are separate. Unknown is not false. No automatic training or live model promotion.", trades: all }, null, 2), "application/json");
      } else if (format === "summary") {
        saveFile(`${name}-summary.csv`, csv(all.map((row) => ({ trade_id: row.trade_id, symbol: row.symbol,
          mode: row.mode, side: row.side, entry_at: row.entry_at, entry_price: row.entry_price, exit_price: row.exit_price,
          stake: row.stake_amount, quantity: row.quantity, timeframe: row.timeframe, expiry_seconds: row.expiry_seconds,
          gross_pnl: row.gross_pnl, net_pnl_booked: row.net_pnl_booked, ...row.fees,
          primary_direction_correct: row.primary_comparison.direction_correct,
          shadow_direction_correct: row.shadow_comparison.direction_correct,
          prediction_direction: row.prediction_direction, prediction_confidence: row.prediction_confidence,
          actual_trade_direction: row.actual_trade_direction, direction_match_at_trade_exit: row.direction_match_at_trade_exit,
          prediction_horizon_direction: row.prediction_horizon_direction, prediction_horizon_direction_correct: row.prediction_horizon_direction_correct,
          trade_result: row.trade_result, net_profit_positive: row.net_profit_positive,
          // Part A3/A4/A5 — the two predictions and their separate verdicts.
          direction_prediction: row.direction_prediction?.value ?? null,
          direction_expiry_score: row.direction_prediction?.expiry_score ?? null,
          direction_expected_move_pct: row.direction_prediction?.expected_move_pct ?? null,
          direction_correct: row.direction_correct, direction_evaluation_status: row.direction_evaluation_status,
          trade_decision_prediction: row.trade_decision_prediction?.value ?? null,
          trade_decision_required_move_pct: row.trade_decision_prediction?.required_move_pct ?? null,
          trade_decision_max_achievable_move_pct: row.trade_decision_prediction?.max_achievable_move_pct ?? null,
          trade_decision_gate_reason: row.trade_decision_prediction?.gate_reason ?? null,
          trade_decision_fee_model: row.trade_decision_prediction?.fee_model ?? null,
          trade_decision_correct: row.trade_decision_correct,
          trade_decision_evaluation_status: row.trade_decision_evaluation_status,
          gross_direction_correct: row.gross_direction_correct,
          wait_shadow_status: row.wait_shadow?.status ?? null,
          wait_shadow_net_usdt: row.wait_shadow?.hypothetical_net_usdt ?? null,
          wait_decision_saved_usdt: row.wait_shadow?.wait_saved_usdt ?? null,
          wait_decision_missed_usdt: row.wait_shadow?.wait_missed_usdt ?? null,
          manual_override: row.manual_override,
          predicted_price: row.primary_comparison.predicted_price, actual_horizon_price: row.primary_comparison.actual_price,
          price_in_predicted_range: row.primary_comparison.price_in_predicted_range,
          price_error_pct: row.primary_comparison.price_error_pct, training_eligible: row.data_quality.training_eligible,
          slippage: row.slippage, config_and_forecast_snapshot: row.research_snapshot,
        }))), "text/csv;charset=utf-8");
      } else {
        saveFile(`${name}-timeline.csv`, csv(all.flatMap((row) => row.timeline.map((point) => ({ trade_id: row.trade_id,
          symbol: row.symbol, mode: row.mode, side: row.side, ...point })))), "text/csv;charset=utf-8");
      }
      setMessage(`Exported ${all.length} trades. JSON contains the complete recorded dataset.`);
    } catch (error) {
      setMessage(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}. No partial file saved.`);
    } finally { setBusy(false); }
  }

  return <Card className="border-slate-800 bg-slate-950 text-slate-100">
    <CardHeader><CardTitle>History export & shadow analysis — {symbol}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-slate-400">Read-only observation. Existing live trade decisions are unchanged. TRUE/FALSE uses the prediction horizon, not an early stop-loss exit. Price correctness means inside the saved predicted range; exact price error is separate.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">From (local time)<Input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} /></label>
        <label className="text-xs">To (local time)<Input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} /></label>
        <Button variant="outline" disabled={busy || report.isFetching} onClick={() => { reset(); void report.refetch(); }}>Refresh analysis</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 p-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 w-full">Analytics scope (summary / backtest / readiness below)</div>
        <label className="text-xs">Symbol<Input className="w-28" value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value.toUpperCase())} /></label>
        <label className="text-xs">Timeframe<Input className="w-20" value={filterTimeframe} onChange={(e) => setFilterTimeframe(e.target.value)} /></label>
        <label className="text-xs">Expiry (sec)<Input className="w-24" type="number" min={5} max={3600} value={filterExpiry} onChange={(e) => setFilterExpiry(Number(e.target.value) || expirySeconds)} /></label>
        <Button variant="outline" disabled={busy} onClick={() => { void summary.refetch(); void backtest.refetch(); void readiness.refetch(); }}>Apply scope</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || startBacktest.isPending || !workspaceId} onClick={() => startBacktest.mutate()}>Run {Math.round(expirySeconds / 60)}m backtest</Button>
        <Button disabled={busy} onClick={() => void exportData("json", false)}>Export all matching — full JSON</Button>
        <Button variant="outline" disabled={busy || !selected.length} onClick={() => void exportData("json", true)}>Export selected ({selected.length})</Button>
        <Button variant="outline" disabled={busy} onClick={() => void exportData("summary", false)}>Trade table CSV</Button>
        <Button variant="outline" disabled={busy} onClick={() => void exportData("timeline", false)}>Price timeline CSV</Button>
      </div>
      {message && <p className="text-xs" role="status">{message}</p>}
      {report.isError && <p role="alert" className="text-rose-300">{report.error instanceof Error ? report.error.message : "Analysis unavailable"}</p>}
      {report.data && <>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Settled sample</div><div className="text-lg font-semibold">{summary.data?.sample_size ?? "—"}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Direction accuracy</div><div className="text-lg font-semibold">{summary.data?.direction_accuracy_pct == null ? "Insufficient" : String(summary.data.direction_accuracy_pct) + "%"}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Range hit rate</div><div className="text-lg font-semibold">{summary.data?.range_hit_rate_pct == null ? "Insufficient" : String(summary.data.range_hit_rate_pct) + "%"}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Net P&amp;L</div><div className={(summary.data?.net_pnl ?? 0) >= 0 ? "text-lg font-semibold text-emerald-300" : "text-lg font-semibold text-rose-300"}>{summary.data?.net_pnl == null ? "—" : number(summary.data.net_pnl)}</div></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Price MAE</div><div className="text-sm font-semibold">{summary.data?.price_mae == null ? "—" : number(summary.data.price_mae)}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Median error</div><div className="text-sm font-semibold">{summary.data?.median_price_error == null ? "—" : number(summary.data.median_price_error)}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">Net profit rate</div><div className="text-sm font-semibold">{summary.data?.net_profit_rate_pct == null ? "Insufficient" : String(summary.data.net_profit_rate_pct) + "%"}</div></div>
          <div className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">BUY / SELL / WAIT</div><div className="text-sm font-semibold">{["buy", "sell", "neutral"].map((key) => key.toUpperCase() + " " + (summary.data?.direction_breakdown?.[key]?.predictions ?? 0)).join(" · ")}</div></div>
        </div>
        {summary.data && <p className="text-xs text-slate-500">{summary.data.note} Accuracy is shown only after 30 evaluated samples.</p>}

        {/* ── Part A3: direction vs trade decision, judged separately ── */}
        {accuracy.data?.audit_summary && <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <div className="text-xs uppercase tracking-wide text-sky-300">Direction vs trade decision — judged separately</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">Direction accuracy (fee-free)</div>
              <div className="text-lg font-semibold">{accuracy.data.audit_summary.direction_accuracy_pct == null ? "Insufficient" : accuracy.data.audit_summary.direction_accuracy_pct + "%"}</div>
              <div className="text-[11px] text-slate-500">{accuracy.data.audit_summary.direction_correct_count}/{accuracy.data.audit_summary.direction_evaluated} evaluated · {accuracy.data.audit_summary.direction_not_applicable} neutral excluded</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Trade-decision accuracy (fee-aware)</div>
              <div className="text-lg font-semibold">{accuracy.data.audit_summary.trade_decision_accuracy_pct == null ? "Insufficient" : accuracy.data.audit_summary.trade_decision_accuracy_pct + "%"}</div>
              <div className="text-[11px] text-slate-500">{accuracy.data.audit_summary.trade_decision_correct_count}/{accuracy.data.audit_summary.trade_decision_evaluated} BUY/SELL decisions</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">WAIT saved</div>
              <div className="text-lg font-semibold text-emerald-300">{number(accuracy.data.audit_summary.wait_decision_saved_usdt)}</div>
              <div className="text-[11px] text-slate-500">losses avoided by not trading</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">WAIT missed</div>
              <div className="text-lg font-semibold text-rose-300">{number(accuracy.data.audit_summary.wait_decision_missed_usdt)}</div>
              <div className="text-[11px] text-slate-500">profits missed by not trading</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Net benefit of WAIT: <span className={accuracy.data.audit_summary.wait_decision_net_benefit_usdt >= 0 ? "text-emerald-300" : "text-rose-300"}>{number(accuracy.data.audit_summary.wait_decision_net_benefit_usdt)}</span> USDT
            over {accuracy.data.audit_summary.wait_decisions_evaluated} evaluated WAIT decisions · {accuracy.data.audit_summary.manual_override_count} manual overrides. {accuracy.data.audit_summary.note}
          </p>
        </div>}

        {/* ── Part D1/D2: bucketed accuracy vs break-even ── */}
        {accuracy.data && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-amber-300">Bucketed accuracy vs break-even</div>
            <div className="text-xs text-slate-500">
              n={accuracy.data.sample_size} · buckets under {accuracy.data.thresholds.bucket_min_samples} are insufficient · tradeable needs {accuracy.data.thresholds.tradeable_min_samples}
            </div>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <div><div className="text-xs text-slate-500">Overall direction</div><div className="text-sm font-semibold">{accuracy.data.overall.direction_accuracy_pct == null ? "Insufficient" : accuracy.data.overall.direction_accuracy_pct + "%"}</div></div>
            <div><div className="text-xs text-slate-500">Break-even needed</div><div className="text-sm font-semibold text-amber-200">{accuracy.data.overall.break_even_accuracy_pct == null ? "—" : accuracy.data.overall.break_even_accuracy_pct + "%"}</div></div>
            <div><div className="text-xs text-slate-500">Avg realised move</div><div className="text-sm font-semibold">{accuracy.data.overall.avg_abs_move_pct == null ? "—" : accuracy.data.overall.avg_abs_move_pct.toFixed(4) + "%"}</div></div>
            <div><div className="text-xs text-slate-500">Verdict</div><div className={"text-sm font-semibold " + (accuracy.data.overall.tradeable ? "text-emerald-300" : "text-rose-300")}>{accuracy.data.overall.tradeable ? "TRADEABLE" : "NOT TRADEABLE"}</div></div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{accuracy.data.overall.tradeable_reason}</p>
          {Object.entries(accuracy.data.buckets).map(([dimension, buckets]) => (
            <details key={dimension} className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-400">Group by {dimension.replaceAll("_", " ")} ({buckets.length})</summary>
              <div className="mt-1 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>
                {["Bucket", "n", "Direction", "Trade decision", "Avg gross", "Avg net", "Break-even", "Verdict"].map((title) => <th key={title} className="p-2 text-slate-500">{title}</th>)}
              </tr></thead><tbody>{buckets.map((bucket) => <tr key={bucket.bucket} className="border-t border-slate-800">
                <td className="p-2">{bucket.bucket}</td>
                <td className="p-2">{bucket.n}</td>
                <td className="p-2">{bucket.direction_accuracy_pct == null ? "insufficient" : bucket.direction_accuracy_pct + "%"}</td>
                <td className="p-2">{bucket.trade_decision_accuracy_pct == null ? "insufficient" : bucket.trade_decision_accuracy_pct + "%"}</td>
                <td className="p-2">{number(bucket.avg_gross_pnl)}</td>
                <td className="p-2">{number(bucket.avg_net_pnl)}</td>
                <td className="p-2">{bucket.break_even_accuracy_pct == null ? "—" : bucket.break_even_accuracy_pct + "%"}</td>
                <td className={"p-2 " + (bucket.tradeable ? "text-emerald-300" : "text-slate-500")}>{bucket.status === "insufficient" ? "insufficient" : bucket.tradeable ? "tradeable" : "not tradeable"}</td>
              </tr>)}</tbody></table></div>
            </details>
          ))}
        </div>}

        {/* ── Part D3/D4: confidence reliability ── */}
        {accuracy.data && <div className="rounded-xl border border-slate-800 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-300">Confidence reliability</div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {([["indicator_vote", "Indicator vote (vote share)"], ["forecast_confidence", "Forecast confidence"]] as const).map(([key, label]) => {
              const metric = accuracy.data!.confidence_reliability[key];
              return <div key={key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">{label}</span>
                  <span className={"rounded-full border px-2 py-0.5 text-[11px] " + (metric.calibrated ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-400")}>
                    {metric.calibrated ? "calibrated" : "uncalibrated score"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  n={metric.sample_size} · Brier {metric.brier_score ?? "—"} · correct {metric.avg_confidence_correct ?? "—"}% vs incorrect {metric.avg_confidence_incorrect ?? "—"}% (separation {metric.separation ?? "—"})
                </div>
                <div className="mt-2 space-y-1">
                  {metric.calibration.map((bucket) => <div key={bucket.bucket} className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 shrink-0 text-slate-500">{bucket.bucket}%</span>
                    <span className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><span className="block h-full bg-emerald-500/60" style={{ width: `${bucket.observed_hit_rate_pct ?? 0}%` }} /></span>
                    <span className="w-32 shrink-0 text-slate-500">
                      {bucket.observed_hit_rate_pct == null ? `uncalibrated (n=${bucket.n})` : `${bucket.observed_hit_rate_pct}% hit (n=${bucket.n})`}
                    </span>
                  </div>)}
                </div>
              </div>;
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            A vote share is not a probability. Until a bucket reaches {accuracy.data.thresholds.calibration_min_samples} evaluated samples the number stays labelled an uncalibrated score; above it, the observed hit rate is shown. No model is promoted automatically — you review.
          </p>
        </div>}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-xs uppercase tracking-wide text-violet-300">Historical walk-forward backtest</div><div className="text-xs text-slate-400">{backtest.data?.note ?? "No persisted backtest results yet."}</div></div>
            <div className="text-xs text-slate-500">{backtest.data?.status ?? "loading"}</div>
          </div>
          {!!backtest.data?.runs.length && <div className="mt-2 text-xs text-slate-400">Latest run: <span className="font-semibold text-slate-200">{backtest.data.runs[0].status}</span> · {backtest.data.runs[0].candles_written} candles · {backtest.data.runs[0].result_rows} result buckets{backtest.data.runs[0].error_message ? " · " + backtest.data.runs[0].error_message : ""}</div>}
          {!!backtest.data?.results.length && <div className="mt-3 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{["Horizon", "Confidence", "Samples", "Hits", "Calibrated accuracy", "Computed"].map((title) => <th key={title} className="p-2">{title}</th>)}</tr></thead><tbody>{backtest.data.results.map((row) => <tr key={row.bot_instance_id + "-" + row.horizon_seconds + "-" + row.confidence_bucket} className="border-t border-slate-800"><td className="p-2">{Math.round(row.horizon_seconds / 60)}m</td><td className="p-2">{row.confidence_bucket}</td><td className="p-2">{row.sample_size}</td><td className="p-2">{row.hits}</td><td className="p-2">{row.calibrated && row.hit_rate_pct != null ? String(row.hit_rate_pct) + "%" : "Insufficient"}</td><td className="p-2">{row.computed_at ? new Date(row.computed_at).toLocaleString() : "—"}</td></tr>)}</tbody></table></div>}
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="text-xs uppercase tracking-wide text-cyan-300">Live vs historical comparison</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div><div className="text-xs text-slate-500">Live observed accuracy</div><div className="text-lg font-semibold">{summary.data?.direction_accuracy_pct == null ? "Insufficient" : String(summary.data.direction_accuracy_pct) + "%"}</div></div>
            <div><div className="text-xs text-slate-500">Historical calibrated buckets</div><div className="text-lg font-semibold">{backtest.data?.results.filter((row) => row.calibrated).length ?? 0}</div></div>
            <div><div className="text-xs text-slate-500">Comparison status</div><div className="text-lg font-semibold">{summary.data?.status === "observed_sample" && backtest.data?.results.some((row) => row.calibrated) ? "Comparable" : "Insufficient"}</div></div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Historical results come from walk-forward candles; live results come from settled real trades. They are not merged and neither result automatically promotes a model.</p>
        </div>
        <div className="rounded-xl border border-slate-800 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-300">Model readiness — {botInstanceId} · {Math.round(filterExpiry / 60)}m</div>
            {readiness.data && <span className={"rounded-full border px-2 py-1 text-xs font-semibold " + (GATE_STATUS_STYLE[readiness.data.promotion_gate.status] ?? GATE_STATUS_STYLE.INSUFFICIENT_DATA)}>{readiness.data.promotion_gate.status.replaceAll("_", " ")}</span>}
          </div>
          {readiness.isLoading && <p className="mt-2 text-xs text-slate-500">Loading readiness report…</p>}
          {readiness.isError && <p role="alert" className="mt-2 text-xs text-rose-300">Readiness report unavailable.</p>}
          {readiness.data && <>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div><div className="text-xs text-slate-500">Direction accuracy</div><div className="text-sm font-semibold">{readiness.data.performance.direction_accuracy_pct == null ? "—" : readiness.data.performance.direction_accuracy_pct + "%"}</div></div>
              <div><div className="text-xs text-slate-500">Net P&amp;L</div><div className="text-sm font-semibold">{readiness.data.performance.net_pnl == null ? "—" : number(readiness.data.performance.net_pnl)}</div></div>
              <div><div className="text-xs text-slate-500">Max drawdown</div><div className="text-sm font-semibold">{readiness.data.performance.max_drawdown_pct == null ? "—" : readiness.data.performance.max_drawdown_pct + "%"}</div></div>
              <div><div className="text-xs text-slate-500">Brier score (approx.)</div><div className="text-sm font-semibold">{readiness.data.calibration.brier_score == null ? "—" : readiness.data.calibration.brier_score}</div></div>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Confidence calibration — displayed vs actual hit rate</div>
              <div className="mt-2 space-y-1">
                {readiness.data.calibration.reliability_curve.map((bucket) => <div key={bucket.confidence_bucket} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-slate-400">{bucket.confidence_bucket}%</span>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><span className="block h-full bg-cyan-500/60" style={{ width: `${bucket.confidence_midpoint}%` }} /></span>
                  <span className="w-14 shrink-0 text-slate-500">disp {bucket.confidence_midpoint}%</span>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><span className="block h-full bg-emerald-500/60" style={{ width: `${bucket.actual_hit_rate_pct ?? 0}%` }} /></span>
                  <span className="w-28 shrink-0 text-slate-500">actual {bucket.actual_hit_rate_pct == null ? "uncalibrated" : bucket.actual_hit_rate_pct + "%"} (n={bucket.sample_size})</span>
                </div>)}
              </div>
            </div>
            {!!readiness.data.known_limitations.length && <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Known limitations</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-400">
                {readiness.data.known_limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}
              </ul>
            </div>}
          </>}
        </div>
        <p className="text-xs text-amber-300">Capture: {report.data.collection_enabled ? "enabled" : "disabled"}; shadow engine: {report.data.shadow_enabled ? "enabled" : "disabled"}; sample storage: {report.data.sample_storage_ready ? "ready (scheduler must run)" : "migration pending"}. Old trades cannot recover uncaptured ticks or forecasts.</p>
        <div className="grid gap-3 sm:grid-cols-2">{(["primary", "shadow"] as const).map((kind) => {
          const stats = report.data.summary[kind];
          return <div key={kind} className="rounded-xl border border-slate-800 p-3 text-sm">{kind === "primary" ? "Original forecast" : "Unified shadow engine"}: {stats.correct}/{stats.evaluable} correct · {stats.accuracy_pct == null ? "Insufficient data (<30 evaluated live trades)" : `${stats.accuracy_pct}% observed accuracy`}</div>;
        })}</div>
        <p className="text-xs text-slate-400">Summary covers this page's live trades only, not overall accuracy. Paper data is marked synthetic. Funding/fee source must be checked before training on net-profit labels.</p>
        <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>
          {["Select", "Entry / signal", "Confidence", "Actual direction", "Gross / net", "Profit/Loss",
            // Part A3/A4 — the two predictions judged separately, plus what a
            // WAIT saved or missed. Deliberately their own columns beside the
            // existing ones rather than replacing them.
            "Direction pred.", "Direction correct", "Trade decision", "Decision correct", "WAIT saved/missed", "Override",
            "Direction match", "Horizon correct", "Async outcome", "Fee source", "Samples"].map((title) => <th key={title} className="p-2">{title}</th>)}
        </tr></thead><tbody>{report.data.rows.map((row) => <tr key={row.trade_id} className="border-t border-slate-800">
          <td className="p-2"><input type="checkbox" aria-label={`Select trade ${row.trade_id}`} checked={selected.includes(row.trade_id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, row.trade_id] : ids.filter((id) => id !== row.trade_id))} /></td>
          <td className="p-2"><button className="underline" onClick={() => setDetail(row)}>{new Date(row.entry_at).toLocaleString()} · {row.side}</button></td>
          <td className="p-2">{row.mode} · {row.prediction_direction ?? row.side}</td><td className="p-2">{number(row.prediction_confidence)}</td>
          <td className="p-2">{row.actual_trade_direction ?? "Unknown"}</td><td className="p-2">{number(row.gross_pnl)} / {number(row.net_pnl_booked)}</td>
          <td className={row.net_profit_positive === true ? "p-2 text-emerald-300" : row.net_profit_positive === false ? "p-2 text-rose-300" : "p-2"}>{row.trade_result ?? "Unknown"}</td>
          <td className="p-2">{row.direction_prediction?.value ?? "—"}</td>
          <td className={row.direction_correct === true ? "p-2 text-emerald-300" : row.direction_correct === false ? "p-2 text-rose-300" : "p-2 text-slate-500"}>
            {row.direction_evaluation_status === "not_applicable" ? "N/A (neutral)" : truth(row.direction_correct ?? null)}
          </td>
          <td className="p-2">
            {row.trade_decision_prediction?.value ?? "—"}
            {row.trade_decision_prediction?.gate_reason ? <span className="text-amber-400"> ({row.trade_decision_prediction.gate_reason})</span> : null}
          </td>
          <td className={row.trade_decision_correct === true ? "p-2 text-emerald-300" : row.trade_decision_correct === false ? "p-2 text-rose-300" : "p-2 text-slate-500"}>
            {row.trade_decision_evaluation_status === "not_applicable_wait" ? "N/A (wait)" : truth(row.trade_decision_correct ?? null)}
          </td>
          <td className="p-2">
            {row.wait_shadow?.status !== "evaluated"
              ? <span className="text-slate-500">{row.wait_shadow?.status ?? "—"}</span>
              : <>
                  <span className="text-emerald-300">{number(row.wait_shadow?.wait_saved_usdt)}</span>
                  {" / "}
                  <span className="text-rose-300">{number(row.wait_shadow?.wait_missed_usdt)}</span>
                </>}
          </td>
          <td className={row.manual_override === true ? "p-2 text-amber-300" : "p-2 text-slate-500"}>{truth(row.manual_override ?? null)}</td>
          <td className="p-2">{truth(row.direction_match_at_trade_exit)}</td><td className="p-2">{truth(row.prediction_horizon_direction_correct)}</td>
          <td className="p-2">{row.outcome_evaluation?.primary?.direction_correct == null ? (row.outcome_evaluation?.status ?? "pending") : truth(row.outcome_evaluation.primary.direction_correct)}</td>
          <td className="p-2">{row.fees.source}</td><td className="p-2">{row.data_quality.sample_count}</td>
        </tr>)}</tbody></table></div>
        {!report.data.rows.length && <p className="text-sm text-slate-400">No settled trades match these filters.</p>}
        {detail ? <section className="space-y-3 rounded-xl border border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Trade details — {detail.trade_id}</h3><Button variant="outline" onClick={() => setDetail(null)}>Close details</Button></div>
          <p className="text-xs">Gross: {number(detail.gross_pnl)} · Booked net: {number(detail.net_pnl_booked)} · Cost source: {detail.fees.source}. Quote PnL is gross, not a reconciled net balance.</p>
          <div className="max-h-80 overflow-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{["Time", "Observation", "Price", "Direction from entry", "Gross at quote"].map((heading) => <th key={heading} className="p-2">{heading}</th>)}</tr></thead>
            <tbody>{detail.timeline.map((point, index) => <tr key={index} className="border-t border-slate-800"><td className="p-2">{String(point.time ?? "Unknown")}</td><td className="p-2">{String(point.kind ?? "Unknown")}</td><td className="p-2">{number(point.price)}</td><td className="p-2">{String(point.direction_from_entry ?? "—")}</td><td className="p-2">{number(point.gross_pnl_at_quote)}</td></tr>)}</tbody></table></div>
          <details><summary className="cursor-pointer text-xs">Saved configuration, forecasts, costs and data quality</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ snapshot: detail.research_snapshot, fees: detail.fees, slippage: detail.slippage, primary: detail.primary_comparison, shadow: detail.shadow_comparison, quality: detail.data_quality }, null, 2)}</pre></details>
        </section> : null}
        <Button variant="outline" disabled={!report.data.has_more || report.isFetching || busy} onClick={() => { setAsOf(report.data.as_of); setCursor(report.data.next_cursor); setSelected([]); }}>Next page</Button>
      </>}
      <p className="text-xs text-slate-400">More platform analysis: <Link className="underline" to="/audit-research">Audit Research</Link>. This screen does not train or enable a live model.</p>
    </CardContent>
  </Card>;
});
