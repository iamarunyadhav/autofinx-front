import type { CandleData } from "@/hooks/useRobotCandleFeed";

/**
 * Shared helpers for the "direct browser -> Binance WebSocket for crypto,
 * backend SSE fallback for everything else" pattern used by
 * useRatioBotCandleFeed.ts, useRobotCandleFeed.ts, and
 * useQuickTradeCandleFeed.ts. Extracted here only to avoid a third copy of
 * the same kline-normalization logic — the connection lifecycle (reconnect
 * backoff, SSE parsing, crypto/non-crypto branching) stays in each hook
 * since it's wired to a different fallback endpoint per engine.
 */

export const CRYPTO_QUOTES = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"];

export function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return CRYPTO_QUOTES.some((q) => s.endsWith(q));
}

export function upsertCandle(list: CandleData[], candle: CandleData): CandleData[] {
  const next = [...list];
  const idx = next.findIndex((c) => c.time === candle.time);
  if (idx >= 0) {
    next[idx] = candle;
  } else {
    next.push(candle);
    next.sort((a, b) => a.time - b.time);
    if (next.length > 500) next.splice(0, next.length - 500);
  }
  return next;
}

export function normalizeCandle(row: any, fallbackClosed = false): CandleData | null {
  const time = Number(row?.time ?? Math.floor(Number(row?.timestamp ?? 0) / 1000));
  const candle = {
    time,
    open: Number(row?.open),
    high: Number(row?.high),
    low: Number(row?.low),
    close: Number(row?.close),
    volume: Number(row?.volume ?? 0),
    isClosed: Boolean(row?.isClosed ?? row?.is_closed ?? fallbackClosed),
  };

  return candle.time > 0 &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0
    ? candle
    : null;
}

const SUPPORTED_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"];

export function binanceKlineStreamUrl(
  symbol: string,
  timeframe: string,
  marketType: "spot" | "futures",
): string {
  const streamSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  const interval = SUPPORTED_INTERVALS.includes(timeframe) ? timeframe : "1m";
  const host = marketType === "futures" ? "wss://fstream.binance.com/market/ws" : "wss://stream.binance.com:9443/ws";
  return `${host}/${streamSymbol}@kline_${interval}`;
}

/** Parses a raw Binance combined-kline WS frame into a normalized candle + event latency. */
export function parseBinanceKlineMessage(raw: string): { candle: CandleData; eventTs: number } | null {
  try {
    const payload = JSON.parse(raw);
    const kline = payload?.k;
    if (!kline) return null;

    const eventTs = Number(payload?.E ?? Date.now());
    const candle = normalizeCandle({
      time: Math.floor(Number(kline.t ?? eventTs) / 1000),
      open: kline.o,
      high: kline.h,
      low: kline.l,
      close: kline.c,
      volume: kline.v,
      isClosed: Boolean(kline.x),
    });

    return candle ? { candle, eventTs } : null;
  } catch {
    return null;
  }
}
