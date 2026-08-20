import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StageStatus = "filled" | "armed" | "waiting";

interface Stage {
  label: string;
  status: StageStatus;
  detail?: string;
}

function statusBadgeClass(status: StageStatus) {
  if (status === "filled") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-transparent";
  if (status === "armed") return "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-transparent";
  return "bg-muted text-muted-foreground border-transparent";
}

function StageRow({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div>
        <div className="text-sm font-medium">{stage.label}</div>
        {stage.detail ? <div className="text-xs text-muted-foreground">{stage.detail}</div> : null}
      </div>
      <Badge className={cn(statusBadgeClass(stage.status))}>
        {stage.status === "filled" ? "Filled" : stage.status === "armed" ? "Armed / next" : "Waiting"}
      </Badge>
    </div>
  );
}

export interface RatioBotStageTrackerProps {
  buyTrancheCount: number;
  buyTranchesRemaining: number;
  buyStaged: boolean;
  hasOpenPosition: boolean;
  sellTrancheCount: number;
  sellTranchesRemaining: number;
  sellStaged: boolean;
  isPartiallySold: boolean;
}

/**
 * Visualizes staged BUY / staged SELL progress. RatioBotState only tracks
 * aggregate tranches-remaining (not a per-fill history), so this shows
 * "N of M stages filled" rather than reconstructing exact per-stage fills.
 */
export function RatioBotStageTracker({
  buyTrancheCount,
  buyTranchesRemaining,
  buyStaged,
  hasOpenPosition,
  sellTrancheCount,
  sellTranchesRemaining,
  sellStaged,
  isPartiallySold,
}: RatioBotStageTrackerProps) {
  const buyStages: Stage[] = [];
  if (buyStaged) {
    const totalBuyStages = buyTrancheCount + 1;
    const filledBuyStages = hasOpenPosition ? totalBuyStages - buyTranchesRemaining : 0;
    for (let i = 1; i <= totalBuyStages; i++) {
      buyStages.push({
        label: `BUY stage ${i}`,
        status: i <= filledBuyStages ? "filled" : i === filledBuyStages + 1 && hasOpenPosition ? "armed" : "waiting",
        detail: i === 1 ? "Initial entry" : `Reserve tranche ${i - 1}`,
      });
    }
  } else {
    buyStages.push({
      label: "BUY (single shot)",
      status: hasOpenPosition ? "filled" : "waiting",
      detail: "Staged reserve is off — 100% deploys on the first buy",
    });
  }

  const sellStages: Stage[] = [];
  if (sellStaged) {
    const totalSellStages = sellTrancheCount + 1;
    const filledSellStages = isPartiallySold ? totalSellStages - sellTranchesRemaining : 0;
    for (let i = 1; i <= totalSellStages; i++) {
      sellStages.push({
        label: `SELL stage ${i}`,
        status: i <= filledSellStages ? "filled" : i === filledSellStages + 1 && hasOpenPosition ? "armed" : "waiting",
        detail: i === totalSellStages ? "Final stage — closes the position" : `Partial exit ${i}`,
      });
    }
  } else {
    sellStages.push({
      label: "SELL (single shot)",
      status: "waiting",
      detail: "Staged exit is off — a sell trigger closes the full position at once",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage Tracker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buy stages</div>
          {buyStages.map((stage) => (
            <StageRow key={stage.label} stage={stage} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sell stages</div>
          {sellStages.map((stage) => (
            <StageRow key={stage.label} stage={stage} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
