import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function fmtPrice(value?: number | string | null) {
  const n = value === null || value === undefined ? NaN : Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtPct(ratio?: number | string | null) {
  const n = ratio === null || ratio === undefined ? NaN : Number(ratio);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

export interface RatioBotReversalWatchProps {
  /** Which watch is currently active. Null/undefined hides the card entirely. */
  side?: "BUY" | "SELL" | null;
  /** True once armed (eligibility crossed, actively tracking low/high). */
  armed?: boolean | null;
  stageLabel?: string | null;
  /** BUY: anchor price the drop% is measured from. SELL: the lot's fill price. */
  anchorPrice?: number | string | null;
  /** BUY: the tracked low price. SELL: the tracked high price. */
  extremePrice?: number | string | null;
  /** BUY: rebound-from-trough ratio. SELL: pullback-from-peak ratio. */
  progressRatio?: number | string | null;
  /** The ratio progressRatio must reach to confirm (buying_loss_ratio / selling_loss_ratio). */
  requiredRatio?: number | string | null;
  reason?: string | null;
}

/**
 * "Never buy/sell simply because eligibility was hit" (spec §9-11, §21-22),
 * made visible: shows the live low/high being tracked and how close the
 * rebound/pullback is to confirming a real reversal, for normal Stage 1-3 —
 * the same shape RatioBotRecoveryCard already gives Stage 4, just for the
 * everyday stages. Only rendered while a watch is actually armed.
 */
export function RatioBotReversalWatchCard({
  side,
  armed,
  stageLabel,
  anchorPrice,
  extremePrice,
  progressRatio,
  requiredRatio,
  reason,
}: RatioBotReversalWatchProps) {
  if (!side || !armed) {
    return null;
  }

  const isBuy = side === "BUY";
  const progress = Number(progressRatio ?? 0);
  const required = Number(requiredRatio ?? 0);
  const progressPct = required > 0 ? Math.max(0, Math.min(100, (progress / required) * 100)) : 0;

  return (
    <Card className={isBuy ? "border-emerald-500/40" : "border-sky-500/40"}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {isBuy ? <ArrowDownRight className="h-4 w-4 text-emerald-500" /> : <ArrowUpRight className="h-4 w-4 text-sky-500" />}
          {isBuy ? "Tracking Low" : "Tracking High"}
        </CardTitle>
        <Badge className={isBuy ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-sky-500/10 text-sky-600 dark:text-sky-300"}>
          {stageLabel || (isBuy ? "BUY watch" : "SELL watch")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {isBuy
            ? "Price fell past the eligible drop — never buying on eligibility alone. Waiting for a confirmed rebound from the tracked low."
            : "Price rose past the eligible rise — never selling on eligibility alone. Waiting for a confirmed pullback from the tracked high."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">{isBuy ? "Reference (anchor)" : "Lot fill price"}</div>
            <div className="font-medium">{fmtPrice(anchorPrice)}</div>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">{isBuy ? "Observed low" : "Observed high"}</div>
            <div className="font-medium">{fmtPrice(extremePrice)}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {isBuy ? "Rebound from low" : "Pullback from high"}
            </span>
            <span>
              {fmtPct(progress)} / {fmtPct(required)} required
            </span>
          </div>
          <Progress value={progressPct} />
        </div>

        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </CardContent>
    </Card>
  );
}
