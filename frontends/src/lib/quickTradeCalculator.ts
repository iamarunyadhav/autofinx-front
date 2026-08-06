import type { NetEdgePayload } from "@/hooks/useQuickTrade";

export const MAX_CALCULATOR_LEVERAGE = 100;
export const MIN_CALCULATOR_LEVERAGE = 1;

export interface CalculatorProjection {
  leverage: number;
  grossUsdt: number;
  costUsdt: number;
  netUsdt: number;
  tradesNeeded: number | null;
  blocked: boolean;
}

export function clampLeverage(leverage: number): number {
  if (!Number.isFinite(leverage)) return MIN_CALCULATOR_LEVERAGE;
  return Math.min(MAX_CALCULATOR_LEVERAGE, Math.max(MIN_CALCULATOR_LEVERAGE, leverage));
}

/**
 * Leverage/target-profit math is a pure linear scale of the backend's real
 * (non-safety-buffered) net-edge figures — no shared logic with the backend
 * to reuse, so it stays client-side for instant recompute.
 */
export function computeCalculatorProjection(
  netEdge: NetEdgePayload | undefined,
  targetProfitUsdt: number,
  leverage: number
): CalculatorProjection | null {
  if (!netEdge) return null;

  const lev = clampLeverage(leverage);
  const grossUsdt = netEdge.expected_gross_usdt * lev;
  const costUsdt = netEdge.actual_cost_usdt * lev;
  const netUsdt = netEdge.expected_net_usdt_actual * lev;
  const tradesNeeded = netUsdt > 0 ? Math.ceil(targetProfitUsdt / netUsdt) : null;

  return {
    leverage: lev,
    grossUsdt,
    costUsdt,
    netUsdt,
    tradesNeeded,
    blocked: netUsdt <= 0,
  };
}
