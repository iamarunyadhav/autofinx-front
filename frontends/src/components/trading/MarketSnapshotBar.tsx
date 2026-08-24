import { useQueries } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useBalances } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
const FRESH_MAX_AGE_SECONDS = 15;

interface MarketPricePayload {
  price?: number;
  timestamp_ms?: number | null;
}

/**
 * Always-visible multi-symbol price row + wallet balance chip, so an
 * operator glancing at the Ratio Bot page can see "what's the market doing
 * and what do I actually have" without switching pages. Prices come from
 * the same Redis cache RunRatioBotEvaluationJob reads (GET /market/price),
 * refreshed every few seconds — a dot next to each symbol shows whether
 * that specific price is still fresh.
 */
export function MarketSnapshotBar({
  workspaceId,
  symbols = DEFAULT_SYMBOLS,
}: {
  workspaceId?: string;
  symbols?: string[];
}) {
  const priceQueries = useQueries({
    queries: symbols.map((symbol) => ({
      queryKey: ["market-snapshot-price", symbol],
      queryFn: async () => {
        const res = await api.get<MarketPricePayload>(`/market/price?symbol=${symbol}&exchange=binance`);
        return res.data;
      },
      refetchInterval: 4000,
      retry: false,
      staleTime: 2000,
    })),
  });

  const balances = useBalances(workspaceId);
  const rows = balances.data ?? [];
  const primaryBalance =
    rows.find((row: { currency?: string }) => (row.currency || "").toUpperCase() === "USDT") ?? rows[0];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {symbols.map((symbol, index) => {
            const query = priceQueries[index];
            const price = query.data?.price;
            const ageSeconds = query.data?.timestamp_ms
              ? (Date.now() - Number(query.data.timestamp_ms)) / 1000
              : null;
            const fresh = ageSeconds != null && ageSeconds <= FRESH_MAX_AGE_SECONDS;

            return (
              <div
                key={symbol}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm"
                title={ageSeconds != null ? `${Math.round(ageSeconds)}s old` : "no price yet"}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", fresh ? "bg-emerald-500" : "bg-slate-500")} />
                <span className="font-medium">{symbol.replace("USDT", "")}</span>
                <span className="text-muted-foreground">
                  {price
                    ? `$${price.toLocaleString(undefined, { maximumFractionDigits: price < 10 ? 4 : 2 })}`
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Wallet</span>
          <Badge variant="outline">
            {primaryBalance
              ? `${Number(primaryBalance.available ?? primaryBalance.balance ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} ${primaryBalance.currency}`
              : balances.isLoading
                ? "loading…"
                : "—"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
