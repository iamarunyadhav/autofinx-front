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
  confidenceMode: "fixed" | "semi_dynamic" | "fully_dynamic" | string;
  dynamicLookbackMinutes: number;
  dynamicMinConfidenceFloor: number;
  dynamicMinConfidenceCeiling: number;
  dynamicReentryBuffer: number;
  dynamicSuggestionEnabled: boolean;
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
  entryReason?: string | null;
  currentPrice: number;
  confidence: number;
  activeMinConfidence?: number | null;
  signalConfidenceGap?: number | null;
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
  dynamic?: FutureTradeDynamicDecision;
  paperTrading: boolean;
  liveTrading: boolean;
  dailyLossLocked?: boolean;
  manualRestartAllowed?: boolean;
  liveTradingEnvEnabled: boolean;
  testnetTradingEnvEnabled?: boolean;
  realTradingEnvEnabled?: boolean;
  walletBalance?: number | null;
  availableBalance?: number | null;
  marginBalance?: number | null;
  botProfit?: number | null;
  botLoss?: number | null;
  totalProfit?: number | null;
  balanceSource?: string | null;
  accountAsset?: string | null;
  balanceError?: string | null;
}

export interface FutureSignal {
  symbol: string;
  signal: "BUY" | "SELL" | "WAIT" | string;
  price: number;
  changePercent: number;
  volume: number;
  rangePercent: number;
  confidence: number;
  effectiveMinConfidence?: number;
  dynamicMode?: string;
  timeframe: string;
  reason: string;
}

export interface FutureTradeDynamicDecision {
  mode: string;
  baseMinConfidence: number;
  effectiveMinConfidence: number;
  recommended: {
    minConfidence: number;
    takeProfitPercent: number;
    stopLossPercent: number;
    trailingTakeProfitPercent: number;
    cooldownSeconds: number;
    tradeAmountUsdt: number;
  };
  analysis: {
    lookbackMinutes: number;
    sampleCount: number;
    usableSignalCount?: number;
    priceChangePercent: number;
    volatilityPercent: number;
    direction: string;
    priceDirection?: string;
    signalDirection?: string;
    directionSource?: string;
    directionAgreement: number;
    confidenceGap: number;
    trendStrength: number;
    choppy: boolean;
    bestConfidence: number;
    lastTradeReason?: string | null;
    winRate: number;
  };
  adjustments: string[];
  suggestion: string;
}

export interface FutureTradeDynamicPoint {
  time: string;
  symbol: string;
  signal?: string | null;
  price: number;
  pnl: number;
  confidence?: number | null;
  algorithmMode?: string | null;
  algorithmFlag?: "NORMAL" | "SEMI" | "AUTO" | string | null;
  effectiveMinConfidence?: number | null;
  activeTakeProfitPercent?: number | null;
  activeStopLossPercent?: number | null;
  activeTrailingTakeProfitPercent?: number | null;
  activeCooldownSeconds?: number | null;
  activeTradeAmountUsdt?: number | null;
  trendStrength?: number | null;
  directionAgreement?: number | null;
  choppy?: boolean | null;
  decisionStatus?: string | null;
}

export interface FutureTradeDiagnosticsCheck {
  label: string;
  state: string;
  message: string;
}

export interface FutureTradeDiagnosticsAlert {
  event: string;
  reason?: string | null;
  occurredAt?: string | null;
}

export interface FutureTradeDiagnosticsRun {
  id: string;
  command: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
}

export interface FutureTradeDiagnostics {
  state: string;
  summary: string;
  generatedAt?: string | null;
  botBlockers: string[];
  botWarnings: string[];
  botChecks: FutureTradeDiagnosticsCheck[];
  wallet: {
    state: string;
    message: string;
    walletBalance?: number | null;
    availableBalance?: number | null;
    marginBalance?: number | null;
    accountAsset?: string | null;
    requiredTradeAmountUsdt?: number | null;
  };
  server: {
    state: string;
    blockers: string[];
    warnings: string[];
    scheduler?: Record<string, unknown> | null;
    queue?: {
      state?: string;
      blockers?: string[];
      warnings?: string[];
      queue_backlog?: number;
      failed_jobs?: number;
      warning_threshold?: number;
      block_threshold?: number;
      [key: string]: unknown;
    } | null;
    rest?: Record<string, unknown> | null;
    streams?: Record<string, unknown> | null;
  };
  latestAlert?: FutureTradeDiagnosticsAlert | null;
  recentSchedulerRuns?: FutureTradeDiagnosticsRun[];
}

