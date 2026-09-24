import type { ForecastPayload } from "@/hooks/useQuickTrade";

/**
 * Gap-checklist N5 -- the fee-aware trade-decision reason shown as the FIRST
 * line of Signal Preview's "Why" list when the trade decision is WAIT, so the
 * fee-blind indicator reasons below it never look like they contradict the
 * WAIT headline. Built only from backend numbers (`forecast.trade_decision`),
 * no hardcoded percentage. Returns null for BUY/SELL or when absent.
 */
const WAIT_GATE_REASON: Record<string, string> = {
  cost: "the expected move does not cover fees and slippage",
  low_volume: "trading volume is unusually low right now",
  stale_data: "price data is stale",
  candle_gap: "the candle feed has a gap",
};

const fmtPct = (value?: number | null) => (value == null || Number.isNaN(value) ? "—" : `${value.toFixed(3)}%`);

export function waitReasonLine(decision?: ForecastPayload["trade_decision"] | null): string | null {
  if (!decision || decision.value !== "WAIT") return null;
  const numbers = `model expects ${fmtPct(decision.expected_move_pct)}, needs ${fmtPct(decision.required_move_pct)} after fees, max possible now ${fmtPct(decision.max_achievable_move_pct)}`;
  const gate = decision.gate_reason ? WAIT_GATE_REASON[decision.gate_reason] ?? decision.gate_reason.replace(/_/g, " ") : null;
  return gate
    ? `Trade decision is WAIT (after fees): ${gate} — ${numbers}.`
    : `Trade decision is WAIT (after fees): ${numbers}. The indicator vote below is fee-blind.`;
}
