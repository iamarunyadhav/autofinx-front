import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth";
import type { CandleData, RobotFeedState } from "@/hooks/useRobotCandleFeed";
import {
  binanceKlineStreamUrl,
  isCryptoSymbol,
  parseBinanceKlineMessage,
  upsertCandle,
} from "@/hooks/binanceCandleWs";

function matchesRequestedSymbol(payloadSymbol: unknown, requestedSymbol: string): boolean {
  if (payloadSymbol == null || payloadSymbol === "") return true;
  const normalize = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalize(payloadSymbol) === normalize(requestedSymbol);
}

/**
 * Live candle feed for Quick Trade's chart.
 *
 * Mirrors useRatioBotCandleFeed's / useRobotCandleFeed's proven pattern:
 * crypto symbols connect a direct browser -> Binance WebSocket for the
 * lowest latency (Quick Trade's "Live Timed Trade" mode opens Binance
 * futures positions, so the futures WS host is used here, same as
 * useRobotCandleFeed). Non-crypto symbols keep using the backend SSE
 * candle-feed endpoint exactly as before.
 */
export function useQuickTradeCandleFeed(
  symbol: string,
  timeframe: string,
  enabled: boolean,
): RobotFeedState & { lastPriceAt?: number } {
  const scope = `${symbol}:${timeframe}:${enabled}`;
  const [state, setState] = useState<RobotFeedState & { lastPriceAt?: number; scope: string }>({
    scope,
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
      setState({ scope, candles: [], currentCandle: null, lastSignal: null, connected: false, latencyMs: 0, source: null });
      return;
    }

    candlesRef.current = [];
    setState({ scope, candles: [], currentCandle: null, lastSignal: null, connected: false, latencyMs: 0, source: null });

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let activeController: AbortController | null = null;
    let activeSocket: WebSocket | null = null;

    const apply = (candle: CandleData, latencyMs: number, source: RobotFeedState["source"]) => {
      if (stopped) return;
      candlesRef.current = upsertCandle(candlesRef.current, candle);
      setState((s) => ({
        ...s,
        candles: candlesRef.current,
        currentCandle: candle,
        lastPriceAt: Date.now() - Math.max(0, latencyMs),
        connected: true,
        latencyMs,
        source,
      }));
    };

    const scheduleReconnect = (connect: () => void) => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      reconnectTimer = setTimeout(connect, delay);
    };

    const connectBinanceWebSocket = () => {
      if (stopped) return;
      const socket = new WebSocket(binanceKlineStreamUrl(symbol, timeframe, "futures"));
      activeSocket = socket;

      socket.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setState((s) => ({ ...s, connected: true, source: "ws" }));
      };

      socket.onmessage = (event) => {
        const parsed = parseBinanceKlineMessage(String(event.data));
        if (!parsed) return;
        apply(
          { ...parsed.candle, symbol: symbol.toUpperCase() },
          Math.max(0, Date.now() - parsed.eventTs),
          "ws",
        );
      };

      socket.onerror = () => {
        if (stopped) return;
        setState((s) => ({ ...s, connected: false, source: "ws" }));
      };

      socket.onclose = () => {
        if (stopped) return;
        setState((s) => ({ ...s, connected: false, source: "ws" }));
        // Keep the lowest-latency direct WS as primary. After two consecutive
        // disconnects, move the browser to the server-owned SSE path so the UI
        // can continue receiving the same scoped feed while the direct socket
        // recovers. The backend signal/order path remains Redis-authoritative.
        attempt += 1;
        if (attempt >= 2) {
          void connectQuickTradeSse();
        } else {
          scheduleReconnect(connectBinanceWebSocket);
        }
      };
    };

    const connectQuickTradeSse = async () => {
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
        if (stopped) return;

        if (!resp.ok || !resp.body) throw new Error(`SSE ${resp.status}`);

        attempt = 0;
        setState((s) => ({ ...s, source: "sse" }));

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done || stopped) break;
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
              if (!matchesRequestedSymbol(payload.symbol, symbol)) {
                continue;
              }

              if (Array.isArray(payload.candles)) {
                payload.candles.forEach((c: CandleData) => {
                  if (c.time > 0 && matchesRequestedSymbol(c.symbol, symbol)) {
                    candlesRef.current = upsertCandle(candlesRef.current, { ...c, symbol: symbol.toUpperCase() });
                  }
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
              if (payload.candle && typeof payload.candle.time === "number" && matchesRequestedSymbol(payload.candle.symbol, symbol)) {
                apply({ ...(payload.candle as CandleData), symbol: symbol.toUpperCase() }, payload.latency_ms ?? 0, "sse");
              }
            } catch {
              /* ignore malformed frame */
            }
          }
        }
        if (!stopped) scheduleReconnect(() => void connectQuickTradeSse());
      } catch (err) {
        if (stopped || (err as Error)?.name === "AbortError") return;
        setState((s) => ({ ...s, connected: false }));
        scheduleReconnect(() => void connectQuickTradeSse());
      }
    };

    // Never silently subscribe to 1m candles for a different chart interval.
    if (isCryptoSymbol(symbol) && ["1m", "3m", "5m", "15m", "30m", "1h", "4h"].includes(timeframe)) {
      connectBinanceWebSocket();
    } else {
      void connectQuickTradeSse();
    }

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      activeSocket?.close();
      activeController?.abort();
    };
  }, [symbol, timeframe, enabled, scope]);

  // Effects run after render: never expose the previous symbol/interval during
  // that render, where it could otherwise seed a new forecast request.
  return state.scope === scope && enabled ? state : {
    candles: [], currentCandle: null, lastSignal: null,
    connected: false, latencyMs: 0, source: null,
  };
}
