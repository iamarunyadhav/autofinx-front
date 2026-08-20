import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export interface RatioBotCapitalCardProps {
  baseQuoteAmount: number;
  initialEntryPct: number;
  reserveTrancheCount: number;
  reserveTranchesRemaining: number;
  reserveQuoteRemaining: number;
  hasOpenPosition: boolean;
  positionQty: number;
  currentPrice?: number | null;
  quoteAsset?: string;
}

/**
 * Wallet / reserve / deployed / remaining breakdown for a single Ratio Bot
 * cycle. Purely derived from config + state fields already returned by the
 * existing config/ratio endpoints — no new backend data needed.
 */
export function RatioBotCapitalCard({
  baseQuoteAmount,
  initialEntryPct,
  reserveTrancheCount,
  reserveTranchesRemaining,
  reserveQuoteRemaining,
  hasOpenPosition,
  positionQty,
  currentPrice,
  quoteAsset = "USDT",
}: RatioBotCapitalCardProps) {
  const wallet = Math.max(0, baseQuoteAmount || 0);
  const staged = reserveTrancheCount > 0 && initialEntryPct < 1;
  const reserveInitial = staged ? wallet * (1 - initialEntryPct) : 0;
  const deployableInitial = wallet - reserveInitial;

  // Capital only counts as "used" while a position is actually open —
  // idle/flat means nothing from this cycle is currently deployed.
  const used = hasOpenPosition ? Math.max(0, wallet - reserveQuoteRemaining) : 0;
  const remaining = hasOpenPosition ? Math.max(0, reserveQuoteRemaining) : reserveInitial;
  const usedPct = wallet > 0 ? Math.min(100, (used / wallet) * 100) : 0;
  const positionValue = positionQty > 0 && currentPrice ? positionQty * currentPrice : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capital Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">Wallet capital</div>
            <div className="text-lg font-semibold">{fmt(wallet)} {quoteAsset}</div>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {staged ? `Reserve (${((1 - initialEntryPct) * 100).toFixed(0)}%)` : "Reserve"}
            </div>
            <div className="text-lg font-semibold">{fmt(staged ? reserveInitial : 0)} {quoteAsset}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Capital deployed</span>
            <span>{fmt(used)} / {fmt(wallet)} {quoteAsset}</span>
          </div>
          <Progress value={usedPct} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">Deployable now</div>
            <div className="font-medium">{fmt(staged ? deployableInitial : wallet)} {quoteAsset}</div>
          </div>
          <div className="rounded-lg border border-border/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {staged ? `Reserve remaining (${reserveTranchesRemaining}/${reserveTrancheCount} tranches)` : "Reserve remaining"}
            </div>
            <div className="font-medium">{fmt(remaining)} {quoteAsset}</div>
          </div>
        </div>

        {positionValue !== null ? (
          <div className="rounded-lg border border-border/60 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Position value now</span>
              <span className="font-medium">{fmt(positionValue)} {quoteAsset}</span>
            </div>
          </div>
        ) : null}

        {!staged ? (
          <p className="text-xs text-muted-foreground">
            Staged reserve is off — every buy deploys 100% of the wallet capital in one shot.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
