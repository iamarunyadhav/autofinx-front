import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ForecastPayload, SignalPreview } from "@/hooks/useQuickTrade";
import { waitReasonLine } from "@/lib/waitReason";

interface SignalSummaryCardProps {
  signal?: SignalPreview;
  /** Gap-checklist N5 -- the fee-aware trade decision from the same forecast
   * the Direction/Trade-decision card renders. Optional: callers that don't
   * pass it (Ratio Bot) get exactly the old indicator-only Why list. */
  tradeDecision?: ForecastPayload["trade_decision"] | null;
}

export function SignalSummaryCard({ signal, tradeDecision }: SignalSummaryCardProps) {
  const waitLine = waitReasonLine(tradeDecision);
  const directionTone =
    signal?.direction === "buy"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-400/30"
      : signal?.direction === "sell"
        ? "bg-rose-500/10 text-rose-300 border-rose-400/30"
        : "bg-slate-500/10 text-slate-300 border-slate-400/30";

  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="px-4 pb-3 sm:px-6">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          Signal Preview
          <Badge className={directionTone}>{signal?.direction?.toUpperCase() ?? "NEUTRAL"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="rounded-2xl bg-slate-900/80 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
            <span title="Share of indicator votes that agree -- not a measured probability that the direction is right.">Vote share (not a probability)</span>
            <span>{signal?.confidence ?? 0}%</span>
          </div>
          <Progress value={signal?.confidence ?? 0} className="h-2 bg-slate-800" />
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center text-xs sm:gap-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-2 sm:p-3">
            <div className="text-slate-400">Bullish</div>
            <div className="mt-1 text-base font-semibold text-emerald-300">{signal?.bullish_score ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-2 sm:p-3">
            <div className="text-slate-400">Neutral</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{signal?.neutral_score ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-2 sm:p-3">
            <div className="text-slate-400">Bearish</div>
            <div className="mt-1 text-base font-semibold text-rose-300">{signal?.bearish_score ?? 0}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-100">Why</div>
          {waitLine && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {waitLine}
            </div>
          )}
          {(signal?.reasons ?? []).length > 0 ? (
            <div className="space-y-2 text-sm text-slate-300">
              {signal?.reasons.map((reason) => (
                <div key={reason} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  {reason}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Waiting for enough candles to compute the indicator consensus.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
