import { useEffect, useMemo } from "react";
import { useQuickTradeCandleFeed } from "@/hooks/useQuickTradeCandleFeed";
import { useQuickTradeOlderCandles } from "@/hooks/useQuickTradeOlderCandles";
import type { Bar } from "@/lib/chartStructure";

/**
 * Candles for the Manual SL/TP chart: Binance live feed + paged history (reusing the existing Quick Trade hooks,
 * unchanged). Enough history is loaded for EMA 200 and structure overlays. This is DISPLAY data only: changing
 * `timeframe` re-subscribes the chart and has no effect on any position or order.
 */
export function useManualChartCandles(symbol: string, timeframe: string, minBars = 520) {
  const feed = useQuickTradeCandleFeed(symbol, timeframe, true);
  const older = useQuickTradeOlderCandles(symbol, timeframe, "quick-trade-manual");

  const oldestTime = older.candles[0]?.time ?? feed.candles[0]?.time ?? null;
  const total = older.candles.length + feed.candles.length;
  useEffect(() => {
    if (older.loading || older.exhausted || older.atCapacity || total >= minBars) return;
    // First page: everything before "now + 1s" (the history endpoint returns up to 200 bars per page).
    older.loadOlder(oldestTime ?? Math.floor(Date.now() / 1000) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [older.loading, older.exhausted, older.atCapacity, total, minBars, oldestTime, symbol, timeframe]);

  const bars = useMemo<Bar[]>(() => {
    const byTime = new Map<number, Bar>();
    for (const c of older.candles) byTime.set(c.time, c);
    for (const c of feed.candles) byTime.set(c.time, c);
    if (feed.currentCandle) byTime.set(feed.currentCandle.time, feed.currentCandle);
    return [...byTime.values()].sort((a, b) => a.time - b.time);
  }, [older.candles, feed.candles, feed.currentCandle]);

  const lastPrice = feed.currentCandle?.close ?? bars[bars.length - 1]?.close ?? null;
  return { bars, lastPrice, connected: feed.connected, loadingHistory: older.loading, error: older.error };
}