export interface FutureTradeDashboard {
  status: FutureTradeStatus;
  scanner: FutureSignal[];
  bestSignal?: FutureSignal | null;
  chart: FutureTradeDynamicPoint[];
  levels: Record<string, number | null>;
  orderbook: { bids: Array<{ price: number; qty: number }>; asks: Array<{ price: number; qty: number }> };
  risk: { lossPrevention: string; paperTrading: boolean; liveTradingBlocked: boolean };
  dynamic?: FutureTradeDynamicDecision;
  diagnostics?: FutureTradeDiagnostics;
}

export interface FutureTradeConfig {
  id: string;
  settings: FutureTradeSettings;
  algorithm_notes?: string | null;
  paper_trading: boolean;
  enable_live_trading: boolean;
  live_env_enabled: boolean;
  testnet_env_enabled?: boolean;
  real_env_enabled?: boolean;
  available_symbols?: string[];
}

export interface FutureTradeEnvConfig {
  mode: "paper" | "testnet" | "live";
  testnet_enabled: boolean;
  live_enabled: boolean;
  force_testnet: boolean;
  live_api_url: string;
  testnet_api_url: string;
  live_api_key: string;
  live_api_secret_masked?: string;
  testnet_api_key: string;
  testnet_api_secret_masked?: string;
  live_configured: boolean;
  testnet_configured: boolean;
}

export interface FutureTradeEnvConfigPayload {
  mode: "paper" | "testnet" | "live";
  testnet_enabled: boolean;
  live_enabled: boolean;
  force_testnet: boolean;
  live_api_url: string;
  testnet_api_url: string;
  live_api_key?: string;
  live_api_secret?: string;
  testnet_api_key?: string;
  testnet_api_secret?: string;
  replace_live_secret?: boolean;
  replace_testnet_secret?: boolean;
}

export interface FutureTradeConnectionTest {
  connected: boolean;
  mode?: string;
  message: string;
  walletBalance?: number;
  availableBalance?: number;
  marginBalance?: number;
  accountAsset?: string;
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
  meta?: {
    algorithm_mode?: string;
    dynamic?: FutureTradeDynamicDecision;
    signal?: Partial<FutureSignal>;
    [key: string]: unknown;
  } | null;
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
  context?: {
    status?: string | null;
    side?: string | null;
    mode?: string | null;
    entryPrice?: number | string | null;
    exitPrice?: number | string | null;
    quantity?: number | string | null;
    netPnl?: number | string | null;
    algorithmMode?: string | null;
    algorithmFlag?: "NORMAL" | "SEMI" | "AUTO" | string | null;
    effectiveMinConfidence?: number | null;
    activeTakeProfitPercent?: number | null;
    activeStopLossPercent?: number | null;
    activeTrailingTakeProfitPercent?: number | null;
    activeCooldownSeconds?: number | null;
    activeTradeAmountUsdt?: number | null;
    trendStrength?: number | null;
    directionAgreement?: number | null;
    choppy?: boolean | null;
    [key: string]: unknown;
  } | null;
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
  });

  const logs = useQuery({
    queryKey: ["future-trade", workspaceId, "logs"],
    queryFn: async () => (await api.get<FutureTradeLog[]>(`${base}/logs`)).data,
    enabled,
    refetchInterval: 1000,
  });

  const envConfig = useQuery({
    queryKey: ["future-trade", workspaceId, "env-config"],
    queryFn: async () => (await api.get<FutureTradeEnvConfig>(`${base}/env-config`)).data,
    enabled,
  });

  const useAction = (name: string) => useMutation({
    mutationFn: async () => (await api.post(`${base}/${name}`, {})).data,
    onSuccess: invalidate,
  });

  const updateConfig = useMutation({
    mutationFn: async (payload: Partial<FutureTradeConfig>) => (await api.put(`${base}/config`, payload)).data,
    onSuccess: invalidate,
  });

  const updateEnvConfig = useMutation({
    mutationFn: async (payload: FutureTradeEnvConfigPayload) => (await api.put<FutureTradeEnvConfig>(`${base}/env-config`, payload)).data,
    onSuccess: invalidate,
  });

  const testConnection = useMutation({
    mutationFn: async () => (await api.post<FutureTradeConnectionTest>(`${base}/test-connection`, {})).data,
  });

  return {
    dashboard,
    config,
    trades,
    logs,
    envConfig,
    updateConfig,
    updateEnvConfig,
    testConnection,
    start: useAction("start"),
    stop: useAction("stop"),
    emergencyStop: useAction("emergency-stop"),
    resetPaper: useAction("reset-paper"),
    resetDailyLoss: useAction("reset-daily-loss"),
  };
}
