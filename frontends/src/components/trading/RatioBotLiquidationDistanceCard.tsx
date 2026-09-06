import { AlertTriangle, Anchor, ShieldAlert, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type DangerLevel = "safe" | "watch" | "critical";

interface LiquidationGuardPayload {
  applicable: boolean;
  buffer_pct: number | null;
  danger_level: DangerLevel;
  action: "none" | "block_new_entries" | "force_exit";
  reason: string;
  mark_price: number | null;
  liquidation_price: number | null;
  position_side: "long" | "short" | null;
  position_synced_at: string | null;
  watch_buffer_pct: number;
  critical_buffer_pct: number;
  exchange_stop_order: { order_id: string; stop_price: number | null } | null;
  estimated_funding_cost: number | null;
  last_funding_rate: number | null;
  shared_position: boolean;
  sibling_bots: Array<{ id: string; name: string }>;
  futures_recovery: {
    enabled: boolean;
    used: boolean;
    review_due_at: string | null;
    position_opened_at: string | null;
  };
}

function dangerBadgeClass(level: DangerLevel) {
  switch (level) {
    case "safe":
      return "bg-emerald-500/15 text-emerald-300";
    case "watch":
      return "bg-amber-500/15 text-amber-300";
    case "critical":
      return "bg-rose-500/15 text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function dangerIcon(level: DangerLevel) {
  switch (level) {
    case "safe":
      return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
    case "watch":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "critical":
      return <ShieldAlert className="h-5 w-5 text-rose-500" />;
    default:
      return null;
  }
}

function formatSyncedAt(value: string | null) {
  if (!value) return "Never synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `Synced ${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(date)}`;
}

/**
 * This does not eliminate liquidation risk -- it reduces it. A flash move
 * can still fill worse than expected, and this reads synced exchange data
 * on the ratio-bots:reconcile cadence, not a live tick-by-tick feed. Copy
 * on this card must never claim "protected" or "guaranteed".
 */
export function RatioBotLiquidationDistanceCard({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: ["ratio-bot-liquidation-guard", botId],
    queryFn: async () => {
      const response = await api.get<LiquidationGuardPayload>(`/ratio-bots/${botId}/liquidation-guard`);
      return response.data;
    },
    refetchInterval: 20000,
  });

  const guard = query.data;
  if (!guard || !guard.applicable) {
    return null;
  }

  return (
    <Card className={cn(guard.danger_level === "critical" ? "border-rose-500/40" : guard.danger_level === "watch" ? "border-amber-500/40" : undefined)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Liquidation Distance</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatSyncedAt(guard.position_synced_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {guard.shared_position ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Users className="h-3 w-3" />
              Shared with {guard.sibling_bots.map((s) => s.name).join(", ")}
            </Badge>
          ) : null}
          <Badge className={dangerBadgeClass(guard.danger_level)}>{guard.danger_level.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border px-3 py-2">
          {dangerIcon(guard.danger_level)}
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-semibold tabular-nums">
              {guard.buffer_pct !== null ? `${guard.buffer_pct.toFixed(2)}%` : "—"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">buffer to liquidation</span>
            </div>
            <div className="text-xs text-muted-foreground">{guard.reason}</div>
          </div>
        </div>

        {/* The single most important trust signal on this card: is Binance
            itself watching this position, not just our app. */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2",
            guard.exchange_stop_order ? "border-emerald-500/30 bg-emerald-500/5" : "border-dashed",
          )}
        >
          {guard.exchange_stop_order ? (
            <Anchor className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1 text-sm">
            {guard.exchange_stop_order ? (
              <>
                Exchange-side stop is live
                {guard.exchange_stop_order.stop_price !== null
                  ? ` at ${guard.exchange_stop_order.stop_price.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
                  : ""}
                <span className="ml-1 text-xs text-muted-foreground">(order #{guard.exchange_stop_order.order_id})</span>
              </>
            ) : (
              <span className="text-muted-foreground">No live exchange-side stop order for this position yet.</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Side</div>
            <div className="font-medium">{guard.position_side ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Mark price</div>
            <div className="font-medium tabular-nums">{guard.mark_price?.toLocaleString(undefined, { maximumFractionDigits: 8 }) ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Liquidation price</div>
            <div className="font-medium tabular-nums">{guard.liquidation_price?.toLocaleString(undefined, { maximumFractionDigits: 8 }) ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Watch / Critical</div>
            <div className="font-medium tabular-nums">
              {guard.watch_buffer_pct.toFixed(1)}% / {guard.critical_buffer_pct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Funding drag so far</div>
            <div className={cn("font-medium tabular-nums", (guard.estimated_funding_cost ?? 0) < 0 ? "text-rose-500" : undefined)}>
              {guard.estimated_funding_cost !== null ? guard.estimated_funding_cost.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last funding rate</div>
            <div className="font-medium tabular-nums">
              {guard.last_funding_rate !== null ? `${(guard.last_funding_rate * 100).toFixed(4)}%` : "—"}
            </div>
          </div>
        </div>

        {guard.futures_recovery.enabled ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <Anchor className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              Recovery:{" "}
              {guard.futures_recovery.used
                ? "one-time top-up already used for this position"
                : guard.futures_recovery.review_due_at
                  ? `next review due ${new Date(guard.futures_recovery.review_due_at).toLocaleTimeString()}`
                  : "not yet stuck long enough to review"}
            </span>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          This reduces liquidation risk -- it does not eliminate it. Data reflects the last exchange sync, not a live
          tick-by-tick feed, and a fast enough flash move can still fill worse than expected.
        </p>
      </CardContent>
    </Card>
  );
}
