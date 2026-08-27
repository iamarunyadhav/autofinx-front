import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LotRecord {
  id: string;
  stage?: number | null;
  lot_type?: "NORMAL" | "RECOVERY" | string | null;
  buy_price?: number | null;
  original_qty?: number | null;
  remaining_qty?: number | null;
  allocation_pct?: number | null;
  status?: "open" | "closed" | string | null;
  realized_pnl?: number | null;
  bought_at?: string | null;
  closed_at?: string | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function num(value?: number | null, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

/**
 * Per-lot cost-basis ledger (spec §17/§57) — every BUY becomes its own lot
 * with its own price/qty/status, including the Stage 4 Recovery lot tagged
 * distinctly from normal Stage 1-3 lots. Backed by GET /ratio-bots/{id}/lots.
 */
export function RatioBotLotList({ lots, quoteAsset = "USDT" }: { lots: LotRecord[]; quoteAsset?: string }) {
  const sorted = [...lots].sort((a, b) => {
    const aTime = a.bought_at ? new Date(a.bought_at).getTime() : 0;
    const bTime = b.bought_at ? new Date(b.bought_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Lots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No lots recorded yet.</div>
        ) : (
          sorted.slice(0, 25).map((lot) => {
            const isRecovery = (lot.lot_type || "NORMAL").toUpperCase() === "RECOVERY";
            const isOpen = (lot.status || "").toLowerCase() === "open";
            const pnl = lot.realized_pnl ?? null;

            return (
              <div key={lot.id} className={cn("rounded-xl border p-3", isRecovery ? "border-amber-500/40 bg-amber-500/5" : "border-border/60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{isRecovery ? "RECOVERY" : `Stage ${lot.stage ?? "?"}`}</Badge>
                    <Badge variant={isOpen ? "secondary" : "outline"}>{isOpen ? "OPEN" : "CLOSED"}</Badge>
                    {lot.allocation_pct !== null && lot.allocation_pct !== undefined ? (
                      <span className="text-xs text-muted-foreground">{Number(lot.allocation_pct).toFixed(1)}%</span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{num(lot.buy_price, 4) ?? "-"} {quoteAsset}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(lot.bought_at)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Qty {num(lot.remaining_qty, 8) ?? "-"} / {num(lot.original_qty, 8) ?? "-"}
                  </span>
                  {pnl !== null ? (
                    <span className={cn("font-medium", pnl >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                      Realized {pnl >= 0 ? "+" : ""}{Number(pnl).toFixed(4)} {quoteAsset}
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
