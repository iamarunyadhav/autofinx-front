import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth";

export interface CandleData {
  time: number; // unix timestamp (seconds) — lightweight-charts compatible
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface RobotFeedState {
  candles: CandleData[];
  currentCandle: CandleData | null;
  lastSignal: "BUY" | "SELL" | "HOLD" | null;
  connected: boolean;
  latencyMs: number;
  source: "binance" | "sse" | null;
}

const CRYPTO_QUOTES = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"];

/** Crypto symbols stream directly off Binance; everything else falls back to backend SSE. */
function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return CRYPTO_QUOTES.some((q) => s.endsWith(q));
}

/** Map an AutoFinX timeframe to a Binance kline interval. */
function toBinanceInterval(timeframe: string): string {
  const tf = timeframe.toLowerCase().trim();
  const allowed = new Set([
    "1m", "3m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "1w", "1M",
  ]);
  if (allowed.has(tf)) return tf;
  // Common aliases.
  if (tf === "60m") return "1h";
  if (tf === "240m") return "4h";
  return "1m";
}

function upsertCandle(list: CandleData[], candle: CandleData): CandleData[] {
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

/**
 * Live candle feed for the Robot Trade chart.
 *
 * Crypto symbols connect straight to the Binance Futures WebSocket; non-crypto
 * symbols (forex/metals) fall back to the backend SSE endpoint when a sessionId
 * is supplied. Auto-reconnects with backoff and exposes a rough latency figure.
 */
export function useRobotCandleFeed(
  symbol: string,
  timeframe: string,
  enabled: boolean,
  sessionId?: string,
): RobotFeedState {
  const [state, setState] = useState<RobotFeedState>({
    candles: [],
    currentCandle: null,
    lastSignal: null,
    connected: false,
    latencyMs: 0,
    source: null,
  });

  const candlesRef = useRef<CandleData[]>([]);

  useEffect(() => {
    if (!enabled || !symbol || !timeframe) {
      setState((s) => ({ ...s, connected: false, source: null }));
      return;
    }

    candlesRef.current = [];
    setState((s) => ({ ...s, candles: [], currentCandle: null, connected: false }));

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let activeWs: WebSocket | null = null;
    let activeController: AbortController | null = null;

    const apply = (candle: CandleData, latencyMs: number) => {
      candlesRef.current = upsertCandle(candlesRef.current, candle);
      setState((s) => ({
        ...s,
        candles: candlesRef.current,
        currentCandle: candle,
        connected: true,
        latencyMs,
      }));
    };

    const scheduleReconnect = (connect: () => void) => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      reconnectTimer = setTimeout(connect, delay);
    };

    // ---- Binance direct WebSocket (crypto) ----
    const connectBinance = () => {
      if (stopped) return;
      const interval = toBinanceInterval(timeframe);
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}`);
      activeWs = ws;

      ws.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, connected: true, source: "binance" }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          const k = msg.k;
          if (!k) return;
          const candle: CandleData = {
            time: Math.floor(Number(k.t) / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
            isClosed: Boolean(k.x),
          };
          const eventTs = Number(msg.E ?? Date.now());
          apply(candle, Math.max(0, Date.now() - eventTs));
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (stopped) return;
        setState((s) => ({ ...s, connected: false }));
        scheduleReconnect(connectBinance);
      };
    };

    // ---- Backend SSE fallback (forex / non-crypto) ----
    const connectSse = () => {
      if (stopped || !sessionId) {
        setState((s) => ({ ...s, connected: false, source: null }));
        return;
      }
      const base = getApiBaseUrl();
      const token = getAuthToken();
      const url = new URL(`${base}/robot-sessions/${sessionId}/candle-feed`);
      const controller = new AbortController();
      activeController = controller;

      (async () => {
        try {
          const resp = await fetch(url.toString(), {
            headers: {
              Accept: "text/event-stream",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          });
          if (!resp.ok || !resp.body) throw new Error(`SSE ${resp.status}`);

          attempt = 0;
          setState((s) => ({ ...s, connected: true, source: "sse" }));

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sep: number;
            while ((sep = buffer.indexOf("\n\n")) >= 0) {
              const chunk = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
              if (!dataLine) continue;
              try {
                const payload = JSON.parse(dataLine.slice(5).trim());
                const rows: any[] = payload.candles ?? [];
                rows.forEach((row, i) => {
                  const candle: CandleData = {
                    time: Math.floor(Number(row.timestamp ?? 0) / 1000),
                    open: Number(row.open),
                    high: Number(row.high),
                    low: Number(row.low),
                    close: Number(row.close),
                    volume: Number(row.volume ?? 0),
                    isClosed: i < rows.length - 1,
                  };
                  if (candle.time > 0) apply(candle, 0);
                });
              } catch {
                /* ignore malformed event */
              }
            }
          }
        } catch (err) {
          if (stopped || (err as Error)?.name === "AbortError") return;
          setState((s) => ({ ...s, connected: false }));
          scheduleReconnect(connectSse);
        }
      })();
    };

    if (isCryptoSymbol(symbol)) {
      connectBinance();
    } else {
      connectSse();
    }

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      activeWs?.close();
      activeController?.abort();
    };
  }, [symbol, timeframe, enabled, sessionId]);

  return state;
}
