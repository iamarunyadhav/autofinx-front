import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth";
import type { CandleData, RobotFeedState } from "@/hooks/useRobotCandleFeed";

export type { CandleData, RobotFeedState } from "@/hooks/useRobotCandleFeed";

const CRYPTO_QUOTES = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"];

function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return CRYPTO_QUOTES.some((q) => s.endsWith(q));
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

function normalizeCandle(row: any, fallbackClosed = false): CandleData | null {
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

/**
 * Live candle feed for the Ratio Bot chart — mirrors useRobotCandleFeed's
 * proven pattern (direct browser-to-Binance WS for the lowest latency,
 * backend SSE fallback otherwise) instead of REST polling, so Ratio Bot
 * gets the same no-added-latency behavior Robot Trade already has.
 *
 * Differs from useRobotCandleFeed only in: parameterized by ratio-bot id
 * instead of a robot-session id, SSE fallback hits /ratio-bots/{id}/candle-feed,
 * and the WS host is chosen by market_type (spot vs futures) since Ratio Bot
 * (unlike Robot Trade) genuinely runs both.
 */
export function useRatioBotCandleFeed(
  symbol: string,
  timeframe: string,
  enabled: boolean,
  botId?: string,
  marketType: "spot" | "futures" = "spot",
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
    setState((s) => ({ ...s, candles: [], currentCandle: null, connected: false, source: null }));

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let activeController: AbortController | null = null;
    let activeSocket: WebSocket | null = null;

    const apply = (candle: CandleData, latencyMs: number, source: RobotFeedState["source"]) => {
      candlesRef.current = upsertCandle(candlesRef.current, candle);
      setState((s) => ({
        ...s,
        candles: candlesRef.current,
        currentCandle: candle,
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

    const readSse = async (
      url: URL,
      controller: AbortController,
      onPayload: (payload: any) => void,
      source: RobotFeedState["source"],
    ) => {
      const token = getAuthToken();
      const resp = await fetch(url.toString(), {
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`SSE ${resp.status}`);

      attempt = 0;
      setState((s) => ({ ...s, connected: true, source }));

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
            onPayload(JSON.parse(dataLine.slice(5).trim()));
          } catch {
            /* ignore malformed event */
          }
        }
      }
    };

    const connectBinanceWebSocket = () => {
      if (stopped) return;
      const streamSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
      const interval = ["1m", "3m", "5m", "15m", "30m", "1h", "4h"].includes(timeframe)
        ? timeframe
        : "1m";
      const host = marketType === "futures" ? "wss://fstream.binance.com/ws" : "wss://stream.binance.com:9443/ws";
      const socket = new WebSocket(`${host}/${streamSymbol}@kline_${interval}`);
      activeSocket = socket;

      socket.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, connected: true, source: "ws" }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const kline = payload?.k;
          if (!kline) return;

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

          if (candle) {
            apply(candle, Math.max(0, Date.now() - eventTs), "ws");
          }
        } catch {
          /* ignore malformed websocket frame */
        }
      };

      socket.onerror = () => {
        if (stopped) return;
        setState((s) => ({ ...s, connected: false, source: "ws" }));
      };

      socket.onclose = () => {
        if (stopped) return;
        setState((s) => ({ ...s, connected: false, source: "ws" }));
        scheduleReconnect(connectBinanceWebSocket);
      };
    };

    const connectRatioBotSse = () => {
      if (stopped || !botId) {
        setState((s) => ({ ...s, connected: false, source: null }));
        return;
      }
      const base = getApiBaseUrl();
      const url = new URL(`${base}/ratio-bots/${botId}/candle-feed`);
      const controller = new AbortController();
      activeController = controller;

      (async () => {
        try {
          await readSse(
            url,
            controller,
            (payload) => {
              const rows: any[] = payload.candles ?? [];
              rows.forEach((row, index) => {
                const candle = normalizeCandle(row, index < rows.length - 1);
                if (candle) apply(candle, 0, "sse");
              });
            },
            "sse",
          );
          if (!stopped) scheduleReconnect(connectRatioBotSse);
        } catch (err) {
          if (stopped || (err as Error)?.name === "AbortError") return;
          setState((s) => ({ ...s, connected: false, source: "sse" }));
          scheduleReconnect(connectRatioBotSse);
        }
      })();
    };

    if (isCryptoSymbol(symbol)) {
      connectBinanceWebSocket();
    } else {
      connectRatioBotSse();
    }

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      activeSocket?.close();
      activeController?.abort();
    };
  }, [symbol, timeframe, enabled, botId, marketType]);

  return state;
}
