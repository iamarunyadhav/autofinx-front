import { Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFutureTradeAiGate } from "@/hooks/useFutureTradeAiGate";
import { cn } from "@/lib/utils";

const decisionBadgeClass = (decision: string): string => {
  switch (decision) {
    case "CONFIRM":
      return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    case "RESIZE":
      return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    case "VETO":
      return "bg-red-500/15 text-red-500 border-red-500/30";
    case "SKIPPED_CAP":
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    default:
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  }
};

const outcomeBadgeClass = (outcome: string | null): string => {
  if (outcome === "win") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (outcome === "loss") return "bg-red-500/15 text-red-500 border-red-500/30";
  return "bg-slate-500/15 text-slate-400 border-slate-500/30";
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function FutureTradeAiGatePanel({ workspaceId }: { workspaceId?: string }) {
  const { decisions, stats, reviews } = useFutureTradeAiGate(workspaceId);
  const rows = decisions.data?.data ?? [];
  const s = stats.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          AI Confirmation Gate (Claude)
          {s && s.total_decisions > 0 ? (
            <Badge variant="outline" className="ml-2 text-xs">
              {s.calls_today}/{s.daily_call_cap} calls today · ${s.today_cost_usd.toFixed(2)}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="decisions" className="space-y-3">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="decisions">Decisions</TabsTrigger>
            <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
            <TabsTrigger value="reviews">Daily Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="m-0">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No AI decisions yet. Enable <code className="mx-1 rounded bg-muted px-1">aiGateEnabled</code>
                on this bot (env <code className="mx-1 rounded bg-muted px-1">FUTURE_TRADE_AI_GATE_ENABLED=true</code>)
                and send a TradingView signal — every CONFIRM / VETO / RESIZE will appear here.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>AI conf</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Reasoning</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{row.symbol}</TableCell>
                        <TableCell>
                          <span className={cn("text-xs font-semibold", row.side === "LONG" ? "text-emerald-500" : "text-red-500")}>
                            {row.side}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", decisionBadgeClass(row.decision))}>
                            {row.decision}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.ai_confidence !== null ? `${Math.round(row.ai_confidence * 100)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.size_multiplier !== null && row.size_multiplier > 0 ? `${Math.round(row.size_multiplier * 100)}%` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                          <span title={row.reasoning ?? undefined}>
                            {row.reasoning ? (row.reasoning.length > 110 ? `${row.reasoning.slice(0, 110)}…` : row.reasoning) : row.error ?? "—"}
                          </span>
                          {row.risk_flags?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.risk_flags.slice(0, 4).map((flag) => (
                                <Badge key={flag} variant="outline" className="text-[9px] text-muted-foreground">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.latency_ms !== null ? `${row.latency_ms}ms` : "—"}
                          {row.cache_hit ? <span className="ml-1 text-emerald-500" title="Prompt cache hit">⚡</span> : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.cost_usd !== null ? `$${row.cost_usd.toFixed(4)}` : "—"}
                        </TableCell>
                        <TableCell>
                          {row.outcome ? (
                            <Badge variant="outline" className={cn("text-[10px]", outcomeBadgeClass(row.outcome))}>
                              {row.outcome}
                              {row.outcome_pnl !== null ? ` ${row.outcome_pnl >= 0 ? "+" : ""}${row.outcome_pnl.toFixed(2)}` : ""}
                            </Badge>
                          ) : row.executed ? (
                            <span className="text-[10px] text-muted-foreground">open</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="accuracy" className="m-0">
            {!s || s.total_decisions === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Accuracy stats appear after the first AI-reviewed signals close.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label={`Decisions (${s.window_days}d)`} value={String(s.total_decisions)} hint={`${s.executed} executed`} />
                <StatTile
                  label="Confirm win-rate"
                  value={s.confirmed_win_rate !== null ? `${Math.round(s.confirmed_win_rate * 100)}%` : "—"}
                  hint={`${s.confirmed_with_outcome} closed trades`}
                />
                <StatTile
                  label="Confirmed net PnL"
                  value={`${s.confirmed_net_pnl_usdt >= 0 ? "+" : ""}${s.confirmed_net_pnl_usdt.toFixed(2)} USDT`}
                />
                <StatTile label="Vetoed signals" value={String(s.vetoed)} hint={`${s.resized} resized`} />
                <StatTile
                  label="Avg AI confidence"
                  value={s.avg_ai_confidence !== null ? `${Math.round(s.avg_ai_confidence * 100)}%` : "—"}
                />
                <StatTile label="Avg latency" value={s.avg_latency_ms !== null ? `${s.avg_latency_ms}ms` : "—"} />
                <StatTile
                  label="Cache hit-rate"
                  value={s.cache_hit_rate !== null ? `${Math.round(s.cache_hit_rate * 100)}%` : "—"}
                  hint="prompt caching"
                />
                <StatTile label={`Cost (${s.window_days}d)`} value={`$${s.total_cost_usd.toFixed(2)}`} hint={`today $${s.today_cost_usd.toFixed(2)}`} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="m-0 space-y-3">
            {(reviews.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                The daily review job (00:15 UTC) analyzes each day's AI decisions vs outcomes and posts an advisory
                report here. Suggestions are never auto-applied.
              </div>
            ) : (
              (reviews.data ?? []).map((review) => (
                <div key={review.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">{review.review_date}</div>
                    <div className="text-xs text-muted-foreground">{review.ai_model ?? ""}</div>
                  </div>
                  {review.error ? (
                    <div className="text-xs text-red-500">Review failed: {review.error}</div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{review.report?.summary ?? "—"}</p>
                      {review.report?.what_worked?.length ? (
                        <div className="mt-2 text-xs">
                          <span className="font-medium text-emerald-500">Worked:</span>{" "}
                          {review.report.what_worked.join(" · ")}
                        </div>
                      ) : null}
                      {review.report?.what_failed?.length ? (
                        <div className="mt-1 text-xs">
                          <span className="font-medium text-red-500">Failed:</span>{" "}
                          {review.report.what_failed.join(" · ")}
                        </div>
                      ) : null}
                      {review.report?.suggested_threshold_changes?.length ? (
                        <div className="mt-1 text-xs">
                          <span className="font-medium text-amber-500">Suggestions (advisory):</span>{" "}
                          {review.report.suggested_threshold_changes.join(" · ")}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
