import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

// Hand-written to match the real Laravel payload of
// GET /ratio-bots/{id}/trade-accuracy (RatioBotTradeOutcomeController /
// RatioBotTradeOutcomeService::summary()/presentRow()) -- not a Supabase type.
interface StatusCounts {
  captured: number;
  pending: number;
  evaluated: number;
  insufficient_data: number;
  not_applicable: number;
  status: "observed_sample" | "insufficient_data";
}

interface BuySummary extends StatusCounts {
  good_count: number;
  bad_count: number;
  good_pct: number | null;
  avg_best_net_edge_pct: number | null;
  avg_max_adverse_pct: number | null;
}

interface SellSummary extends StatusCounts {
  well_timed_count: number;
  sold_early_count: number;
  well_timed_pct: number | null;
  avg_missed_edge_pct: number | null;
  avg_avoided_drawdown_pct: number | null;
  realized_evaluated: number;
  net_profitable_count: number;
  net_profitable_pct: number | null;
  avg_realized_net_pct: number | null;
  protective_exit_count: number;
}

interface OutcomeRow {
  id: string;
  side: "BUY" | "SELL";
  stage_index: number | null;
  is_recovery_lot: boolean;
  protective_exit: boolean;
  executed_price: number;
  executed_at: string | null;
  evaluation_status: "pending" | "evaluated" | "insufficient_data" | "not_applicable";
  status_reason: string | null;
  verdict: string | null;
  decision_correct: boolean | null;
  best_net_edge_ratio: number | null;
  missed_edge_ratio: number | null;
  realized_net_ratio: number | null;
  window_ends_at: string | null;
}

interface TradeAccuracyPayload {
  bot_id: string;
  symbol: string;
  summary: {
    buy: BuySummary;
    sell: SellSummary;
    min_samples_for_accuracy: number;
    buy_horizon_hours: number;
    sell_lookahead_hours: number;
    note: string;
  };
  recent: OutcomeRow[];
}

function pct(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function ratioPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(3)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function prettyLabel(value: string | null) {
  if (!value) return "—";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function accuracyLine(value: number | null, evaluated: number, minSamples: number) {
  if (value !== null) return pct(value);
  return `Insufficient data (${evaluated}/${minSamples})`;
}

function rowBadge(row: OutcomeRow) {
  if (row.evaluation_status !== "evaluated") {
    return <Badge variant="outline">{prettyLabel(row.evaluation_status)}</Badge>;
  }
  return <Badge variant={row.decision_correct ? "success" : "destructive"}>{prettyLabel(row.verdict)}</Badge>;
}

/**
 * Read-only, observation-only trade accuracy: was each real BUY fill net
 * profitable within its bounded horizon, and was each SELL well timed vs
 * what followed. Every number comes straight from the backend; unknowns are
 * shown as "—" / pending / insufficient data, never guessed.
 */
export function RatioBotTradeAccuracyCard({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: ["ratio-bot-trade-accuracy", botId],
    queryFn: async () => {
      const response = await api.get<TradeAccuracyPayload>(`/ratio-bots/${botId}/trade-accuracy`, { params: { limit: 15 } });
      return response.data;
    },
    refetchInterval: 60000,
  });

  const data = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Trade Accuracy{data ? ` (${data.symbol})` : ""}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Hindsight scoring of real fills only (synthetic anchors excluded). BUY is good if price reached the lot&apos;s net-of-cost
          profit floor within {data ? data.summary.buy_horizon_hours : "—"}h; SELL is well timed if the next{" "}
          {data ? data.summary.sell_lookahead_hours : "—"}h never rose more than one round-trip cost above the sell. Observation only — never used by
          trading decisions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError ? <p className="text-sm text-muted-foreground">Trade accuracy is unavailable right now.</p> : null}
        {!data && !query.isError ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="font-medium">BUY decisions</div>
                <div>Good: {accuracyLine(data.summary.buy.good_pct, data.summary.buy.evaluated, data.summary.min_samples_for_accuracy)}</div>
                <div className="text-muted-foreground">
                  {data.summary.buy.good_count} good / {data.summary.buy.bad_count} not recovered · {data.summary.buy.pending} pending ·{" "}
                  {data.summary.buy.insufficient_data} insufficient data
                </div>
                <div className="text-muted-foreground">
                  Avg best net edge {pct(data.summary.buy.avg_best_net_edge_pct, 3)} · avg max adverse {pct(data.summary.buy.avg_max_adverse_pct, 3)}
                </div>
              </div>
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="font-medium">SELL decisions</div>
                <div>Well timed: {accuracyLine(data.summary.sell.well_timed_pct, data.summary.sell.evaluated, data.summary.min_samples_for_accuracy)}</div>
                <div className="text-muted-foreground">
                  {data.summary.sell.well_timed_count} well timed / {data.summary.sell.sold_early_count} sold early · {data.summary.sell.pending} pending ·{" "}
                  {data.summary.sell.insufficient_data} insufficient data
                </div>
                <div className="text-muted-foreground">
                  Net profitable {accuracyLine(data.summary.sell.net_profitable_pct, data.summary.sell.realized_evaluated, data.summary.min_samples_for_accuracy)} · avg
                  missed edge {pct(data.summary.sell.avg_missed_edge_pct, 3)}
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Side</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Filled</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Edge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.side}
                      {row.stage_index ? ` S${row.stage_index}` : ""}
                      {row.is_recovery_lot ? " (recovery)" : ""}
                      {row.protective_exit ? " (protective)" : ""}
                    </TableCell>
                    <TableCell>{row.executed_price}</TableCell>
                    <TableCell>{formatTimestamp(row.executed_at)}</TableCell>
                    <TableCell>
                      {rowBadge(row)}
                      {row.evaluation_status === "pending" ? (
                        <div className="text-xs text-muted-foreground">window ends {formatTimestamp(row.window_ends_at)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.side === "BUY" ? `best net ${ratioPct(row.best_net_edge_ratio)}` : `missed ${ratioPct(row.missed_edge_ratio)}`}
                      {row.side === "SELL" ? <div className="text-xs text-muted-foreground">realized net {ratioPct(row.realized_net_ratio)}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
                {data.recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No scored fills yet — rows appear after the next real BUY/SELL fill.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
