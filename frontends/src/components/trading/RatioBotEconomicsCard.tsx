import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function pct(value: number, digits = 3) {
  return `${(value * 100).toFixed(digits)}%`;
}

function money(value: number, digits = 4) {
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export interface RatioBotEconomicsCardProps {
  sellThresholdRatio: number;
  feeBps: number;
  maxSlippageBps: number;
  minNetProfitBps: number;
  costBasis?: number | null;
  currentPrice?: number | null;
  positionQty?: number | null;
  realizedPnl?: number | null;
  quoteAsset?: string;
}

/**
 * Mirrors RatioBotDecisionService::executionCostRatio() / checkSellConditions()
 * exactly (fee_bps*2 round-trip + max_slippage_bps, sell_threshold_ratio +
 * cost_ratio required trigger, min_net_profit_bps floor) so what's shown here
 * always matches what the backend will actually require before it sells.
 */
export function RatioBotEconomicsCard({
  sellThresholdRatio,
  feeBps,
  maxSlippageBps,
  minNetProfitBps,
  costBasis,
  currentPrice,
  positionQty,
  realizedPnl,
  quoteAsset = "USDT",
}: RatioBotEconomicsCardProps) {
  const feeRatio = (feeBps || 0) / 10000;
  const slippageRatio = (maxSlippageBps || 0) / 10000;
  const costRatio = feeRatio * 2 + slippageRatio;
  const minNetRatio = (minNetProfitBps || 0) / 10000;
  const requiredGrossRatio = sellThresholdRatio + costRatio;
  const hasCostBasis = !!costBasis && costBasis > 0;

  const breakEvenPrice = hasCostBasis ? costBasis! * (1 + costRatio) : null;
  const profitFloorRatio = Math.max(sellThresholdRatio, minNetRatio) + costRatio;
  const profitableSellFloor = hasCostBasis ? costBasis! * (1 + profitFloorRatio) : null;

  const grossRatioNow = hasCostBasis && currentPrice ? currentPrice / costBasis! - 1 : null;
  const netRatioNow = grossRatioNow !== null ? grossRatioNow - costRatio : null;
  const netValueNow = netRatioNow !== null && positionQty ? netRatioNow * costBasis! * positionQty : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Economic Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row label="Sell threshold (target)" value={pct(sellThresholdRatio)} />
        <Row label="Round-trip fees (buy+sell)" value={pct(feeRatio * 2)} />
        <Row label="Slippage allowance" value={pct(slippageRatio)} />
        <Row label="Minimum net profit floor" value={pct(minNetRatio)} />
        <Row label="Required gross move to sell" value={pct(requiredGrossRatio)} />

        {hasCostBasis ? (
          <>
            <Row label="Cost basis" value={`${money(costBasis!)} ${quoteAsset}`} />
            <Row label="Break-even price" value={`${money(breakEvenPrice!)} ${quoteAsset}`} />
            <Row label="Minimum profitable sell price" value={`${money(profitableSellFloor!)} ${quoteAsset}`} />
          </>
        ) : (
          <p className="pt-2 text-xs text-muted-foreground">No open position — break-even/sell-floor prices appear once holding.</p>
        )}

        {netRatioNow !== null ? (
          <>
            <Row
              label="Expected net if sold now"
              value={`${netRatioNow >= 0 ? "+" : ""}${pct(netRatioNow)}${netValueNow !== null ? ` (${netValueNow >= 0 ? "+" : ""}${money(netValueNow, 2)} ${quoteAsset})` : ""}`}
              tone={netRatioNow >= 0 ? "up" : "down"}
            />
          </>
        ) : null}

        {realizedPnl !== null && realizedPnl !== undefined ? (
          <Row
            label="Realized net this cycle"
            value={`${realizedPnl >= 0 ? "+" : ""}${money(realizedPnl, 2)} ${quoteAsset}`}
            tone={realizedPnl >= 0 ? "up" : "down"}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
