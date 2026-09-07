import { AlertOctagon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TrendWindowScore {
  key: string;
  label: string;
  weight: number;
  score: number;
  direction: string;
}

interface TrendScoreBreakdown {
  direction: string;
  composite_score: number;
  windows?: TrendWindowScore[];
}

interface PortfolioGuardResult {
  allowed: boolean;
  projected_cycle_net: number;
  required_buffer: number;
  realized_cycle_profit: number;
  candidate_loss: number;
}

interface SellCandidate {
  lot_id: string;
  net_profit_pct: number;
  capital_release: number;
  score: number;
}

interface EmergencyAssessment {
  is_emergency: boolean;
  atr_multiple: number;
  drawdown_pct: number;
  reason: string;
}

interface LatestDecision {
  occurred_at: string | null;
  market_price: number | null;
  position_state: string | null;
  action: string;
  reason: string | null;
  shadow_mode: boolean;
  trend_score_breakdown: TrendScoreBreakdown | null;
  portfolio_guard_result: PortfolioGuardResult | null;
  observation_window_minutes: number | null;
  sell_candidates: SellCandidate[] | null;
  emergency_assessment: EmergencyAssessment | null;
  executed: boolean;
}

interface RatioBrainPayload {
  bot_id: string;
  enabled: boolean;
  shadow_mode: boolean;
  emergency_state: string | null;
  emergency_entered_at: string | null;
  latest_decision: LatestDecision | null;
}

function prettyAction(action: string) {
  return action.replace(/_/g, " ");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
}

/**
 * Multi-Window Forecast Engine's sibling: RatioBrain's shadow-vs-real
 * decision, placed directly below TrendWindowBreakdownCard. Every number
 * here comes straight from the latest RatioBrainDecisionLog row -- nothing
 * is recomputed client-side, matching this project's standing rule against
 * decorative numbers that don't trace to a real backend field.
 */
export function RatioBrainDecisionCard({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: ["ratio-bot-ratio-brain", botId],
    queryFn: async () => {
      const response = await api.get<RatioBrainPayload>(`/ratio-bots/${botId}/ratio-brain`);
      return response.data;
    },
    refetchInterval: 20000,
  });

  const data = query.data;
  if (!data || !data.enabled) {
    return null;
  }

  const decision = data.latest_decision;
  const isEmergency = data.emergency_state === "emergency";
  const guard = decision?.portfolio_guard_result;
  const trend = decision?.trend_score_breakdown;

  return (
    <div className="space-y-3">
      {isEmergency ? (
        <div className="flex items-center gap-3 rounded-lg border-2 border-rose-500 bg-rose-500/10 px-4 py-3">
          <AlertOctagon className="h-6 w-6 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-rose-400">Spot Emergency Guard active</div>
            <div className="text-rose-300/90">
              New buy entries are blocked{data.emergency_entered_at ? ` since ${new Date(data.emergency_entered_at).toLocaleTimeString()}` : ""}.
              This does not force a sell -- it only accelerates review and pauses new entries.
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">RatioBrain Decision</h3>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
              data.shadow_mode
                ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
            )}
          >
            {data.shadow_mode ? "Shadow Mode" : "Live"}
          </span>
        </div>

        {!decision ? (
          <p className="text-xs text-muted-foreground">No RatioBrain evaluation logged for this bot yet.</p>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-medium">{prettyAction(decision.action)}</span>
              {decision.position_state ? <span className="text-muted-foreground"> · {prettyAction(decision.position_state)}</span> : null}
            </div>
            {decision.reason ? <p className="text-xs text-muted-foreground">{decision.reason}</p> : null}

            {guard ? (
              <div className="grid gap-2 rounded-lg border border-border/60 p-3 text-xs sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Realized this cycle</div>
                  <div className="font-medium tabular-nums">{money(guard.realized_cycle_profit)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Candidate loss</div>
                  <div className="font-medium tabular-nums text-rose-400">-${guard.candidate_loss.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Projected cycle net</div>
                  <div className={cn("font-medium tabular-nums", guard.projected_cycle_net >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {money(guard.projected_cycle_net)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Required buffer</div>
                  <div className="font-medium tabular-nums">${guard.required_buffer.toFixed(2)}</div>
                </div>
              </div>
            ) : null}

            {decision.observation_window_minutes !== null ? (
              <p className="text-xs text-muted-foreground">
                Observation window: {decision.observation_window_minutes} min
                {trend ? ` (composite ${trend.composite_score.toFixed(2)}, ${trend.direction})` : ""}
              </p>
            ) : null}

            {decision.sell_candidates && decision.sell_candidates.length > 0 ? (
              <div className="space-y-1 text-xs">
                <div className="text-muted-foreground">Sell candidates (ranked)</div>
                {decision.sell_candidates.slice(0, 5).map((candidate, index) => (
                  <div key={candidate.lot_id} className="flex items-center justify-between tabular-nums">
                    <span>
                      {index + 1}. Lot #{candidate.lot_id.slice(0, 8)} score {candidate.score.toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">
                      {candidate.net_profit_pct >= 0 ? "+" : ""}
                      {candidate.net_profit_pct.toFixed(2)}% · releases ${candidate.capital_release.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
