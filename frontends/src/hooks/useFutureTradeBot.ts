import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const FUTURE_TRADE_LIVE_REFRESH_MS = 1000;

export interface FutureTradeSettings {
  signalProfile?: string;
  signalProfileName?: string;
  marketProfile?: string;
  validatedDefaultSymbols?: string[];
  validationSymbols?: string[];
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
  corePassRule?: number;
  classicSimpleMode?: boolean;
  strictEntryGuards?: boolean;
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
  tradingHoursEnabled: boolean;
  tradingHoursStartUtc: string;
  tradingHoursEndUtc: string;
  useLiveDataFeed: boolean;
  indicatorInfluence?: Record<string, number>;
  indicatorControls?: Record<string, FutureTradeIndicatorControl>;
}

export interface FutureTradeComponentBreakdown {
  key: string;
  label: string;
  rawScore: number;
  influenceLevel: number;
  finalContribution: number;
  impact: "positive" | "negative" | string;
  controlKey?: string;
  enabled?: boolean;
  configuredWeight?: number;
  defaultWeight?: number;
  category?: string;
  note?: string;
}

export interface FutureTradeIndicatorControl {
  key: string;
  label: string;
  note: string;
  category: string;
  impact: string;
  weight: number;
  enabled: boolean;
  defaultWeight: number;
  configurable: boolean;
  aliases?: string[];
}

export interface FutureTradeIndicatorPerformance {
  key: string;
  label: string;
  enabled: boolean;
  weight: number;
  impact: string;
  category: string;
  samples: number;
  activeSamples: number;
  wins: number;
  losses: number;
  positiveSamples: number;
  negativeSamples: number;
  positiveWinSamples: number;
  positiveLossSamples: number;
  negativeWinSamples: number;
  negativeLossSamples: number;
  avgContribution: number;
  avgNetPnl: number;
  supportiveWinRate?: number | null;
  blockingAccuracy?: number | null;
  overallAccuracy?: number | null;
  trackerAlignmentRate?: number | null;
  successPoints?: number;
  successRate?: number | null;
  successScore?: number;
  rating?: string;
  sampleState: string;
  lastSeenAt?: string | null;
}

export interface FutureTradeIndicatorSuggestion {
  key: string;
  action: string;
  severity: string;
  title: string;
  reason: string;
}

export interface FutureTradeIndicatorIntelligence {
  profile: string;
  controls: FutureTradeIndicatorControl[];
  hardBlockers: Array<{ key: string; label: string }>;
  currentBreakdown: FutureTradeComponentBreakdown[];
  performance: FutureTradeIndicatorPerformance[];
  validation?: {
    classicSimpleMode: boolean;
    normalGraphModeWorks: boolean;
    liveSignalFlowDetected: boolean;
    blockers: string[];
    trackerAlignedIndicators: number;
    highRatedIndicators: number;
    overallReadinessScore: number;
  };
  suggestions: FutureTradeIndicatorSuggestion[];
  integrationReadiness?: {
    pineScriptImportReady?: boolean;
    note?: string;
  };
}

export interface FutureTradeResearchScript {
  id: string;
  name: string;
  source: string;
  scriptType: string;
  version?: string | null;
  scriptBody: string;
  lineCount: number;
  detectedIndicators: string[];
  signalRules: string[];
  overlayHints: Array<{ label: string; kind: string }>;
  importedAt: string;
}

export interface FutureTradeResearchDataset {
  id: string;
  name: string;
  format: string;
  rowCount: number;
  wins: number;
  losses: number;
  winRate?: number | null;
  importedAt: string;
}

export interface FutureTradeResearchStat {
  key: string;
  samples: number;
  wins: number;
  losses: number;
  avgPnl: number;
  winRate?: number | null;
}

export interface FutureTradeResearchSuggestion {
  key: string;
  title: string;
  reason: string;
  action: string;
}

export interface FutureTradeResearchLab {
  scripts: FutureTradeResearchScript[];
  datasets: FutureTradeResearchDataset[];
  importedIndicatorStats: FutureTradeResearchStat[];
  trainingSuggestions: FutureTradeResearchSuggestion[];
  localTradeSampleCount: number;
  overlayHints: string[];
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
  liveStatus?: {
    mode: string;
    priceUpdateMode: string;
    indicatorMode: string;
    lastUpdateTime?: string | null;
    lastChartPointTime?: string | null;
    lastCandleTime?: string | null;
    higherTimeframeLastCandleTime?: string | null;
    ageSeconds?: number | null;
    scanIntervalSeconds?: number | null;
    isStale?: boolean;
    scannerSnapshotCount?: number;
    dataSource?: string | null;
    daemon?: {
      running: boolean;
      pid?: number | null;
      startedAt?: string | null;
      lastTickAt?: string | null;
      feedAgeSeconds?: number | null;
      restartRecommended?: boolean;
      symbolSetInSync?: boolean;
    };
  };
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
  rsi14?: number | null;
  emaBullish?: boolean | null;
  macdBullish?: boolean | null;
  macdHistGrowing?: boolean | null;
  htfBullish?: boolean | null;
  htf4hBullish?: boolean | null;
  symbolPerfAdj?: number | null;
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

export interface FutureTradeCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFormingCandle?: boolean;
}

