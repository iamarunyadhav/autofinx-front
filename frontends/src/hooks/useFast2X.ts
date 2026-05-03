import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Fast2XSettings {
  symbol: string;
  tradeMode: string;
  botMode: string;
  paperTrading: boolean;
  tradeAmountType: string;
  tradeAmountValue: number;
  minProfitTargetPercent: number;
  rollbackLossPercent: number;
  manualSellThresholdPercent: number;
  manualBuyThresholdPercent: number;
  useDynamicThreshold: boolean;
  useIndicators: boolean;
  useStopLoss: boolean;
  useTrailingTakeProfit: boolean;
  stopLossPercent: number;
  trailingTakeProfitPercent: number;
  maxAllowedSlippagePercent: number;
  minimumProfitAfterFeesPercent: number;
  cooldownSeconds: number;
  maxTradesPerMinute: number;
  maxTradesPerDay: number;
  maxDailyLossPercent: number;
  maxApiLatencyMs: number;
  emergencyStop: boolean;
  [key: string]: string | number | boolean;
}

export interface Fast2XConfig {
  id: string;
  settings: Fast2XSettings;
  paper_trading: boolean;
  enable_live_trading: boolean;
  ai_brain_enabled: boolean;
  algorithm_markdown?: string | null;
  available_symbols?: string[];
}

export interface Fast2XStatus {
  botName: string;
  state: string;
  status: string;
  mode: string;
  exchange: string;
  symbol: string;
  webSocketStatus: string;
  latencyMs: number;
  lastPriceUpdateTime?: string | null;
  paperTrading: boolean;
  liveTradingEnabled: boolean;
  aiBrainEnabled: boolean;
  decision: string;
  dynamicThresholds?: Record<string, unknown> | null;
  indicatorConfirmation?: Record<string, unknown> | null;
  settings: Fast2XSettings;
}

export interface Fast2XPrice {
  currentPrice: number;
  change24h: number;
  spread?: number | null;
  volume?: number | null;
  lastTickTime?: string | null;
  latencyMs: number;
}

export interface Fast2XPnl {
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  netPnLAfterFees: number;
  netPnLPercent: number;
  dailyProfit: number;
  dailyLoss: number;
  winRate: number;
  tradeCountToday: number;
  currentPeak: number;
  currentBottom: number;
}

export interface Fast2XTrade {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  entry_price?: string | number | null;
  exit_price?: string | number | null;
  quantity?: string | number | null;
  gross_pnl?: string | number | null;
  fees?: string | number | null;
  net_pnl?: string | number | null;
  reason?: string | null;
  mode: string;
  status: string;
}

export interface Fast2XLog {
  id: string;
  event: string;
  reason?: string | null;
  current_price?: string | number | null;
  net_pnl_percent?: string | number | null;
  occurred_at: string;
}

export interface Fast2XChartPoint {
  index: number;
  time: string;
  price: number;
  bid?: number | null;
  ask?: number | null;
  entry?: number | null;
  stopLoss?: number | null;
  profitTarget?: number | null;
  trailingTakeProfit?: number | null;
  peak?: number | null;
  bottom?: number | null;
}

export interface Fast2XChartPayload {
  points: Fast2XChartPoint[];
  markers: Array<{ time: string; side: string; price: number; netPnl: number; reason?: string | null }>;
  levels: Record<string, number | null>;
  autoManagement: {
    state: string;
    decision: string;
    mode: string;
    aiBrainEnabled: boolean;
    dynamicThresholds?: Record<string, unknown> | null;
    indicatorConfirmation?: Record<string, unknown> | null;
    riskControls: Record<string, number>;
  };
}

export function useFast2X(workspaceId?: string) {
  const queryClient = useQueryClient();
  const enabled = !!workspaceId;
  const base = `/workspaces/${workspaceId}/fast2x`;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fast2x", workspaceId] });
  };

  const status = useQuery({
    queryKey: ["fast2x", workspaceId, "status"],
    queryFn: async () => (await api.get<Fast2XStatus>(`${base}/status`)).data,
    enabled,
    refetchInterval: 3000,
  });

  const config = useQuery({
    queryKey: ["fast2x", workspaceId, "config"],
    queryFn: async () => (await api.get<Fast2XConfig>(`${base}/config`)).data,
    enabled,
  });

  const price = useQuery({
    queryKey: ["fast2x", workspaceId, "live-price"],
    queryFn: async () => (await api.get<Fast2XPrice>(`${base}/live-price`)).data,
    enabled,
    refetchInterval: 2500,
  });

  const pnl = useQuery({
    queryKey: ["fast2x", workspaceId, "pnl"],
    queryFn: async () => (await api.get<Fast2XPnl>(`${base}/pnl`)).data,
    enabled,
    refetchInterval: 3000,
  });

  const trades = useQuery({
    queryKey: ["fast2x", workspaceId, "trades"],
    queryFn: async () => (await api.get<Fast2XTrade[]>(`${base}/trades`)).data,
    enabled,
    refetchInterval: 5000,
  });

  const logs = useQuery({
    queryKey: ["fast2x", workspaceId, "logs"],
    queryFn: async () => (await api.get<Fast2XLog[]>(`${base}/logs`)).data,
    enabled,
    refetchInterval: 3000,
  });

  const chart = useQuery({
    queryKey: ["fast2x", workspaceId, "chart"],
    queryFn: async () => (await api.get<Fast2XChartPayload>(`${base}/chart`)).data,
    enabled,
    refetchInterval: 1500,
  });

  const useAction = (name: string) => useMutation({
    mutationFn: async () => (await api.post(`${base}/${name}`, {})).data,
    onSuccess: invalidate,
  });

  const updateConfig = useMutation({
    mutationFn: async (payload: Partial<Fast2XConfig>) => (await api.put(`${base}/config`, payload)).data,
    onSuccess: invalidate,
  });

  return {
    status,
    config,
    price,
    pnl,
    trades,
    logs,
    chart,
    updateConfig,
    start: useAction("start"),
    pause: useAction("pause"),
    stop: useAction("stop"),
    emergencyStop: useAction("emergency-stop"),
    resetPaper: useAction("reset-paper"),
  };
}
