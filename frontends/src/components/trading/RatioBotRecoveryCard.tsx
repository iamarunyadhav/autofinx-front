import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDateTime(value?: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function countdown(value?: string | null) {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Due now";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `in ~${minutes}m`;
  return `in ~${(minutes / 60).toFixed(1)}h`;
}

export interface RecoveryReviewOutcome {
  outcome?: string | null;
  reason?: string | null;
}

export interface RatioBotRecoveryCardProps {
  recoveryMode?: string | null;
  recoveryStartedAt?: string | null;
  recoveryReviewAt?: string | null;
  costBasis?: number | null;
  strategyAnchor?: string | null | number;
  lastReview?: RecoveryReviewOutcome | null;
  quoteAsset?: string;
}

/**
 * Only rendered while the bot is in RECOVERY_MONITORING / CASH_RECOVERY_MONITORING.
 * The NOTE line is deliberate — re-anchoring only ever moves the strategy
 * anchor, cost basis (used for real sell-trigger economics) never changes.
 */
export function RatioBotRecoveryCard({
  recoveryMode,
  recoveryStartedAt,
  recoveryReviewAt,
  costBasis,
  strategyAnchor,
  lastReview,
  quoteAsset = "USDT",
}: RatioBotRecoveryCardProps) {
  const isCashStuck = recoveryMode === "cash_stuck";

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Recovery Monitoring
        </CardTitle>
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-300">
          {isCashStuck ? "Cash stuck" : "Position stuck"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {isCashStuck
            ? "Fully sold and price kept rising past the old sell anchor. Watching for a new local pullback rather than chasing price."
            : "No profitable sell trigger for a while and the buy reserve is exhausted. The bot never force-sells at a loss — it waits and periodically reviews."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">Recovery started</div>
            <div className="font-medium">{formatDateTime(recoveryStartedAt)}</div>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">Next review</div>
            <div className="font-medium">
              {formatDateTime(recoveryReviewAt)}
              {countdown(recoveryReviewAt) ? <span className="ml-1 text-xs text-muted-foreground">({countdown(recoveryReviewAt)})</span> : null}
            </div>
          </div>
        </div>

        {!isCashStuck && costBasis ? (
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Position cost basis</span>
              <span className="font-medium">{Number(costBasis).toFixed(4)} {quoteAsset}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current strategy anchor</span>
              <span className="font-medium">{strategyAnchor ?? "None"}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Note: cost basis stays {Number(costBasis).toFixed(4)} {quoteAsset} regardless of any anchor change — a re-anchor can never turn a loss into a "fresh" profitable position.
            </p>
          </div>
        ) : null}

        {lastReview ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last review</span>
              <Badge variant="outline">{(lastReview.outcome || "").replace(/_/g, " ") || "unknown"}</Badge>
            </div>
            {lastReview.reason ? <p className="mt-1 text-xs text-muted-foreground">{lastReview.reason}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
