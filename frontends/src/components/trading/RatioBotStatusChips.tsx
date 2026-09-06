import { Anchor, Clock, Coins, Landmark, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MarketHoursStatus {
  applicable: boolean;
  is_open: boolean;
  reason: string;
  resumes_at: string | null;
  timezone: string | null;
}

function assetClassBadgeClass(assetClass: string) {
  switch (assetClass) {
    case "CRYPTO":
      return "bg-amber-500/15 text-amber-300";
    case "FOREX":
      return "bg-sky-500/15 text-sky-300";
    case "METALS":
      return "bg-zinc-500/15 text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function positionStateBadgeClass(state: string) {
  if (state.includes("recovery")) return "bg-amber-500/15 text-amber-300";
  if (state === "holding" || state === "partial_holding" || state === "partial_sold") return "bg-emerald-500/15 text-emerald-300";
  if (state === "paused" || state === "blocked") return "bg-rose-500/15 text-rose-300";
  return "bg-muted text-muted-foreground";
}

function formatResumesAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/**
 * Rich, at-a-glance status row for a single bot -- asset class, provider,
 * paper/live mode, market-hours (forex/metals only -- omitted entirely for
 * crypto), position state, and a recovery-average-lot indicator (Part B's
 * merged recovery lot) when this position has used it. Purely
 * presentational: every field arrives as a prop, data-fetching stays owned
 * by the page (same pattern as RatioBotStartupChecklist).
 */
export function RatioBotStatusChips({
  assetClass,
  exchange,
  executionMode,
  positionState,
  marketHours,
  hasRecoveryAverageLot,
}: {
  assetClass?: string | null;
  exchange?: string | null;
  executionMode?: string | null;
  positionState?: string | null;
  marketHours?: MarketHoursStatus | null;
  hasRecoveryAverageLot?: boolean;
}) {
  const resolvedAssetClass = (assetClass || "CRYPTO").toUpperCase();
  const resolvedState = (positionState || "idle").toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={cn("gap-1", assetClassBadgeClass(resolvedAssetClass))}>
        <Coins className="h-3 w-3" />
        {resolvedAssetClass}
      </Badge>

      {exchange ? (
        <Badge variant="outline" className="gap-1">
          <Landmark className="h-3 w-3" />
          {exchange}
        </Badge>
      ) : null}

      <Badge variant="outline" className="gap-1">
        <Radio className="h-3 w-3" />
        {executionMode === "live" ? "Live" : executionMode === "sandbox" ? "Paper" : (executionMode ?? "—")}
      </Badge>

      {marketHours && marketHours.applicable ? (
        <Badge className={cn("gap-1", marketHours.is_open ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
          <Clock className="h-3 w-3" />
          {marketHours.is_open
            ? "Market open"
            : `Market closed${marketHours.resumes_at ? `, resumes ${formatResumesAt(marketHours.resumes_at)}` : ""}`}
        </Badge>
      ) : null}

      <Badge variant="outline" className={cn("capitalize", positionStateBadgeClass(resolvedState))}>
        {resolvedState.replace(/_/g, " ")}
      </Badge>

      {hasRecoveryAverageLot ? (
        <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-300">
          <Anchor className="h-3 w-3" />
          Recovery-average lot active
        </Badge>
      ) : null}
    </div>
  );
}