export interface FutureTradeMarketChart {
  symbol?: string | null;
  timeframe: string;
  candles: FutureTradeCandle[];
  latestTickPrice?: number | null;
  latestTickAt?: string | null;
  chartUpdatedAt?: string | null;
  chartAgeSeconds?: number;
  tickAgeSeconds?: number;
  lastCandleClose?: number | null;
  isFormingCandle?: boolean;
  dataSource?: string | null;
  debug?: {
    latestTickPrice?: number | null;
    chartUpdatedAt?: string | null;
    lastCandleClose?: number | null;
    isFormingCandle?: boolean;
  };
}

export interface FutureTradeLiveStatusLight {
  workspaceId: string;
  enabled: boolean;
  paperTrading: boolean;
  liveTrading: boolean;
  mode: string;
  strategyMode: string;
  classicSimpleMode: boolean;
  confidenceMode: string;
  minConfidence: number;
  activeMinimum: number;
  strictEntryGuards: boolean;
  corePassRule: number;
  feedMode: string;
  feedFresh: boolean;
  tickAgeSeconds?: number | null;
  lastTickAt?: string | null;
  lastTickPrice?: number | null;
  lastScanAt?: string | null;
  scanAgeSeconds?: number | null;
  chartUpdatedAt?: string | null;
  chartAgeSeconds?: number | null;
  currentSymbol?: string | null;
  currentPrice: number;
  currentSignal: string;
  currentConfidence: number;
  lastSkipReason?: string | null;
  positionSide?: string | null;
  walletBalance?: number | null;
  availableBalance?: number | null;
  accountAsset?: string | null;
  minQuantityPrecheck?: {
    symbol: string;
    price: number;
    stepSize: number;
    minQty: number;
    tradeAmountUsdt: number;
    leverage: number;
    notional: number;
    minimumRequiredTradeAmountUsdt?: number | null;
    recommendedTradeAmountUsdt?: number | null;
    canTrade: boolean;
  } | null;
  updatedAt: string;
}

export interface FutureTradeScannerSnapshot {
  updatedAt?: string | null;
  scanAgeSeconds?: number | null;
  symbols: Array<FutureSignal & {
    activeMinimum?: number;
    coreEntryPassed?: boolean;
    componentScores?: Record<string, number>;
    positiveFactors?: string[];
    negativeFactors?: string[];
    lastSkipReason?: string | null;
  }>;
}

export interface FutureTradeIndicatorValidation {
  key: string;
  label: string;
  passed: boolean;
}

