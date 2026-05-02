import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface FutureTradeSettings {
  symbols: string[];
  timeframe: string;
  paperTrading: boolean;
  liveTrading: boolean;
  forceTestnet: boolean;
  leverage: number;
  marginMode: string;
  tradeAmountUsdt: number;
  minConfidence: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  trailingTakeProfitPercent: number;
  rollbackLossPercent: number;
  maxDailyLossPercent: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  maxLeverage: number;
  maxSpreadPercent: number;
  cooldownSeconds: number;
  scanIntervalSeconds: number;
  autoExecutePaperSignals: boolean;
  avoidChoppyMarket: boolean;
  emergencyStop: boolean;
}

export interface FutureTradeStatus {
  botName: string;
  status: string;
  state: string;
  mode: string;
  exchange: string;
  connectionStatus: string;
  currentSymbol?: string | null;
  currentSignal: string;
  currentPrice: number;
  confidence: number;
  positionSide?: string | null;
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  dailyProfit: number;
  dailyLoss: number;
  winRate: number;
  tradeCountToday: number;
  lastScanAt?: string | null;
  settings: FutureTradeSettings;
  paperTrading: boolean;
  liveTrading: boolean;
  liveTradingEnvEnabled: boolean;
  walletBalance?: number | null;
  availableBalance?: number | null;
  marginBalance?: number | null;
  botProfit?: number | null;
  botLoss?: number | null;
  totalProfit?: number | null;
  balanceSource?: string | null;
  accountAsset?: string | null;
}

export interface FutureSignal {
  symbol: string;
  signal: "BUY" | "SELL" | "WAIT" | string;
  price: number;
  changePercent: number;
  volume: number;
  rangePercent: number;
  confidence: number;
  timeframe: string;
  reason: string;
}

export interface FutureTradeDashboard {
  status: FutureTradeStatus;
  scanner: FutureSignal[];
  bestSignal?: FutureSignal | null;
  chart: Array<{ time: string; symbol: string; price: number; pnl: number }>;
  levels: Record<string, number | null>;
  orderbook: { bids: Array<{ price: number; qty: number }>; asks: Array<{ price: number; qty: number }> };
  risk: { lossPrevention: string; paperTrading: boolean; liveTradingBlocked: boolean };
}

export interface FutureTradeConfig {
  id: string;
  settings: FutureTradeSettings;
  algorithm_notes?: string | null;
  paper_trading: boolean;
  enable_live_trading: boolean;
  live_env_enabled: boolean;
}

export interface FutureTradeRecord {
  id: string;
  symbol: string;
  side: string;
  entry_price?: string | number | null;
  exit_price?: string | number | null;
  quantity?: string | number | null;
  leverage?: string | number | null;
  net_pnl?: string | number | null;
  reason?: string | null;
  mode: string;
  status: string;
  created_at: string;
}

export interface FutureTradeLog {
  id: string;
  event: string;
  symbol?: string | null;
  signal?: string | null;
  price?: string | number | null;
  confidence?: string | number | null;
  reason?: string | null;
  occurred_at: string;
}

export function useFutureTradeBot(workspaceId?: string) {
  const queryClient = useQueryClient();
  const enabled = !!workspaceId;
  const base = `/workspaces/${workspaceId}/future-trade`;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["future-trade", workspaceId] });

  const dashboard = useQuery({
    queryKey: ["future-trade", workspaceId, "dashboard"],
    queryFn: async () => (await api.get<FutureTradeDashboard>(`${base}/dashboard`)).data,
    enabled,
    refetchInterval: 2500,
  });

  const config = useQuery({
    queryKey: ["future-trade", workspaceId, "config"],
    queryFn: async () => (await api.get<FutureTradeConfig>(`${base}/config`)).data,
    enabled,
  });

  const trades = useQuery({
    queryKey: ["future-trade", workspaceId, "trades"],
    queryFn: async () => (await api.get<FutureTradeRecord[]>(`${base}/trades`)).data,
    enabled,
    refetchInterval: 5000,
  });

  const logs = useQuery({
    queryKey: ["future-trade", workspaceId, "logs"],
    queryFn: async () => (await api.get<FutureTradeLog[]>(`${base}/logs`)).data,
    enabled,
    refetchInterval: 3000,
  });

  const useAction = (name: string) => useMutation({
    mutationFn: async () => (await api.post(`${base}/${name}`, {})).data,
    onSuccess: invalidate,
  });

  const updateConfig = useMutation({
    mutationFn: async (payload: Partial<FutureTradeConfig>) => (await api.put(`${base}/config`, payload)).data,
    onSuccess: invalidate,
  });

  return {
    dashboard,
    config,
    trades,
    logs,
    updateConfig,
    start: useAction("start"),
    stop: useAction("stop"),
    emergencyStop: useAction("emergency-stop"),
    resetPaper: useAction("reset-paper"),
  };
}
