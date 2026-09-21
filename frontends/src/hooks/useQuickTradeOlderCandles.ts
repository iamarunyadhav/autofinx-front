import { useEffect, useRef, useState } from "react";
import { authorizedFetch } from "@/lib/api";
import type { CandleData } from "@/hooks/useRobotCandleFeed";

export function useQuickTradeOlderCandles(symbol: string, timeframe: string, context: string) {
  const scope = `${symbol}:${timeframe}:${context}`;
  const [state, setState] = useState({ scope, candles: [] as CandleData[], loading: false, exhausted: false, error: "" });
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setState({ scope, candles: [], loading: false, exhausted: false, error: "" });
    return () => request.current?.abort();
  }, [scope]);
  const current = state.scope === scope ? state : { scope, candles: [], loading: false, exhausted: false, error: "" };
  const loadOlder = async (before: number) => {
    if (request.current || !before || current.exhausted || current.candles.length >= 5000) return;
    const controller = new AbortController();
    request.current = controller;
    setState((s) => ({ ...s, scope, loading: true, error: "" }));
    try {
      const result = await authorizedFetch("/quick-trade/candle-history", "GET", undefined, {
        params: { symbol, timeframe, before }, signal: controller.signal,
      }) as { symbol: string; timeframe: string; candles: CandleData[] };
      if (controller.signal.aborted || result.symbol !== symbol || result.timeframe !== timeframe) return;
      setState((s) => {
        if (s.scope !== scope) return s;
        const merged = new Map(s.candles.map((c) => [c.time, c]));
        for (const candle of result.candles) merged.set(candle.time, candle);
        return { ...s, candles: [...merged.values()].sort((a, b) => a.time - b.time).slice(-5000), exhausted: result.candles.length === 0 };
      });
    } catch (error) {
      if (!controller.signal.aborted) setState((s) => s.scope === scope ? { ...s, error: (error as Error).message } : s);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setState((s) => s.scope === scope ? { ...s, loading: false } : s);
    }
  };
  return { ...current, loadOlder, atCapacity: current.candles.length >= 5000 };
}
