import type { NetEdgePayload } from "@/hooks/useQuickTrade";

export const MAX_CALCULATOR_LEVERAGE = 100;
export const MIN_CALCULATOR_LEVERAGE = 1;

export interface CalculatorProjection {
  leverage: number;
  /** Leverage the backend's net_edge figures were already computed at. */
  baseLeverage: number;
  grossUsdt: number;
  costUsdt: number;
  netUsdt: number;
  /** Round-trip cost (fees + slippage buffer) as % of the MARGIN (stake). */
  costPctOfMargin: number | null;
  tradesNeeded: number | null;
  blocked: boolean;
}

export function clampLeverage(leverage: number): number {
  if (!Number.isFinite(leverage)) return MIN_CALCULATOR_LEVERAGE;
  return Math.min(MAX_CALCULATOR_LEVERAGE, Math.max(MIN_CALCULATOR_LEVERAGE, leverage));
}

/**
 * Gap-checklist N3 -- the backend's net_edge USDT figures are ALREADY
 * computed on the order form's leveraged notional (`netEdge.leverage`,
 * after exchange qty-step rounding). A what-if leverage therefore scales
 * relative to that base, never on top of it: following the order form
 * (`leverage === baseLeverage`) returns the backend numbers unchanged, and a
 * different what-if value is a pure linear rescale of the same real
 * (non-safety-buffered) figures. Backends that predate N3 send no
 * `leverage`, which is treated as 1x -- exactly the old behaviour.
 */
export function computeCalculatorProjection(
  netEdge: NetEdgePayload | undefined,
  targetProfitUsdt: number,
  leverage: number
): CalculatorProjection | null {
  if (!netEdge) return null;

  const baseLeverage = Number.isFinite(netEdge.leverage) && (netEdge.leverage ?? 0) >= 1 ? Number(netEdge.leverage) : 1;
  const lev = Number.isFinite(leverage) && leverage >= MIN_CALCULATOR_LEVERAGE ? leverage : baseLeverage;
  const scale = lev / baseLeverage;
  const grossUsdt = netEdge.expected_gross_usdt * scale;
  const costUsdt = netEdge.actual_cost_usdt * scale;
  const netUsdt = netEdge.expected_net_usdt_actual * scale;
  const margin = Number(netEdge.stake_margin ?? 0);
  const costPctOfMargin = margin > 0 ? (costUsdt / margin) * 100 : null;
  const tradesNeeded = netUsdt > 0 ? Math.ceil(targetProfitUsdt / netUsdt) : null;

  return {
    leverage: lev,
    baseLeverage,
    grossUsdt,
    costUsdt,
    netUsdt,
    costPctOfMargin,
    tradesNeeded,
    blocked: netUsdt <= 0,
  };
}
