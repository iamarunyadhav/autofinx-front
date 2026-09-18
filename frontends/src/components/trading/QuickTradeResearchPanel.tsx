import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  timeline: Array<Record<string, unknown>>;
  research_snapshot: Record<string, unknown> | null;
  slippage: Record<string, unknown>;
  data_quality: { sample_count: number; price_history: string; training_eligible: boolean };
};
type ResearchResponse = {
  as_of: string; rows: ResearchRow[]; next_cursor: string | null; has_more: boolean;
  sample_storage_ready: boolean; collection_enabled: boolean; shadow_enabled: boolean; shadow_only: boolean;
  summary: Record<"primary" | "shadow", { evaluable: number; correct: number; accuracy_pct: number | null; status: string }>;
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
export const QuickTradeResearchPanel = memo(function QuickTradeResearchPanel({ workspaceId, symbol }: { workspaceId?: string; symbol: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchRow | null>(null);
  const filters = { symbol, from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined };
  const report = useQuery({
    queryKey: ["quick-trade-research", workspaceId, symbol, from, to, cursor, asOf],
    queryFn: () => authorizedFetch(`/workspaces/${workspaceId}/quick-trades/research`, "GET", undefined,
      { params: { ...filters, cursor, as_of: asOf, limit: 50 } }) as Promise<ResearchResponse>,
    enabled: !!workspaceId, refetchInterval: 30000,
  });
  const reset = () => { setCursor(null); setAsOf(null); setSelected([]); setDetail(null); };

  async function exportData(format: "json" | "summary" | "timeline", selectedOnly: boolean) {
    if (!workspaceId) return;
    setBusy(true); setMessage("Preparing export…");
    try {
      const all: ResearchRow[] = [];
      let next: string | null = null;
      let cutoff: string | null = null;
      const seen = new Set<string>();
      do {
        const page = await authorizedFetch(`/workspaces/${workspaceId}/quick-trades/research/export`, "POST", {
          ...filters, trade_ids: selectedOnly ? selected : undefined, cursor: next, as_of: cutoff, limit: 100,
        }) as ResearchResponse;
        for (const row of page.rows) if (!seen.has(row.trade_id)) { all.push(row); seen.add(row.trade_id); }
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
        note: "Direction accuracy and net-profit accuracy are separate. Unknown data is excluded, never counted as false." };
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
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void exportData("json", false)}>Export all matching — full JSON</Button>
        <Button variant="outline" disabled={busy || !selected.length} onClick={() => void exportData("json", true)}>Export selected ({selected.length})</Button>
        <Button variant="outline" disabled={busy} onClick={() => void exportData("summary", false)}>Trade table CSV</Button>
        <Button variant="outline" disabled={busy} onClick={() => void exportData("timeline", false)}>Price timeline CSV</Button>
      </div>
      {message && <p className="text-xs" role="status">{message}</p>}
      {report.isError && <p role="alert" className="text-rose-300">{report.error instanceof Error ? report.error.message : "Analysis unavailable"}</p>}
      {report.data && <>
        <p className="text-xs text-amber-300">Capture: {report.data.collection_enabled ? "enabled" : "disabled"}; shadow engine: {report.data.shadow_enabled ? "enabled" : "disabled"}; sample storage: {report.data.sample_storage_ready ? "ready (scheduler must run)" : "migration pending"}. Old trades cannot recover uncaptured ticks or forecasts.</p>
        <div className="grid gap-3 sm:grid-cols-2">{(["primary", "shadow"] as const).map((kind) => {
          const stats = report.data.summary[kind];
          return <div key={kind} className="rounded-xl border border-slate-800 p-3 text-sm">{kind === "primary" ? "Original forecast" : "Unified shadow engine"}: {stats.correct}/{stats.evaluable} correct · {stats.accuracy_pct == null ? "Insufficient data (<30 evaluated live trades)" : `${stats.accuracy_pct}% observed accuracy`}</div>;
        })}</div>
        <p className="text-xs text-slate-400">Summary covers this page's live trades only, not overall accuracy. Paper data is marked synthetic. Funding/fee source must be checked before training on net-profit labels.</p>
        <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>
          {["Select", "Entry / signal", "Confidence", "Actual direction", "Gross / net", "Profit/Loss", "Direction match", "Horizon correct", "Fee source", "Samples"].map((title) => <th key={title} className="p-2">{title}</th>)}
        </tr></thead><tbody>{report.data.rows.map((row) => <tr key={row.trade_id} className="border-t border-slate-800">
          <td className="p-2"><input type="checkbox" aria-label={`Select trade ${row.trade_id}`} checked={selected.includes(row.trade_id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, row.trade_id] : ids.filter((id) => id !== row.trade_id))} /></td>
          <td className="p-2"><button className="underline" onClick={() => setDetail(row)}>{new Date(row.entry_at).toLocaleString()} · {row.side}</button></td>
          <td className="p-2">{row.mode} · {row.prediction_direction ?? row.side}</td><td className="p-2">{number(row.prediction_confidence)}</td>
          <td className="p-2">{row.actual_trade_direction ?? "Unknown"}</td><td className="p-2">{number(row.gross_pnl)} / {number(row.net_pnl_booked)}</td>
          <td className={row.net_profit_positive === true ? "p-2 text-emerald-300" : row.net_profit_positive === false ? "p-2 text-rose-300" : "p-2"}>{row.trade_result ?? "Unknown"}</td>
          <td className="p-2">{truth(row.direction_match_at_trade_exit)}</td><td className="p-2">{truth(row.prediction_horizon_direction_correct)}</td>
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