export interface FutureTradeIndicatorSuite {
  preset?: string;
  state: string;
  summary: string;
  signal?: string;
  score?: number;
  executionReady?: boolean;
  trend?: {
    direction: string;
    adx: number;
    vwap: number;
    openingRangeHigh?: number | null;
    openingRangeLow?: number | null;
    bubbleCount?: number;
    zones?: {
      supply?: number | null;
      demand?: number | null;
    };
  };
  validations: FutureTradeIndicatorValidation[];
  backtest: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netPercent: number;
    bestTrade: number;
    worstTrade: number;
  };
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
  signalDebug?: {
    decision: string;
    decisionStatus: string;
    signalSide: string;
    finalConfidence: number;
    positiveFactors: string[];
    negativeFactors: string[];
    componentScores: Record<string, number>;
    voteSummary?: Record<string, number | string>;
    checks?: {
      vwapAligned?: boolean;
      emaAligned?: boolean;
      adxValue?: number;
      macdDirection?: boolean;
      rsiValue?: number;
      volumeAligned?: boolean;
      volumeRatio?: number;
      htfAligned?: boolean;
      corePassRule?: number;
      buyCoreChecks?: Record<string, boolean>;
      sellCoreChecks?: Record<string, boolean>;
      classicSimpleMode?: boolean;
    };
    componentBreakdown?: Record<string, FutureTradeComponentBreakdown>;
    timing?: {
      sequenceLastCandleTime?: string | null;
      higherTimeframeLastCandleTime?: string | null;
    };
  } | null;
  indicatorIntelligence?: FutureTradeIndicatorIntelligence | null;
  researchLab?: FutureTradeResearchLab | null;
  missedTradeAudit?: {
    reviewWindows: number[];
    defaultWindowMinutes: number;
    totalSkippedSignals: number;
    pendingReview: number;
    reviewedSignals: number;
    missedWins: number;
    correctSkips: number;
    avoidedLosses: number;
    neutral: number;
    badSignals: number;
    missedWinRate?: number | null;
    modeComparison: Array<{
      mode: string;
      wouldTrade: number;
      capturedMissedWins: number;
      allowedBadSignals: number;
      correctSkips: number;
      netWouldHavePnlPercent: number;
      samples: number;
      recommendation: string;
    }>;
    topBlockers: Array<{
      key: string;
      label: string;
      factor: string;
      currentWeight: number;
      totalSkips: number;
      missedWins: number;
      correctSkips: number;
      avoidedLosses: number;
      neutral: number;
      accuracy: number;
      missedWinRate: number;
      correctSkipRate: number;
      avoidedLossRate: number;
      sampleSizeQuality: string;
      recommendation: string;
      recommendedWeight: number;
      reason: string;
    }>;
    recent: Array<{
      id: string;
      symbol: string;
      side: string;
      signalTime?: string | null;
      finalConfidence: number;
      activeMinimum: number;
      confidenceGap: number;
      topSkipReason?: string | null;
      topBlockers: string[];
      status: string;
      reviewWindowMinutes: number;
      firstHit?: string | null;
      wouldHaveResult?: string | null;
      grossWouldHavePnlPercent?: number | null;
      netWouldHavePnlPercent?: number | null;
      wouldHavePnlPercent?: number | null;
      modeComparison?: Record<string, {
        confidence: number;
        activeMinimum: number;
        decision: string;
        topSkipReason?: string | null;
        wouldCaptureMissedWin: boolean;
        wouldAllowBadSignal: boolean;
        wouldAllowAvoidedLoss: boolean;
        wouldAllowCorrectSkip: boolean;
        netWouldHavePnlPercent: number;
      }>;
    }>;
  } | null;
  chart: FutureTradeDynamicPoint[];
  marketChart?: FutureTradeMarketChart;
  indicatorSuite?: FutureTradeIndicatorSuite;
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
  config_versions?: Array<{
    id: string;
    versionNumber: number;
    label?: string | null;
    source: string;
    summary?: Record<string, unknown> | null;
    createdBy?: number | null;
    createdAt?: string | null;
  }>;
}

