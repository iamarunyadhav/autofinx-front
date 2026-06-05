import { useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBalances } from '@/hooks/useWallet';
import { useRealtimePrices } from '@/hooks/useRealtimePrices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingUp, TrendingDown, Wifi, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRef, useEffect } from 'react';

// Currency to symbol mapping for price lookup
const currencyToSymbol: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  XRP: 'XRPUSDT',
  BNB: 'BNBUSDT',
  ADA: 'ADAUSDT',
  MATIC: 'MATICUSDT',
  AVAX: 'AVAXUSDT',
  DOGE: 'DOGEUSDT',
  DOT: 'DOTUSDT',
  TRX: 'TRXUSDT',
  LINK: 'LINKUSDT',
  LTC: 'LTCUSDT',
};

const fallbackPrices: Record<string, number> = {
  BTC: 43500,
  ETH: 2250,
  SOL: 95,
  XRP: 0.62,
  BNB: 325,
  ADA: 0.48,
  DOGE: 0.09,
  AVAX: 38,
  MATIC: 0.85,
  DOT: 7.8,
  TRX: 0.11,
  LINK: 15.2,
  LTC: 72,
};

export function PortfolioValue() {
  const { currentWorkspace } = useWorkspace();
  const { data: balances, isLoading: balancesLoading } = useBalances(currentWorkspace?.id);
  const { prices, isConnected, stale, lastHeartbeat, reconnectAttempts } = useRealtimePrices();
  const { toast } = useToast();
  const lastFallback = useRef<Set<string>>(new Set());

  const priceState = useMemo(() => {
    if (!balances) return { total: 0, breakdown: [], missingLive: [] as string[] };

    const availableSymbols = Object.keys(prices || {});

    const breakdown = balances.map((balance) => {
      const currency = (balance.currency || '').toUpperCase();
      const explicitSymbol = currencyToSymbol[currency];
      const guessedSymbol =
        availableSymbols.find((sym) => sym.toUpperCase() === `${currency}USDT`) ||
        availableSymbols.find((sym) => sym.toUpperCase() === `${currency}USD`) ||
        explicitSymbol;

      const symbol = guessedSymbol || explicitSymbol;
      const realtimePrice = symbol ? prices[symbol]?.price : null;
      
      const useStable = currency === 'USD' || currency === 'USDT';
      const manualFallback = fallbackPrices[currency];

      const priceUsed = useStable ? 1 : realtimePrice || manualFallback || 0;
      const source: 'live' | 'fallback' | 'manual' = realtimePrice ? 'live' : manualFallback ? 'manual' : 'fallback';

      const usdValue = (Number(balance.balance) || 0) * priceUsed;
      const change24h = symbol ? prices[symbol]?.change24hPercent || 0 : 0;
      const isLive = !!realtimePrice || useStable;

      return {
        currency,
        balance: Number(balance.balance) || 0,
        usdValue: useStable ? Number(balance.balance) || 0 : usdValue,
        priceUsed,
        change24h,
        isLive,
        symbol: symbol || `${currency}USDT`,
        source,
      };
    });

    const total = breakdown.reduce((sum, b) => sum + b.usdValue, 0);
    const weightedChange = total > 0
      ? breakdown.reduce((sum, b) => sum + (b.usdValue / total) * b.change24h, 0)
      : 0;
    const missingLive = breakdown.filter((b) => !b.isLive && b.balance > 0).map((b) => b.currency);

    return { total, breakdown, weightedChange, missingLive };
  }, [balances, prices]);

  const { total, breakdown, weightedChange, missingLive } = priceState;
  const isPositive = (weightedChange || 0) >= 0;

  useEffect(() => {
    const missing = new Set(missingLive);
    const newlyMissing = [...missing].filter((c) => !lastFallback.current.has(c));
    if (newlyMissing.length > 0) {
      toast({
        title: 'Fallback pricing in use',
        description: `Missing live feed for: ${newlyMissing.join(', ')}. Using static prices until stream recovers.`,
        variant: 'destructive',
      });
    }
    lastFallback.current = missing;
  }, [missingLive, toast]);

  if (balancesLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Portfolio Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Portfolio Value
          </CardTitle>
          {isConnected && (
            <div className="flex items-center gap-1">
              <Wifi className={`w-3 h-3 ${stale ? 'text-amber-500' : 'text-green-500'}`} />
              <span className="text-[10px] text-muted-foreground">
                {stale ? 'Stale' : 'Real-time'}
                {reconnectAttempts > 0 && ` · reconnect ${reconnectAttempts}`}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <motion.p
            key={total.toFixed(2)}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-bold tracking-tight"
          >
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.p>
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              variant={isPositive ? 'default' : 'destructive'}
              className="text-xs"
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {isPositive ? '+' : ''}{(weightedChange || 0).toFixed(2)}%
            </Badge>
            <span className="text-xs text-muted-foreground">24h</span>
          </div>
        </div>

        {/* Currency breakdown */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Holdings</p>
          {breakdown?.filter(b => b.balance > 0).slice(0, 4).map((item) => (
            <div 
              key={item.currency}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.currency}</span>
                <span className="text-xs text-muted-foreground">
                  {item.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  ${item.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <Badge variant={item.isLive ? 'outline' : 'secondary'} className="text-[10px]">
                  {item.isLive ? 'Live' : 'Fallback'}
                </Badge>
                <span className={cn(
                  "text-xs font-mono",
                  item.change24h >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {missingLive.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-muted p-3">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Live feed missing for: {missingLive.join(', ')}</p>
              <p>We defaulted to static prices. Add these pairs to your data source (e.g. BTCUSDT on Binance) so they stream live.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
