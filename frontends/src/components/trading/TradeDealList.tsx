import { formatDistanceToNowStrict } from "date-fns";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuickTradeRecord } from "@/hooks/useQuickTrade";

interface TradeDealListProps {
  title: string;
  trades: QuickTradeRecord[];
  emptyMessage: string;
}

export function TradeDealList({ title, trades, emptyMessage }: TradeDealListProps) {
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trades.length === 0 && <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">{emptyMessage}</div>}

        {trades.map((trade) => {
          const pnl = Number(trade.profit_loss || 0);
          const tone = pnl > 0 ? "text-emerald-300" : pnl < 0 ? "text-rose-300" : "text-slate-200";
          const cost = trade.signal_payload?.execution_cost;
          const fees = Number(cost?.total_fees ?? trade.fees_total ?? 0);
          const entrySlip = cost?.entry_slippage_pct == null ? null : Number(cost.entry_slippage_pct);
          const exitSlip = cost?.exit_slippage_pct == null ? null : Number(cost.exit_slippage_pct);
          const grossPnl = cost?.gross_pnl == null ? null : Number(cost.gross_pnl);

          return (
            <div key={trade.id} className="rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.98))] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-200">
                      {trade.source === "robot_trade" ? "Robot" : "Manual"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-200">
                      {String(trade.mode || "paper").toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-transparent",
                        trade.side === "buy" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                      )}
                    >
                      {trade.side.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-3 text-lg font-semibold">{trade.symbol.replaceAll("_", " ")}</div>
                  <div className="text-sm text-slate-400">
                    {trade.timeframe} / {trade.expiry_seconds}s expiry
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xl font-semibold", tone)}>
                    {pnl > 0 ? "+" : ""}
                    {pnl.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDistanceToNowStrict(new Date(trade.settled_at ?? trade.entry_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  {trade.side === "buy" ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> : <ArrowDownRight className="h-4 w-4 text-rose-300" />}
                  Stake ${Number(trade.stake_amount).toFixed(2)}
                </div>
                <div>{trade.status.toUpperCase()}</div>
              </div>

              {(fees > 0 || entrySlip !== null || exitSlip !== null || grossPnl !== null) && (
                <div className="mt-3 grid gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Fees</span>{" "}
                    <span className="font-medium text-slate-200">${fees.toFixed(4)}</span>
                  </div>
                  {grossPnl !== null && (
                    <div>
                      <span className="text-slate-500">Gross</span>{" "}
                      <span className={cn("font-medium", grossPnl >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        {grossPnl >= 0 ? "+" : ""}${grossPnl.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {entrySlip !== null && (
                    <div>
                      <span className="text-slate-500">Entry slip</span>{" "}
                      <span className={cn("font-medium", entrySlip <= 0 ? "text-emerald-300" : "text-amber-300")}>{entrySlip.toFixed(4)}%</span>
                    </div>
                  )}
                  {exitSlip !== null && (
                    <div>
                      <span className="text-slate-500">Exit slip</span>{" "}
                      <span className={cn("font-medium", exitSlip <= 0 ? "text-emerald-300" : "text-amber-300")}>{exitSlip.toFixed(4)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
