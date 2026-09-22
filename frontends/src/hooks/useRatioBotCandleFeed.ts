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
  const rawTime = row?.time ?? row?.timestamp ?? row?.ts ?? 0;
  const numericTime = Number(rawTime);
  const time = Number.isFinite(numericTime)
    ? (numericTime > 10_000_000_000 ? Math.floor(numericTime / 1000) : numericTime)
    : Math.floor(new Date(String(rawTime)).getTime() / 1000);
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
    // Binance can deliver a delayed frame after a reconnect. Keep its exchange
    // event timestamp separate from chart time so an older update never rolls
    // an open candle backwards. The map is reset with the symbol/timeframe.
    const eventTimestampByCandle = new Map<number, number>();

    const apply = (
      candle: CandleData,
      latencyMs: number,
      source: RobotFeedState["source"],
      eventTimestampMs = Date.now(),
    ) => {
      const previousEventTimestamp = eventTimestampByCandle.get(candle.time) ?? 0;
      if (eventTimestampMs < previousEventTimestamp) return;
      eventTimestampByCandle.set(candle.time, eventTimestampMs);
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

    // A kline websocket starts with the current open candle; it does not send
    // the chart window. Bootstrap from the authorized Ratio Bot history API in
    // parallel with the socket. Merge (rather than replace) so a fast live
    // update received during the request is retained.
    const bootstrapHistory = async () => {
      if (!botId) return;

      try {
        const token = getAuthToken();
        const base = getApiBaseUrl();
        const url = new URL(`${base}/ratio-bots/${botId}/candles`);
        url.searchParams.set("limit", "200");
        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok || stopped) return;

        const rows = await response.json();
        if (!Array.isArray(rows) || stopped) return;
        for (const row of rows) {
          const candle = normalizeCandle({
            time: row?.time,
            timestamp: row?.timestamp ?? row?.ts,
            open: row?.open,
            high: row?.high,
            low: row?.low,
            close: row?.close,
            volume: row?.volume,
            is_closed: true,
          }, true);
          if (!candle) continue;
          // Historical rows are context, not a newer live observation.
          // They may fill a missing candle but cannot overwrite a WS update.
          if (eventTimestampByCandle.has(candle.time)) continue;
          eventTimestampByCandle.set(candle.time, 0);
          candlesRef.current = upsertCandle(candlesRef.current, candle);
        }
        setState((s) => ({ ...s, candles: candlesRef.current }));
      } catch {
        // The direct exchange socket remains the low-latency source. A failed
        // history request must not interrupt it or trigger a reconnect loop.
      }
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
            apply(candle, Math.max(0, Date.now() - eventTs), "ws", eventTs);
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
                if (candle) apply(candle, 0, "sse", Number(payload?.event_timestamp_ms ?? Date.now()));
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
      void bootstrapHistory();
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
