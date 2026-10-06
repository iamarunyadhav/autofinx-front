import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

/**
 * Edits a Ratio Bot buy/sell threshold as a percentage instead of a raw
 * ratio. Stored values keep the backend convention: sell is a positive
 * ratio (0.015 = +1.5% above the buy anchor), buy is negative (-0.015 =
 * 1.5% below the sell anchor; the engine uses its magnitude).
 *
 * The preview mirrors the engine's own trigger math: a SELL fires at
 * anchor * (1 + threshold + cost), a BUY at anchor / (1 + |threshold| + cost),
 * where cost = (2 x fee_bps + slippage_bps) / 10000.
 */
interface Props {
  side: "sell" | "buy";
  value: string;
  onChange: (ratio: string) => void;
  feeBps: string;
  slippageBps: string;
  anchorPrice?: number | null;
  currentPrice?: number | null;
}

const MIN_PCT = 0.1;
const MAX_PCT = 15;

function num(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function price(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 2 : 6 });
}

export function RatioThresholdSlider({ side, value, onChange, feeBps, slippageBps, anchorPrice, currentPrice }: Props) {
  const pct = Math.abs(num(value)) * 100;
  const costPct = ((num(feeBps) * 2) + num(slippageBps)) / 100;
  const ratio = pct / 100;
  const cost = costPct / 100;

  const target = anchorPrice && anchorPrice > 0
    ? (side === "sell" ? anchorPrice * (1 + ratio + cost) : anchorPrice / (1 + ratio + cost))
    : null;
  const distancePct = target && currentPrice && currentPrice > 0
    ? (side === "sell" ? (target / currentPrice - 1) * 100 : (currentPrice / target - 1) * 100)
    : null;

  const setPct = (next: number) => {
    const clamped = Math.min(MAX_PCT, Math.max(0, Math.round(next * 100) / 100));
    const stored = (clamped / 100) * (side === "sell" ? 1 : -1);
    onChange(String(Number(stored.toFixed(6))));
  };

  const isSell = side === "sell";
  const accent = isSell ? "text-rose-500" : "text-emerald-500";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">
          {isSell ? "Sell when price rises" : "Buy when price drops"}
        </Label>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-semibold ${accent}`}>{isSell ? "+" : "−"}</span>
          <Input
            type="number"
            step="0.05"
            min={0}
            max={MAX_PCT}
            className="h-8 w-20 text-right"
            value={Number(pct.toFixed(2))}
            onChange={(event) => setPct(num(event.target.value))}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <Slider
        min={MIN_PCT}
        max={MAX_PCT}
        step={0.05}
        value={[Math.min(MAX_PCT, Math.max(MIN_PCT, pct))]}
        onValueChange={([next]) => setPct(next)}
        aria-label={isSell ? "Sell threshold percent" : "Buy threshold percent"}
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">{isSell ? "From last buy" : "From last sell"}</span>
        <span className="text-right">{price(anchorPrice ?? null)}</span>
        <span className="text-muted-foreground">Trigger price</span>
        <span className={`text-right font-medium ${accent}`}>{price(target)}</span>
        <span className="text-muted-foreground">From current price</span>
        <span className="text-right">
          {distancePct === null ? "—" : `${distancePct > 0 ? "" : "already "}${Math.abs(distancePct).toFixed(2)}% ${isSell ? (distancePct > 0 ? "higher" : "past") : (distancePct > 0 ? "lower" : "past")}`}
        </span>
        <span className="text-muted-foreground">Fees + slippage (added to trigger)</span>
        <span className="text-right">{costPct.toFixed(2)}%</span>
        <span className="text-muted-foreground">Move needed in total</span>
        <span className="text-right">{(pct + costPct).toFixed(2)}%</span>
        <span className="text-muted-foreground">Net edge when it fires</span>
        <span className="text-right font-medium text-emerald-500">+{pct.toFixed(2)}%</span>
      </div>
    </div>
  );
}
