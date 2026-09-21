import { useEffect, useRef, useState } from "react";
import { isCryptoSymbol } from "@/hooks/binanceCandleWs";

export interface BinanceFuturesQuoteState {
  price: number | null;
  bid: number | null;
  ask: number | null;
  receivedAt: number | null;
  connected: boolean;
}

const EMPTY_STATE: BinanceFuturesQuoteState = {
  price: null,
  bid: null,
  ask: null,
  receivedAt: null,
  connected: false,
};

/**
 * Browser-only display quote stream for Quick Trade.
 *
 * Binance pushes bookTicker updates as they occur. We retain only the latest
 * bid/ask and commit it once per animation frame, which keeps the visual price
 * responsive without asking React to render every exchange packet. This value
 * is deliberately never sent back as an executable order price: the server's
 * own Redis/WebSocket freshness gate remains the sole execution authority.
 */
export function useBinanceFuturesQuoteFeed(symbol: string, enabled: boolean): BinanceFuturesQuoteState {
  const [state, setState] = useState<BinanceFuturesQuoteState>(EMPTY_STATE);
  const latestRef = useRef<Omit<BinanceFuturesQuoteState, "connected"> | null>(null);

  useEffect(() => {
    if (!enabled || !isCryptoSymbol(symbol)) {
      setState(EMPTY_STATE);
      return;
    }

    const streamSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!streamSymbol) {
      setState(EMPTY_STATE);
      return;
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let animationFrame: number | null = null;
    let attempt = 0;

    const flushLatest = () => {
      animationFrame = null;
      const latest = latestRef.current;
      if (!stopped && latest) setState({ ...latest, connected: true });
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5));
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@bookTicker`);

      socket.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setState((previous) => ({ ...previous, connected: true }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const bid = Number(payload?.b);
          const ask = Number(payload?.a);
          if (!Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0) return;

          latestRef.current = {
            bid,
            ask,
            price: (bid + ask) / 2,
            receivedAt: Date.now(),
          };
          if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushLatest);
        } catch {
          // Ignore an invalid exchange frame and await the next book update.
        }
      };

      socket.onerror = () => {
        if (!stopped) setState((previous) => ({ ...previous, connected: false }));
      };

      socket.onclose = () => {
        if (stopped) return;
        setState((previous) => ({ ...previous, connected: false }));
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      socket?.close();
    };
  }, [enabled, symbol]);

  return state;
}
