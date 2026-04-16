import { useState, useEffect, useCallback, useRef } from 'react';

interface PriceData {
  price: number;
  change24h: number;
  change24hPercent: number;
}

interface RealtimePricesState {
  prices: Record<string, PriceData>;
  isConnected: boolean;
  error: string | null;
  lastUpdate: Date | null;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  stale: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const WS_BASE = import.meta.env.VITE_WS_MARKET_URL || '';
const SSE_URL = import.meta.env.VITE_SSE_MARKET_URL || '';

export function useRealtimePrices() {
  const [state, setState] = useState<RealtimePricesState>({
    prices: {},
    isConnected: true,
    error: null,
    lastUpdate: null,
    lastHeartbeat: null,
    reconnectAttempts: 0,
    stale: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/market/ticks`);
      if (!res.ok) throw new Error('Failed to load ticks');
      const data = await res.json();
      const mapped: Record<string, PriceData> = {};
      (data || []).forEach((item: any) => {
        mapped[item.symbol] = {
          price: Number(item.price) || 0,
          change24h: Number(item.change24h) || 0,
          change24hPercent: Number(item.change24hPercent) || 0,
        };
      });
      setState((prev) => ({
        ...prev,
        prices: mapped,
        isConnected: true,
        error: null,
        lastUpdate: new Date(),
        stale: false,
      }));
    } catch (error: any) {
      setState((prev) => ({ ...prev, error: error.message, isConnected: false }));
    }
  }, []);

  const openSocket = useCallback(() => {
    if (!WS_BASE) {
      return;
    }
    try {
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null, reconnectAttempts: prev.reconnectAttempts }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'ticks' }));
        ws.send(JSON.stringify({ type: 'ping' }));
        heartbeatRef.current = window.setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch {
            // ignore
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'pong' || data?.pong) {
            setState((prev) => ({ ...prev, lastHeartbeat: new Date(), stale: false }));
            return;
          }

          const payload = Array.isArray(data) ? data : data?.ticks || [];
          const mapped: Record<string, PriceData> = {};
          (payload || []).forEach((item: any) => {
            if (!item?.symbol) return;
            mapped[item.symbol] = {
              price: Number(item.price) || 0,
              change24h: Number(item.change24h) || 0,
              change24hPercent: Number(item.change24hPercent) || 0,
            };
          });
          if (Object.keys(mapped).length > 0) {
            setState({ prices: mapped, isConnected: true, error: null, lastUpdate: new Date(), lastHeartbeat: new Date(), reconnectAttempts: 0, stale: false });
          }
        } catch (err: any) {
          setState((prev) => ({ ...prev, error: err.message }));
        }
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, isConnected: false, error: 'WebSocket error' }));
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));
        if (reconnectRef.current === null) {
          reconnectRef.current = window.setTimeout(() => {
            reconnectRef.current = null;
            setState((prev) => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            openSocket();
            if (!wsRef.current) {
              // fallback to SSE if WS cannot connect
              openSse();
            }
          }, 2000);
        }
      };
    } catch (err: any) {
      setState((prev) => ({ ...prev, error: err.message, isConnected: false }));
    }
  }, []);

  const openSse = useCallback(() => {
    if (!SSE_URL) {
      return;
    }
    try {
      const sse = new EventSource(SSE_URL);
      sseRef.current = sse;
      sse.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const payload = Array.isArray(data) ? data : data?.ticks || [];
        const mapped: Record<string, PriceData> = {};
        (payload || []).forEach((item: any) => {
          if (!item?.symbol) return;
          mapped[item.symbol] = {
            price: Number(item.price) || 0,
            change24h: Number(item.change24h) || 0,
            change24hPercent: Number(item.change24hPercent) || 0,
          };
        });
        if (Object.keys(mapped).length > 0) {
          setState({
            prices: mapped,
            isConnected: true,
            error: null,
            lastUpdate: new Date(),
            lastHeartbeat: new Date(),
            reconnectAttempts: 0,
            stale: false,
          });
        }
      };
      sse.onerror = () => {
        setState((prev) => ({ ...prev, isConnected: false, error: 'SSE error' }));
      };
    } catch (err: any) {
      setState((prev) => ({ ...prev, error: err.message, isConnected: false }));
    }
  }, []);

  useEffect(() => {
    openSocket();
    openSse(); // optional fallback when VITE_SSE_MARKET_URL is configured
    fetchPrices(); // initial backstop
    const id = setInterval(fetchPrices, 15000);
    const staleCheck = setInterval(() => {
      setState((prev) => {
        const last = prev.lastHeartbeat || prev.lastUpdate;
        if (!last) return prev;
        const diff = Date.now() - last.getTime();
        return { ...prev, stale: diff > 20000 };
      });
    }, 5000);
    return () => {
      clearInterval(id);
      clearInterval(staleCheck);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [fetchPrices, openSocket]);

  return {
    ...state,
    reconnect: fetchPrices,
    subscribe: () => {},
    unsubscribe: () => {},
  };
}
