import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LedgerDecision {
  id: string;
  decision?: string | null;
  execution_status?: string | null;
  executed_price?: string | number | null;
  evaluated_price?: string | number | null;
  executed_qty?: string | number | null;
  computed_ratio?: string | number | null;
  reason?: string | null;
  executed_at?: string | null;
  decided_at?: string | null;
  metadata?: {
    staged_sell?: {
      stage_realized_pnl?: number | null;
      remaining_qty?: number | null;
      sell_tranches_remaining?: number | null;
    } | null;
  } | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function num(value?: string | number | null, digits = 6) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RatioBotTradeLedger({ decisions, quoteAsset = "USDT" }: { decisions: LedgerDecision[]; quoteAsset?: string }) {
  const fills = decisions.filter((d) => {
    const status = (d.execution_status || "").toLowerCase();
    const side = (d.decision || "").toUpperCase();
    return (side === "BUY" || side === "SELL") && (status === "filled" || status === "partially_filled");
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Ledger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fills.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No fills recorded yet.</div>
        ) : (
          fills.slice(0, 25).map((fill) => {
            const side = (fill.decision || "").toUpperCase();
            const price = num(fill.executed_price) ?? num(fill.evaluated_price);
            const qty = num(fill.executed_qty, 8);
            const staged = fill.metadata?.staged_sell;
            const stagePnl = staged?.stage_realized_pnl ?? null;

            return (
              <div key={fill.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {side === "BUY" ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                    )}
                    <Badge variant="outline" className={cn(side === "BUY" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                      {side}
                    </Badge>
                    {staged ? <Badge variant="secondary">staged</Badge> : null}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{price !== null ? price.toFixed(4) : "-"} {quoteAsset}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(fill.executed_at || fill.decided_at)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Qty {qty !== null ? qty : "-"}</span>
                  {stagePnl !== null ? (
                    <span className={cn("font-medium", stagePnl >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                      Stage P&L {stagePnl >= 0 ? "+" : ""}{Number(stagePnl).toFixed(4)} {quoteAsset}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
