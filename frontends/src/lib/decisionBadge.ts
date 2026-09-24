/**
 * Gap-checklist N1 -- colour tier for the Quick Trade "decision" badge in
 * NearTermForecastCard. Pure so the rule is readable in one place:
 *
 *   red    age > the result's own cache validity window (the async worker's
 *          `valid_until - requested_at`, 20s today) -- the verdict on screen
 *          is older than the backend itself considers valid.
 *   amber  age > the timeframe-relative threshold (10% of the chart
 *          timeframe, min 8s -- computed by the caller), OR the worker queue
 *          wait for this verdict exceeded 2000ms. The queue-wait rule applies
 *          regardless of timeframe: that is real worker latency.
 *   ok     otherwise.
 *
 * `validitySeconds` is null when the caller has no async-worker metadata
 * (Ratio Bot / Robot Trade pass no `calculation`), in which case the red tier
 * never applies and behaviour is exactly the old two-tier badge.
 */
export type DecisionBadgeTone = "ok" | "amber" | "red";

export const QUEUE_WAIT_AMBER_MS = 2000;

export function decisionBadgeTone(input: {
  ageSeconds: number;
  thresholdSeconds: number;
  validitySeconds?: number | null;
  queueWaitMs?: number | null;
}): DecisionBadgeTone {
  const { ageSeconds, thresholdSeconds, validitySeconds, queueWaitMs } = input;
  if (validitySeconds != null && validitySeconds > 0 && ageSeconds > validitySeconds) return "red";
  if (ageSeconds > thresholdSeconds) return "amber";
  if (queueWaitMs != null && queueWaitMs > QUEUE_WAIT_AMBER_MS) return "amber";
  return "ok";
}

export const DECISION_BADGE_CLASS: Record<DecisionBadgeTone, string> = {
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  red: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};
