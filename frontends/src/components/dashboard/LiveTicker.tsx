import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const tickers: Ticker[] = [
  { symbol: "BTC/USDT", price: 42150.25, change: 1250.5, changePercent: 3.05 },
  { symbol: "ETH/USDT", price: 2285.5, change: -45.25, changePercent: -1.94 },
  { symbol: "SOL/USDT", price: 98.75, change: 5.2, changePercent: 5.56 },
  { symbol: "AAPL", price: 189.45, change: 2.15, changePercent: 1.15 },
  { symbol: "TSLA", price: 248.3, change: -8.7, changePercent: -3.39 },
];

export function LiveTicker() {
  const [tickerData, setTickerData] = useState(tickers);

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerData((prev) =>
        prev.map((ticker) => {
          const fluctuation = (Math.random() - 0.5) * 0.002 * ticker.price;
          const newPrice = ticker.price + fluctuation;
          const newChange = ticker.change + fluctuation;
          const newPercent = (newChange / (ticker.price - ticker.change)) * 100;
          return {
            ...ticker,
            price: newPrice,
            change: newChange,
            changePercent: newPercent,
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Prices</CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-running rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Streaming</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tickerData.map((ticker, index) => (
          <TickerRow key={ticker.symbol} ticker={ticker} index={index} />
        ))}
      </CardContent>
    </Card>
  );
}

function TickerRow({ ticker, index }: { ticker: Ticker; index: number }) {
  const isPositive = ticker.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
          <span className="text-xs font-bold text-primary">
            {ticker.symbol.split("/")[0].slice(0, 2)}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium">{ticker.symbol}</p>
          <p
            className={cn(
              "text-xs font-mono",
              isPositive ? "text-profit" : "text-loss"
            )}
          >
            {isPositive ? "+" : ""}
            {ticker.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="text-right">
        <motion.p
          key={ticker.price.toFixed(2)}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="text-sm font-mono font-medium"
        >
          ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </motion.p>
        <div className="flex items-center justify-end gap-1">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-profit" />
          ) : (
            <TrendingDown className="w-3 h-3 text-loss" />
          )}
          <span
            className={cn(
              "text-xs font-mono",
              isPositive ? "text-profit" : "text-loss"
            )}
          >
            {isPositive ? "+" : ""}${Math.abs(ticker.change).toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
