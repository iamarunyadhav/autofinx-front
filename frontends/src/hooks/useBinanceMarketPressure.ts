import { useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

export type PressureWindow = "1m" | "5m" | "15m";
export type PressureConnectionState = "live" | "stale" | "offline" | "disabled";

export interface MarketPressureSnapshot {
  buyPct: number | null; sellPct: number | null; buyNotional: number; sellNotional: number;
  cvd: number; tradeCount: number; momentum: "increasing" | "decreasing" | "stable" | "unavailable";
  state: PressureConnectionState; usable: boolean; eventAgeMs: number | null; lastPrice: number | null; source: string;
  orderBook: { kind: string; bid_pct: number; ask_pct: number; imbalance: number; spread_bps: number | null } | null;
}

interface ServerPressurePayload {
  buy_pressure_pct?: number | null; sell_pressure_pct?: number | null; buy_notional?: number;
  sell_notional?: number; cvd_notional?: number; trade_count?: number;
  momentum?: MarketPressureSnapshot["momentum"]; state?: PressureConnectionState; usable?: boolean;
  event_age_ms?: number | null; last_price?: number | null; source?: string;
  order_book?: MarketPressureSnapshot["orderBook"];
}

const EMPTY: MarketPressureSnapshot = {
  buyPct: null, sellPct: null, buyNotional: 0, sellNotional: 0, cvd: 0, tradeCount: 0,
  momentum: "unavailable", state: "offline", usable: false, eventAgeMs: null, lastPrice: null,
  source: "binance_usdm_aggtrade",
  orderBook: null,
};

/** Server/Redis-backed read-only pressure; never participates in order placement. */
export function useBinanceMarketPressure(workspaceId: string | undefined, symbol: string, selectedWindow: PressureWindow, enabled = true) {
  const query = useQuery({
    queryKey: ["market-pressure", workspaceId, symbol, selectedWindow],
    queryFn: async () => authorizedFetch(`/workspaces/${workspaceId}/quick-trade/market-pressure?symbol=${encodeURIComponent(symbol)}&window=${selectedWindow}`) as Promise<ServerPressurePayload>,
    enabled: enabled && Boolean(workspaceId) && Boolean(symbol),
    refetchInterval: 1_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 500,
  });
  const data = query.data;
  const snapshot: MarketPressureSnapshot = data ? {
    buyPct: data.buy_pressure_pct ?? null, sellPct: data.sell_pressure_pct ?? null,
    buyNotional: Number(data.buy_notional ?? 0), sellNotional: Number(data.sell_notional ?? 0),
    cvd: Number(data.cvd_notional ?? 0), tradeCount: Number(data.trade_count ?? 0),
    momentum: data.momentum ?? "unavailable", state: data.state ?? "offline", usable: data.usable === true,
    eventAgeMs: data.event_age_ms ?? null, lastPrice: data.last_price ?? null,
    source: data.source ?? "binance_usdm_aggtrade",
    orderBook: data.order_book ?? null,
  } : EMPTY;
  return { ...query, snapshot };
}
