import type { QuickTradeRecord } from "../hooks/useQuickTrade";

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Open-position projection, not settlement. Entry slippage is already in entry fill. */
export function quickTradeCosts(trade: QuickTradeRecord, price: number, exitSlippagePct: number | null = null) {
  const entry = finiteNumber(trade.entry_price);
  const quantity = finiteNumber(trade.quantity);
  const stake = finiteNumber(trade.stake_amount);
  if (trade.mode !== "live" || entry === null || entry <= 0 || quantity === null || quantity <= 0 || stake === null || stake <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const cost = trade.signal_payload?.execution_cost;
  const entryActual = finiteNumber(trade.entry_fee_actual);
  const entryFee = entryActual ?? finiteNumber(cost?.entry_fee) ?? finiteNumber(trade.fees_total);
  const explicitRate = finiteNumber(cost?.fee_rate);
  const rate = explicitRate !== null && explicitRate >= 0 ? explicitRate
    : entryFee !== null && entryFee >= 0 ? entryFee / (entry * quantity) : null;
  const exitFee = rate !== null ? price * quantity * rate : null;
  // The entry snapshot is authoritative for an open position. The current
  // forecast is only a compatibility fallback for trades opened before that
  // snapshot existed; it can expire independently of the position.
  const bufferPct = finiteNumber(cost?.exit_slippage_pct) ?? finiteNumber(exitSlippagePct);
  const exitSlippage = bufferPct !== null && bufferPct >= 0 ? price * quantity * bufferPct / 100 : null;
  const funding = finiteNumber(trade.funding_fee_actual);
  const gross = (trade.side === "buy" ? price - entry : entry - price) * quantity;
  const knownFunding = funding ?? 0;
  const net = entryFee !== null && exitFee !== null && exitSlippage !== null
    ? gross - entryFee - exitFee - exitSlippage - knownFunding : null;
  return {
    gross, grossPct: gross / stake * 100, net, netPct: net !== null ? net / stake * 100 : null,
    entryFee, entryFeeSource: entryActual !== null ? "actual" : "estimated", exitFee, exitSlippage,
    funding, fundingUnknown: funding === null, stakeAfterCosts: net !== null ? stake + net : null,
    totalCost: net !== null ? gross - net : null,
  };
}
