import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StrategyManagerSnapshot {
  regime?: string | null;
  regime_reason?: string | null;
  reserve?: {
    mode?: string | null;
    base_pct?: number | null;
    min_pct?: number | null;
    max_pct?: number | null;
    effective_pct?: number | null;
    reason?: string | null;
  } | null;
}

const REGIME_TONE: Record<string, string> = {
  STRONG_UPTREND: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  WEAK_UPTREND: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  STRONG_DOWNTREND: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  WEAK_DOWNTREND: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  RANGE: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  HIGH_VOLATILITY: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  LOW_LIQUIDITY: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  UNCERTAIN: "bg-muted text-muted-foreground",
};

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Reads directly from the latest RatioBotDecision.metadata.audit.strategy_manager
 * (stashed there by RatioBotDecisionService::applyStrategyManagerOverrides()) —
 * no separate backend endpoint needed.
 */
export function RatioBotStrategyManagerCard({ snapshot }: { snapshot: StrategyManagerSnapshot | null | undefined }) {
  const regime = snapshot?.regime || null;
  const reserve = snapshot?.reserve || null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Strategy Manager</CardTitle>
        {regime ? (
          <Badge className={REGIME_TONE[regime] || "bg-muted text-muted-foreground"}>{regime.replace(/_/g, " ")}</Badge>
        ) : (
          <Badge variant="outline">not yet evaluated</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {snapshot?.regime_reason ? (
          <p className="text-xs text-muted-foreground">{snapshot.regime_reason}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            V2 regime classification appears here after the bot's next evaluation cycle.
          </p>
        )}

        {reserve ? (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reserve manager</span>
              <Badge variant="outline">{reserve.mode || "manual"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Min</div>
                <div className="font-medium">{pct(reserve.min_pct)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Effective</div>
                <div className="font-semibold text-foreground">{pct(reserve.effective_pct)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Max</div>
                <div className="font-medium">{pct(reserve.max_pct)}</div>
              </div>
            </div>
            {reserve.reason ? <p className="text-[11px] text-muted-foreground">{reserve.reason}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