export interface FutureTradeTuningPlanPreview {
  analysisOnly: boolean;
  autoApply: boolean;
  generatedAt: string;
  current: {
    mode: string;
    minConfidence: number;
    confidenceMode: string;
    strictEntryGuards: boolean;
  };
  recommended: {
    mode: string;
    minConfidence: number;
    confidenceMode: string;
    strictEntryGuards: boolean;
    weightChanges: Array<{
      factor: string;
      currentWeight: number;
      recommendedWeight: number;
      reason: string;
    }>;
  };
  previewImpact: {
    currentWouldTrade: number;
    recommendedWouldTrade: number;
    capturedMissedWinsDelta: number;
    allowedBadSignalsDelta: number;
    netWouldHavePnlDelta: number;
  };
  forwardValidation: {
    reviewedSamples: number;
    currentModeSummary?: Record<string, unknown>;
    recommendedModeSummary?: Record<string, unknown>;
    recommendation: string;
  };
  notes: string[];
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

export interface FutureTradeScriptImportPayload {
  name?: string;
  source?: string;
  script: string;
}

export interface FutureTradeTradeImportPayload {
  name?: string;
  format: "csv" | "json";
  payload: string;
}

export interface FutureTradeLiveFeedStatus {
  running: boolean;
  pid?: number | null;
  mode: string;
  dataSource: string;
  startedAt?: string | null;
  command?: string | null;
  logPath?: string | null;
  errorLogPath?: string | null;
  workspaceScope?: string | null;
  lastTickAt?: string | null;
  ageSeconds?: number | null;
  isFresh?: boolean;
  desiredSymbols: string[];
  runningSymbols: string[];
  symbolSetInSync: boolean;
  restartRecommended: boolean;
  message?: string | null;
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

export interface FutureTradeRecoveryResult {
  action: "auto" | "sync_state" | "cancel_reduce_only" | string;
  resolved: boolean;
  message: string;
  exchange_quantity?: number;
  exchange_side?: string | null;
  cancelled_reduce_only_orders?: number;
  local_state_cleared?: boolean;
  position_still_open?: boolean;
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
    activeConfidenceMin?: number | null;
    vwapAligned?: boolean | null;
    emaAligned?: boolean | null;
    adxValue?: number | null;
    macdDirection?: boolean | null;
    rsiValue?: number | null;
    volumeAligned?: boolean | null;
    volumeRatio?: number | null;
    htfAligned?: boolean | null;
    softPenaltyCount?: number | null;
    softPenalties?: string[] | null;
    hardBlocker?: string | null;
    hardBlockers?: string[] | null;
    positiveFactors?: string[] | null;
    negativeFactors?: string[] | null;
    componentScores?: Record<string, number> | null;
    componentBreakdown?: Record<string, FutureTradeComponentBreakdown> | null;
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
    refetchInterval: FUTURE_TRADE_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const liveStatus = useQuery({
    queryKey: ["future-trade", workspaceId, "live-status"],
    queryFn: async () => (await api.get<FutureTradeLiveStatusLight>(`${base}/live-status`)).data,
    enabled,
    refetchInterval: FUTURE_TRADE_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const scannerSnapshot = useQuery({
    queryKey: ["future-trade", workspaceId, "scanner-snapshot"],
    queryFn: async () => (await api.get<FutureTradeScannerSnapshot>(`${base}/scanner-snapshot`)).data,
    enabled,
    refetchInterval: FUTURE_TRADE_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const liveChart = useQuery({
    queryKey: ["future-trade", workspaceId, "chart", dashboard.data?.marketChart?.symbol, dashboard.data?.marketChart?.timeframe],
    queryFn: async () => (await api.get<FutureTradeMarketChart>(`${base}/chart`, {
      params: {
        symbol: dashboard.data?.marketChart?.symbol,
        timeframe: dashboard.data?.marketChart?.timeframe,
      },
    })).data,
    enabled,
    refetchInterval: FUTURE_TRADE_LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const config = useQuery({
    queryKey: ["future-trade", workspaceId, "config"],
    queryFn: async () => (await api.get<FutureTradeConfig>(`${base}/config`)).data,
    enabled,
  });

  const trades = useQuery({
    queryKey: ["future-trade", workspaceId, "trades"],
    queryFn: async () => (await api.get<FutureTradeRecord[]>(`${base}/trades?all=1`)).data,
    enabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const logs = useQuery({
    queryKey: ["future-trade", workspaceId, "logs"],
    queryFn: async () => (await api.get<FutureTradeLog[]>(`${base}/logs?all=1`)).data,
    enabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const envConfig = useQuery({
    queryKey: ["future-trade", workspaceId, "env-config"],
    queryFn: async () => (await api.get<FutureTradeEnvConfig>(`${base}/env-config`)).data,
    enabled,
  });

  const liveFeed = useQuery({
    queryKey: ["future-trade", workspaceId, "live-feed"],
    queryFn: async () => (await api.get<FutureTradeLiveFeedStatus>(`${base}/live-feed`)).data,
    enabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
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

  const generateTuningPlan = useMutation({
    mutationFn: async () => (await api.post<FutureTradeTuningPlanPreview>(`${base}/generate-tuning-plan`, {})).data,
  });

  const testConnection = useMutation({
    mutationFn: async () => (await api.post<FutureTradeConnectionTest>(`${base}/test-connection`, {})).data,
  });

  const recover = useMutation({
    mutationFn: async (action: "auto" | "sync_state" | "cancel_reduce_only") => (await api.post<FutureTradeRecoveryResult>(`${base}/recover`, { action })).data,
    onSuccess: invalidate,
  });

  const liveFeedAction = (name: "start" | "stop" | "restart") => useMutation({
    mutationFn: async () => (await api.post<FutureTradeLiveFeedStatus>(`${base}/live-feed/${name}`, {})).data,
    onSuccess: invalidate,
  });

  const importScript = useMutation({
    mutationFn: async (payload: FutureTradeScriptImportPayload) => (await api.post<FutureTradeResearchLab>(`${base}/import-script`, payload)).data,
    onSuccess: invalidate,
  });

  const importTrades = useMutation({
    mutationFn: async (payload: FutureTradeTradeImportPayload) => (await api.post<FutureTradeResearchLab>(`${base}/import-trades`, payload)).data,
    onSuccess: invalidate,
  });

  return {
    dashboard,
    liveStatus,
    scannerSnapshot,
    liveChart,
    config,
    trades,
    logs,
    envConfig,
    liveFeed,
    updateConfig,
    updateEnvConfig,
    generateTuningPlan,
    testConnection,
    recover,
    importScript,
    importTrades,
    startLiveFeed: liveFeedAction("start"),
    stopLiveFeed: liveFeedAction("stop"),
    restartLiveFeed: liveFeedAction("restart"),
    start: useAction("start"),
    stop: useAction("stop"),
    emergencyStop: useAction("emergency-stop"),
    resetPaper: useAction("reset-paper"),
    resetDailyLoss: useAction("reset-daily-loss"),
    clearHistory: useAction("clear-history"),
  };
}
