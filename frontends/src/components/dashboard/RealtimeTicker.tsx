import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRealtimePrices } from "@/hooks/useRealtimePrices";
import { RefreshCw, TrendingDown, TrendingUp, Wifi, WifiOff } from "lucide-react";

const symbolConfig: Record<string, { name: string; icon: string; color: string }> = {
  BTCUSDT: { name: "Bitcoin", icon: "BTC", color: "from-orange-500/20 to-orange-600/10" },
  ETHUSDT: { name: "Ethereum", icon: "ETH", color: "from-blue-500/20 to-blue-600/10" },
  SOLUSDT: { name: "Solana", icon: "SOL", color: "from-purple-500/20 to-purple-600/10" },
  BNBUSDT: { name: "BNB", icon: "BNB", color: "from-yellow-500/20 to-yellow-600/10" },
  XRPUSDT: { name: "XRP", icon: "XRP", color: "from-gray-500/20 to-gray-600/10" },
  ADAUSDT: { name: "Cardano", icon: "ADA", color: "from-sky-500/20 to-sky-600/10" },
  AAPL: { name: "Apple", icon: "AP", color: "from-gray-500/20 to-gray-600/10" },
  TSLA: { name: "Tesla", icon: "TS", color: "from-red-500/20 to-red-600/10" },
  GOOGL: { name: "Google", icon: "GO", color: "from-green-500/20 to-green-600/10" },
  MSFT: { name: "Microsoft", icon: "MS", color: "from-blue-500/20 to-blue-600/10" },
};

export function RealtimeTicker() {
  const { prices, isConnected, error, lastUpdate, reconnect } = useRealtimePrices();

  const priceEntries = Object.entries(prices);
  const hasData = priceEntries.length > 0;

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Live Prices</CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Live</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-1.5">
                <WifiOff className="w-4 h-4 text-destructive" />
                <Button variant="ghost" size="sm" onClick={reconnect} className="h-6 px-2">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <WifiOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Connecting...</span>
              </div>
            )}
          </div>
        </div>
        {lastUpdate && (
          <p className="text-[10px] text-muted-foreground">
            Updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {!hasData ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          priceEntries.slice(0, 6).map(([symbol, data], index) => (
            <PriceRow
              key={symbol}
              symbol={symbol}
              price={data.price}
              change={data.change24h}
              changePercent={data.change24hPercent}
              index={index}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface PriceRowProps {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  index: number;
}

function PriceRow({ symbol, price, change, changePercent, index }: PriceRowProps) {
  const config = symbolConfig[symbol] || {
    name: symbol,
    icon: symbol.slice(0, 2),
    color: "from-gray-500/20 to-gray-600/10",
  };
  const isPositive = changePercent >= 0;

  const decimals = price < 1 ? 4 : 2;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        "flex items-center justify-between p-2.5 rounded-lg transition-colors gap-3",
        `bg-gradient-to-r ${config.color}`,
        "hover:ring-1 hover:ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-background/50 flex items-center justify-center border border-border/50 shrink-0">
          <span className="text-[11px] font-semibold text-primary">{config.icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{config.name}</p>
          <p className="text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <motion.p
          key={price.toFixed(decimals)}
          initial={{ opacity: 0.7, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="text-sm font-mono font-semibold"
        >
          $
          {price.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}
        </motion.p>
        <div className="flex items-center justify-end gap-1">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span
            className={cn(
              "text-xs font-mono font-medium",
              isPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
