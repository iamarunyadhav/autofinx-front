import { PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface RecoverySlotEvent {
  id: string;
  event_type: string;
  context: Record<string, unknown> | null;
  occurred_at: string | null;
}

interface RecoverySlotPayload {
  bot_id: string;
  bot_name: string;
  symbol: string;
  quote_asset: string;
  base_asset: string;
  enabled: boolean;
  allocation_pct: number;
  target_pct: number;
  quote_balance: number;
  base_balance: number;
  quote_equivalent_total: number;
  target_cap_quote_equiv: number | null;
  last_topped_up_at: string | null;
  last_used_at: string | null;
  recent_events: RecoverySlotEvent[];
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function prettyEventType(eventType: string) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * "{Bot name} — Recovery Slot" heading is deliberate (not just "Recovery
 * Slot") -- this repo's stale-feed-breaker incident happened partly because
 * ambiguous scope was easy to misread, so every element here names the bot
 * explicitly rather than relying on page context alone. This is a standing,
 * cross-cycle balance -- distinct from the per-cycle Recovery Reserve shown
 * in the V2 Config tab -- so it gets its own clearly-labeled card, never
 * merged into that one.
 */
export function RatioBotRecoverySlotCard({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: ["ratio-bot-recovery-slot", botId],
    queryFn: async () => {
      const response = await api.get<RecoverySlotPayload>(`/ratio-bots/${botId}/recovery-slot`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  const slot = query.data;
  if (!slot || !slot.enabled) {
    return null;
  }

  const cap = slot.target_cap_quote_equiv;
  const progressPct = cap && cap > 0 ? Math.min(100, (slot.quote_equivalent_total / cap) * 100) : 0;
  const atCap = cap !== null && cap > 0 && slot.quote_equivalent_total >= cap;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>
            {slot.bot_name} ({slot.symbol}) — Recovery Slot
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Standing balance, skimmed across cycles — not the per-cycle Recovery Reserve.</p>
        </div>
        <Badge className={atCap ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}>
          {atCap ? "At cap" : "Accumulating"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border px-3 py-2">
          <PiggyBank className="h-5 w-5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-semibold tabular-nums">
              {slot.quote_equivalent_total.toLocaleString(undefined, { maximumFractionDigits: 4 })} {slot.quote_asset}
              {cap !== null ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  of {cap.toLocaleString(undefined, { maximumFractionDigits: 4 })} cap
                </span>
              ) : null}
            </div>
            {cap !== null && cap > 0 ? <Progress value={progressPct} className="mt-2 h-1.5" /> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Quote balance</div>
            <div className="font-medium tabular-nums">
              {slot.quote_balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {slot.quote_asset}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Base balance</div>
            <div className="font-medium tabular-nums">
              {slot.base_balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} {slot.base_asset}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Allocation %</div>
            <div className="font-medium tabular-nums">{slot.allocation_pct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Target cap</div>
            <div className="font-medium tabular-nums">{slot.target_pct.toFixed(1)}% of trade size</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Last topped up</div>
            <div className="font-medium">{formatTimestamp(slot.last_topped_up_at)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last used</div>
            <div className="font-medium">{formatTimestamp(slot.last_used_at)}</div>
          </div>
        </div>

        {slot.recent_events.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Recent activity</div>
            <div className="space-y-1">
              {slot.recent_events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                  <span>{prettyEventType(event.event_type)}</span>
                  <span className="text-muted-foreground">{formatTimestamp(event.occurred_at)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
