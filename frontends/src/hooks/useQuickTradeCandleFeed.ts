import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth";
import type { CandleData, RobotFeedState } from "@/hooks/useRobotCandleFeed";

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
 * Connects to the backend SSE candle feed for Quick Trade.
 * The server opens the Binance Futures WebSocket and streams candles to the
 * browser — no direct browser → Binance connection required.
 */
export function useQuickTradeCandleFeed(
  symbol: string,
  timeframe: string,
  enabled: boolean,
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
    setState({ candles: [], currentCandle: null, lastSignal: null, connected: false, latencyMs: 0, source: null });

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let activeController: AbortController | null = null;

    const apply = (candle: CandleData, latencyMs = 0) => {
      candlesRef.current = upsertCandle(candlesRef.current, candle);
      setState((s) => ({
        ...s,
        candles: candlesRef.current,
        currentCandle: candle,
        connected: true,
        latencyMs,
      }));
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (stopped) return;
      const controller = new AbortController();
      activeController = controller;

      const base = getApiBaseUrl();
      const token = getAuthToken();
      const url = new URL(`${base}/quick-trade/candle-feed`);
      url.searchParams.set("symbol", symbol.toUpperCase());
      url.searchParams.set("timeframe", timeframe);
      url.searchParams.set("history_limit", "200");
      url.searchParams.set("max_seconds", "300");

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
        setState((s) => ({ ...s, source: "sse" }));

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

              // Initial history batch from REST
              if (Array.isArray(payload.candles)) {
                payload.candles.forEach((c: CandleData) => {
                  if (c.time > 0) candlesRef.current = upsertCandle(candlesRef.current, c);
                });
                const last = candlesRef.current[candlesRef.current.length - 1] ?? null;
                setState((s) => ({
                  ...s,
                  candles: candlesRef.current,
                  currentCandle: last,
                  connected: true,
                  source: "sse",
                }));
              }

              // WS connected confirmation
              if (payload.connected === true) {
                setState((s) => ({ ...s, connected: true, source: "sse" }));
              }

              // Live candle update
              if (payload.candle && typeof payload.candle.time === "number") {
                apply(payload.candle as CandleData, payload.latency_ms ?? 0);
              }
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch (err) {
        if (stopped || (err as Error)?.name === "AbortError") return;
        setState((s) => ({ ...s, connected: false }));
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      activeController?.abort();
    };
  }, [symbol, timeframe, enabled]);

  return state;
}
