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
  const scope = `${symbol}:${enabled}`;
  const [state, setState] = useState<BinanceFuturesQuoteState & { scope?: string }>(EMPTY_STATE);
  const latestRef = useRef<Omit<BinanceFuturesQuoteState, "connected"> | null>(null);

  useEffect(() => {
    latestRef.current = null;
    setState({ ...EMPTY_STATE, scope });
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
    let reconnectTimer: number | null = null;
    let animationFrame: number | null = null;
    let attempt = 0;
    let lastEventAt = 0;

    const flushLatest = () => {
      animationFrame = null;
      const latest = latestRef.current;
      if (!stopped && latest) setState({ ...latest, connected: true, scope });
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5));
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(`wss://fstream.binance.com/public/ws/${streamSymbol}@bookTicker`);

      socket.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setState((previous) => ({ ...previous, connected: true }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const eventAt = Number(payload?.E);
          if (stopped || String(payload?.s).toLowerCase() !== streamSymbol || !Number.isFinite(eventAt) || Date.now() - eventAt > 5000 || eventAt > Date.now() + 1000 || eventAt < lastEventAt) return;
          lastEventAt = eventAt;
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
    const staleTimer = window.setInterval(() => {
      setState((previous) => previous.receivedAt != null && Date.now() - previous.receivedAt > 2000
        ? { ...previous, connected: false } : previous);
    }, 1000);

    return () => {
      stopped = true;
      window.clearInterval(staleTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      socket?.close();
    };
  }, [enabled, symbol, scope]);

  return enabled && state.scope === scope ? state : EMPTY_STATE;
}

/**
 * Display-only multiplexed book-ticker stream for open Quick Trades. This is
 * intentionally separate from the chart candle feed: an open position must
 * update from the latest executable-market quote even if its chart is on a
 * slow interval or the user has selected a different symbol.
 */
export function useBinanceFuturesQuoteFeeds(symbols: string[], enabled: boolean): Record<string, BinanceFuturesQuoteState> {
  const normalizedSymbols = [...new Set(symbols
    .filter(isCryptoSymbol)
    .map((symbol) => symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")))]
    .sort();
  const scope = normalizedSymbols.join(",");
  const [quotes, setQuotes] = useState<Record<string, BinanceFuturesQuoteState>>({});
  const latestRef = useRef<Record<string, BinanceFuturesQuoteState>>({});

  useEffect(() => {
    latestRef.current = {};
    setQuotes({});
    if (!enabled || normalizedSymbols.length === 0) {
      latestRef.current = {};
      setQuotes({});
      return;
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let animationFrame: number | null = null;
    let attempt = 0;
    const streams = normalizedSymbols.map((symbol) => `${symbol.toLowerCase()}@bookTicker`).join("/");

    const flushLatest = () => {
      animationFrame = null;
      if (!stopped) setQuotes({ ...latestRef.current });
    };
    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      reconnectTimer = window.setTimeout(connect, Math.min(15_000, 500 * 2 ** Math.min(attempt, 5)));
    };
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(`wss://fstream.binance.com/public/stream?streams=${streams}`);
      socket.onopen = () => { attempt = 0; };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data))?.data;
          const symbol = String(payload?.s ?? "").toUpperCase();
          const bid = Number(payload?.b);
          const ask = Number(payload?.a);
          if (!normalizedSymbols.includes(symbol) || !Number.isFinite(bid) || bid <= 0 || !Number.isFinite(ask) || ask <= 0) return;
          latestRef.current[symbol] = { bid, ask, price: (bid + ask) / 2, receivedAt: Date.now(), connected: true };
          if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushLatest);
        } catch {
          // Await the next valid exchange frame.
        }
      };
      socket.onclose = scheduleReconnect;
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      socket?.close();
    };
  // `scope` is a stable value derived from the symbol set; do not reconnect
  // just because the active-trades query returns a new array instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scope]);

  return quotes;
}
