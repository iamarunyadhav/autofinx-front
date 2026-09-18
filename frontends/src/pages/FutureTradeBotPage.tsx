import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Bot, Brain, Download, FileSpreadsheet, Lightbulb, Power, RefreshCw, Save, ShieldAlert, Square, Trash2, Upload, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout";
import { ExecutionSafetyControls, type ExecutionSafetyValues } from "@/components/trading/ExecutionSafetyControls";
import { FutureTradeAiGatePanel } from "@/components/future-trade/FutureTradeAiGatePanel";
import { FutureTradeProChart } from "@/components/future-trade/FutureTradeProChart";
import { RobotLiveChart, type ChartMarker } from "@/components/trading/RobotLiveChart";
import { AssetClassToggle } from "@/components/trading/AssetClassToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePruneStalePendingJobs, useRestartWorkers } from "@/hooks/useJobs";
import { useFutureTradeBot, type FutureTradeBinanceHealth, type FutureTradeConfig, type FutureTradeDashboard, type FutureTradeDiagnostics, type FutureTradeDynamicDecision, type FutureTradeDynamicPoint, type FutureTradeEnvConfig, type FutureTradeEnvConfigPayload, type FutureTradeIndicatorSuite, type FutureTradeLastWebhook, type FutureTradeLiveFeedStatus, type FutureTradeLog, type FutureTradeRecord, type FutureTradeRecoveryResult, type FutureTradeResearchLab, type FutureTradeRuntimeHealth, type FutureTradeSettings, type FutureTradeTuningPlanPreview } from "@/hooks/useFutureTradeBot";
import type { CandleData } from "@/hooks/useRobotCandleFeed";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { ForecastComparisonCard } from "@/components/trading/ForecastComparisonCard";
import { useForecastComparison } from "@/hooks/useQuickTrade";

const FUTURE_TRADE_ALL_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT",
  "DOGEUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT",
  "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "SEIUSDT",
];

const BALANCED_INFLUENCE_DEFAULTS: Record<string, number> = {
  vwapPositive: 7,
  emaPositive: 7,
  adxPositive: 6,
  macdPositive: 7,
  rsiPositive: 2,
  volumePositive: 2,
  htfPositive: 2,
  macroPositive: 2,
  structurePositive: 2,
  sequencePositive: 4,
  extensionPositive: 2,
  symbolPerfPositive: 1,
  symbolPerfPenalty: 1,
  macdHistogramBonus: 4,
  directionalSignalBonus: 5,
  trendContinuationBonus: 5,
  volumePenalty: 2,
  macdPenalty: 2,
  htfPenalty: 2,
  structurePenalty: 2,
  extensionPenalty: 2,
  rsiPenalty: 2,
  choppyPenalty: 2,
  weakSetupPenalty: 1,
  recentAccuracyWeight: 3,
  lossStreakWeight: 3,
  atrWeight: 3,
  volatilityWeight: 3,
};

const CORE_ONLY_INFLUENCE_DEFAULTS: Record<string, number> = {
  ...BALANCED_INFLUENCE_DEFAULTS,
  rsiPositive: 0,
  volumePositive: 0,
  htfPositive: 0,
  macroPositive: 0,
  structurePositive: 0,
  sequencePositive: 0,
  extensionPositive: 0,
  symbolPerfPositive: 0,
  symbolPerfPenalty: 0,
  volumePenalty: 0,
  htfPenalty: 0,
  structurePenalty: 0,
  extensionPenalty: 0,
  rsiPenalty: 0,
  choppyPenalty: 0,
  weakSetupPenalty: 0,
};

const AGGRESSIVE_INFLUENCE_DEFAULTS: Record<string, number> = {
  ...BALANCED_INFLUENCE_DEFAULTS,
  vwapPositive: 8,
  emaPositive: 8,
  adxPositive: 7,
  macdPositive: 8,
  directionalSignalBonus: 6,
  volumePenalty: 1,
  macdPenalty: 1,
  htfPenalty: 1,
  structurePenalty: 1,
  extensionPenalty: 1,
  choppyPenalty: 1,
  weakSetupPenalty: 1,
};

const CONSERVATIVE_INFLUENCE_DEFAULTS: Record<string, number> = {
  ...BALANCED_INFLUENCE_DEFAULTS,
  vwapPositive: 6,
  emaPositive: 6,
  adxPositive: 6,
  macdPositive: 6,
  htfPositive: 4,
  structurePositive: 4,
  volumePenalty: 4,
  macdPenalty: 4,
  htfPenalty: 4,
  structurePenalty: 4,
  extensionPenalty: 4,
  choppyPenalty: 4,
  weakSetupPenalty: 3,
  recentAccuracyWeight: 4,
  lossStreakWeight: 4,
  atrWeight: 4,
  volatilityWeight: 4,
};

const INDICATOR_PRESETS = [
  { key: "balanced", label: "Balanced", corePassRule: 3, indicatorInfluence: BALANCED_INFLUENCE_DEFAULTS },
  { key: "core_only", label: "Core Only", corePassRule: 2, indicatorInfluence: CORE_ONLY_INFLUENCE_DEFAULTS },
  { key: "aggressive", label: "Aggressive Live Test", corePassRule: 2, indicatorInfluence: AGGRESSIVE_INFLUENCE_DEFAULTS },
  { key: "conservative", label: "Conservative", corePassRule: 4, indicatorInfluence: CONSERVATIVE_INFLUENCE_DEFAULTS },
] as const;

const DEFAULT_SETTINGS: FutureTradeSettings = {
  signalProfile: "autofinx_prime_v6_1_7_crypto",
  signalProfileName: "AutoFinX Prime v6.1.7 Crypto Stable Default",
  marketProfile: "Crypto",
  mode: "pine_mirror_or_webhook_executor",
  secondaryAiWeighting: false,
  legacyWeightedScoring: false,
  primeMirrorLiveEnabled: false,
  primeMirrorExecutionEnabled: false,
  validatedDefaultSymbols: ["ETHUSDT"],
  validationSymbols: ["ETHUSDT"],
  symbols: ["ETHUSDT"],
  timeframe: "15m",
  paperTrading: true,
  liveTrading: false,
  forceTestnet: true,
  leverage: 2,
  marginMode: "isolated",
  tradeAmountUsdt: 25,
  minConfidence: 0.72,
  confidenceMode: "fixed",
  dynamicLookbackMinutes: 10,
  dynamicMinConfidenceFloor: 0.5,
  dynamicMinConfidenceCeiling: 0.62,
  dynamicReentryBuffer: 0.005,
  dynamicSuggestionEnabled: false,
  tradeScoreThreshold: 72,
  watchScoreThreshold: 58,
  tradeDirection: "Both",
  htf1: "60",
  htf2: "240",
  emaFast: 9,
  emaSlow: 21,
  emaTrend: 50,
  emaMajor: 200,
  donchianLength: 20,
  useVWAP: true,
  useDonchianScore: true,
  useVolume: true,
  useVolatilityFilter: true,
  useChopFilter: true,
  chopLength: 14,
  cryptoChopMax: 61.8,
  useMomentumBreakoutFilter: false,
  minBodyRatio: 0.55,
  rsiLength: 14,
  longRsiMin: 48,
  longRsiMax: 72,
  shortRsiMin: 28,
  shortRsiMax: 52,
  adxLength: 14,
  adxSmoothing: 14,
  adxMin: 20,
  volumeLength: 20,
  cryptoRelVolMin: 1.0,
  atrLength: 14,
  atrRegimeLength: 50,
  cryptoMinAtrPct: 0.06,
  cryptoMaxAtrPct: 3.0,
  slAtrMultiplier: 1.4,
  tp1RR: 2.0,
  tp2RR: 2.0,
  useAtrTrailingSecondHalf: true,
  trailAtrMultiplier: 0.8,
  useAtrRiskTargets: false,
  useWebhookRiskOverrides: false,
  cooldownBars: 3,
  exitOnStrongOppositeScore: true,
  oppositeExitScore: 78,
  corePassRule: 3,
  classicSimpleMode: false,
  strictEntryGuards: true,
  takeProfitPercent: 1.5,
  stopLossPercent: 0.75,
  trailingTakeProfitPercent: 0.45,
  rollbackLossPercent: 0.6,
  maxDailyLossPercent: 2.0,
  maxOpenPositions: 1,
  maxTradesPerDay: 50,
  maxLeverage: 2,
  maxSpreadPercent: 0.12,
  cooldownSeconds: 180,
  scanIntervalSeconds: 3,
  autoExecutePaperSignals: true,
  signalSource: "webhook" as "mirror" | "webhook" | "webhook_fallback" | "binance",
  pineWebhookFallbackTimeoutSeconds: 1200,
  liveFeedMaxAgeSeconds: 3,
  webhookMaxSignalLatencyMs: 4000,
  avoidChoppyMarket: true,
  emergencyStop: false,
  tradingHoursEnabled: false,
  tradingHoursStartUtc: "00:00",
  tradingHoursEndUtc: "23:59",
  useLiveDataFeed: true,
  indicatorInfluence: { ...BALANCED_INFLUENCE_DEFAULTS },
};

type IndicatorInfluenceControlTemplate = {
  key: string;
  label: string;
  note: string;
  impact?: string;
};

const INDICATOR_INFLUENCE_CONTROLS = [
  { key: "vwapPositive", label: "VWAP positive", note: "Direction alignment contribution", impact: "positive" },
  { key: "emaPositive", label: "EMA positive", note: "5m EMA trend alignment contribution", impact: "positive" },
  { key: "adxPositive", label: "ADX positive", note: "Trend strength contribution", impact: "positive" },
  { key: "macdPositive", label: "MACD positive", note: "Directional momentum contribution", impact: "positive" },
  { key: "rsiPositive", label: "RSI positive", note: "Momentum window contribution", impact: "positive" },
  { key: "volumePositive", label: "Volume positive", note: "Participation confirmation contribution", impact: "positive" },
  { key: "htfPositive", label: "HTF positive", note: "1h higher timeframe alignment", impact: "positive" },
  { key: "macroPositive", label: "4h HTF positive", note: "Macro filter contribution", impact: "positive" },
  { key: "structurePositive", label: "Structure positive", note: "15m structure/order block/MSB", impact: "positive" },
  { key: "sequencePositive", label: "Sequence positive", note: "Recent candle direction strength", impact: "positive" },
  { key: "extensionPositive", label: "Entry extension positive", note: "Reward when entry is not overextended", impact: "positive" },
  { key: "symbolPerfPositive", label: "Symbol performance positive", note: "Positive recent symbol performance", impact: "positive" },
  { key: "symbolPerfPenalty", label: "Symbol performance penalty", note: "Negative recent symbol performance", impact: "negative" },
  { key: "macdHistogramBonus", label: "MACD histogram bonus", note: "Extra momentum bonus" },
  { key: "directionalSignalBonus", label: "Directional bonus", note: "Non-WAIT directional bonus" },
  { key: "trendContinuationBonus", label: "Trend continuation", note: "Core trend continuation bonus" },
  { key: "volumePenalty", label: "Volume penalty", note: "Penalty when volume confirmation fails" },
  { key: "macdPenalty", label: "MACD penalty", note: "Penalty when MACD direction fails" },
  { key: "htfPenalty", label: "HTF penalty", note: "Penalty when HTF disagrees" },
  { key: "structurePenalty", label: "Structure penalty", note: "Penalty when structure is missing" },
  { key: "extensionPenalty", label: "Extension penalty", note: "Penalty when entry is stretched" },
  { key: "rsiPenalty", label: "RSI penalty", note: "Penalty when RSI window fails" },
  { key: "choppyPenalty", label: "Choppy market", note: "Penalty when choppy regime detected" },
  { key: "weakSetupPenalty", label: "Weak setup", note: "Penalty when weak setup is detected" },
  { key: "recentAccuracyWeight", label: "Recent accuracy", note: "Semi/fully dynamic recent accuracy influence", impact: "dynamic" },
  { key: "lossStreakWeight", label: "Loss streak", note: "Recent loss cooldown/threshold influence", impact: "dynamic" },
  { key: "atrWeight", label: "ATR", note: "ATR-driven TP/SL influence", impact: "dynamic" },
  { key: "volatilityWeight", label: "Volatility", note: "Volatility cooldown/size influence", impact: "dynamic" },
] satisfies IndicatorInfluenceControlTemplate[];

const DEFAULT_ENV_CONFIG: FutureTradeEnvConfig = {
  mode: "paper",
  testnet_enabled: false,
  live_enabled: false,
  force_testnet: true,
  live_api_url: "https://fapi.binance.com",
  testnet_api_url: "https://testnet.binancefuture.com",
  live_api_key: "",
  live_api_secret_masked: "",
  testnet_api_key: "",
  testnet_api_secret_masked: "",
  live_configured: false,
  testnet_configured: false,
};

const LOSS_LOCK_RECOVERY_PRESET = {
  leverage: 2,
  tradeAmountUsdt: 25,
  minConfidence: 0.78,
  dynamicMinConfidenceFloor: 0.72,
  dynamicReentryBuffer: 0.02,
  takeProfitPercent: 0.9,
  stopLossPercent: 0.3,
  trailingTakeProfitPercent: 0.2,
  rollbackLossPercent: 0.18,
  maxDailyLossPercent: 1,
  maxTradesPerDay: 6,
  cooldownSeconds: 90,
} satisfies Partial<FutureTradeSettings>;

const LOSS_LOCK_RECOVERY_KEYS = [
  "leverage",
  "tradeAmountUsdt",
  "minConfidence",
  "dynamicMinConfidenceFloor",
  "dynamicReentryBuffer",
  "takeProfitPercent",
  "stopLossPercent",
  "trailingTakeProfitPercent",
  "rollbackLossPercent",
  "maxDailyLossPercent",
  "maxTradesPerDay",
  "cooldownSeconds",
] as const satisfies ReadonlyArray<keyof FutureTradeSettings>;

const STRICT_BTC_ETH_FULLY_DYNAMIC_PRESET: Partial<FutureTradeSettings> = {
  symbols: ["BTCUSDT", "ETHUSDT"],
  confidenceMode: "fully_dynamic",
  leverage: 2,
  tradeAmountUsdt: 25,
  minConfidence: 0.8,
  dynamicLookbackMinutes: 10,
  dynamicMinConfidenceFloor: 0.75,
  dynamicMinConfidenceCeiling: 0.88,
  dynamicReentryBuffer: 0.025,
  takeProfitPercent: 0.8,
  stopLossPercent: 0.28,
  trailingTakeProfitPercent: 0.18,
  rollbackLossPercent: 0.16,
  maxDailyLossPercent: 0.8,
  maxOpenPositions: 1,
  maxTradesPerDay: 4,
  maxLeverage: 3,
  maxSpreadPercent: 0.08,
  cooldownSeconds: 120,
  scanIntervalSeconds: 3,
  autoExecutePaperSignals: true,
  avoidChoppyMarket: true,
  emergencyStop: false,
};

function n(value: unknown, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function balanceValue(value: unknown, digits = 4) {
  if (value == null || value === "") return "Unavailable";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Unavailable";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function candleTime(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : value;
  }
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function toNumberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function statusVariant(value?: string) {
  const normalized = (value || "").toLowerCase();
  if (["running", "connected", "buy", "sell", "long", "short", "in_position", "buy_executed", "sell_executed"].includes(normalized)) return "default";
  if (["scanning", "cooldown", "waiting_for_signal", "wait"].includes(normalized)) return "secondary";
  if (["stopped", "emergency_stop", "stop_loss_hit", "loss_rollback_triggered"].includes(normalized)) return "destructive";
  return "outline";
}

function resolveMasterSignal(
  status?: FutureTradeDashboard["status"] | null,
  debug?: FutureTradeDashboard["signalDebug"] | null,
  bestSignal?: FutureTradeDashboard["bestSignal"] | null,
) {
  const candidate = String(debug?.decision ?? status?.currentSignal ?? bestSignal?.signal ?? "WAIT").toUpperCase();
  if (["BUY", "SELL", "WAIT"].includes(candidate)) {
    return candidate;
  }
  return "WAIT";
}

function normalizeInfluenceMultiplier(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const normalized = parsed > 2 ? parsed / 5 : parsed;
  return Math.min(2, Math.max(0, normalized));
}

function displayInfluenceWeight(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return parsed > 2 ? parsed : parsed * 5;
}

function mergeInfluenceWeights(weights?: Record<string, number> | null) {
  return {
    ...BALANCED_INFLUENCE_DEFAULTS,
    ...(weights ?? {}),
  };
}

function resolveStrategyMode(settings: Pick<FutureTradeSettings, "classicSimpleMode" | "corePassRule" | "indicatorInfluence">) {
  if (settings.classicSimpleMode) {
    return "Classic Simple Live Signal";
  }

  const merged = mergeInfluenceWeights(settings.indicatorInfluence);
  const coreOnlyKeys = Object.keys(CORE_ONLY_INFLUENCE_DEFAULTS) as Array<keyof typeof CORE_ONLY_INFLUENCE_DEFAULTS>;
  const coreOnlyMatch = coreOnlyKeys.every((key) => Number(merged[key] ?? 0) === Number(CORE_ONLY_INFLUENCE_DEFAULTS[key] ?? 0));

  if ((settings.corePassRule ?? 3) <= 2 && coreOnlyMatch) {
    return "Core Only";
  }

  return "Full Indicator Intelligence";
}

function liveFeedWarning(mode?: string | null) {
  if (String(mode ?? "").toUpperCase() === "REST_FALLBACK") {
    return "Live data may be delayed because websocket cache is not active.";
  }

  return null;
}

function controlEnabled(
  settings: Pick<FutureTradeSettings, "indicatorControls">,
  key: string,
  fallbackWeight?: number,
) {
  const control = settings.indicatorControls?.[key];
  if (!control) return (fallbackWeight ?? 0) > 0;
  return Boolean(control.enabled);
}

function simulateSignalConfidence(
  debug: FutureTradeDashboard["signalDebug"] | null | undefined,
  settings: Pick<FutureTradeSettings, "indicatorInfluence" | "indicatorControls" | "corePassRule" | "classicSimpleMode">,
) {
  if (settings.classicSimpleMode || debug?.checks?.classicSimpleMode) {
    return {
      finalConfidence: Math.min(0.99, Math.max(0.01, Number((debug?.finalConfidence ?? 0.5).toFixed(4)))),
      corePassCount: 0,
      corePassRule: 0,
      corePassed: true,
    };
  }
  const breakdown = debug?.componentBreakdown ?? {};
  const mergedWeights = mergeInfluenceWeights(settings.indicatorInfluence);
  const finalConfidence = Object.values(breakdown).reduce((total, item) => {
    const enabled = controlEnabled(settings, item.key, mergedWeights[item.key]);
    const multiplier = enabled ? normalizeInfluenceMultiplier(mergedWeights[item.key]) : 0;
    return total + (Number(item.rawScore ?? 0) * multiplier);
  }, 0);
  const coreChecks = debug?.checks?.[debug?.signalSide === "SELL" ? "sellCoreChecks" : "buyCoreChecks"] ?? {};
  const corePassCount = Object.values(coreChecks).filter(Boolean).length;
  const required = Math.min(4, Math.max(2, Number(settings.corePassRule ?? debug?.checks?.corePassRule ?? 3)));

  return {
    finalConfidence: Math.min(0.99, Math.max(0.01, Number(finalConfidence.toFixed(4)))),
    corePassCount,
    corePassRule: required,
    corePassed: corePassCount >= required,
  };
}

export default function FutureTradeBotPage() {
  const { currentWorkspace, loading } = useWorkspace();
  const bot = useFutureTradeBot(currentWorkspace?.id);
  const { toast } = useToast();
  const [settings, setSettings] = useState<FutureTradeSettings>(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState("");
  const [envSettings, setEnvSettings] = useState<FutureTradeEnvConfig>(DEFAULT_ENV_CONFIG);
  const [liveSecret, setLiveSecret] = useState("");
  const [testnetSecret, setTestnetSecret] = useState("");
  const [importScriptOpen, setImportScriptOpen] = useState(false);
  const [importTradesOpen, setImportTradesOpen] = useState(false);
  const [scriptName, setScriptName] = useState("");
  const [scriptSource, setScriptSource] = useState("pine");
  const [scriptBody, setScriptBody] = useState("");
  const [tradeDatasetName, setTradeDatasetName] = useState("");
  const [tradeDatasetFormat, setTradeDatasetFormat] = useState<"csv" | "json">("csv");
  const [tradeDatasetBody, setTradeDatasetBody] = useState("");
  const [tuningPlan, setTuningPlan] = useState<FutureTradeTuningPlanPreview | null>(null);

  useEffect(() => {
    if (bot.config.data?.settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...bot.config.data.settings });
      setNotes(bot.config.data.algorithm_notes || "");
    }
  }, [bot.config.data]);

  useEffect(() => {
    if (bot.envConfig.data) {
      setEnvSettings({ ...DEFAULT_ENV_CONFIG, ...bot.envConfig.data });
      setLiveSecret("");
      setTestnetSecret("");
    }
  }, [bot.envConfig.data]);

  const dashboard = bot.dashboard.data;
  const fastStatus = bot.liveStatus.data;
  const fastScanner = bot.scannerSnapshot.data?.symbols ?? dashboard?.scanner ?? [];
  const fastChart = bot.liveChart.data ?? dashboard?.marketChart;
  const fastChartDebug = {
    latestTickPrice: fastChart?.latestTickPrice ?? fastChart?.debug?.latestTickPrice ?? null,
    chartUpdatedAt: fastChart?.chartUpdatedAt ?? fastChart?.debug?.chartUpdatedAt ?? null,
    lastCandleClose: fastChart?.lastCandleClose ?? fastChart?.debug?.lastCandleClose ?? null,
    isFormingCandle: fastChart?.isFormingCandle ?? fastChart?.debug?.isFormingCandle ?? false,
  };
  const liveCandles = useMemo(
    () => (fastChart?.candles ?? []).map((candle, index, rows) => (
      index === rows.length - 1
        ? { ...candle, close: Number(fastChart?.lastCandleClose ?? candle.close), isFormingCandle: Boolean(fastChart?.isFormingCandle ?? candle.isFormingCandle) }
        : candle
    )),
    [fastChart?.candles, fastChart?.chartUpdatedAt, fastChart?.latestTickPrice, fastChart?.lastCandleClose, fastChart?.isFormingCandle],
  );
  const fastBestSignal = fastScanner[0] ?? dashboard?.bestSignal;
  const status = dashboard?.status
    ? {
        ...dashboard.status,
        currentSymbol: fastStatus?.currentSymbol ?? dashboard.status.currentSymbol,
        currentSignal: fastStatus?.currentSignal ?? dashboard.status.currentSignal,
        currentPrice: fastStatus?.currentPrice ?? dashboard.status.currentPrice,
        confidence: fastStatus?.currentConfidence ?? dashboard.status.confidence,
        activeMinConfidence: fastStatus?.activeMinimum ?? dashboard.status.activeMinConfidence,
        positionSide: fastStatus?.positionSide ?? dashboard.status.positionSide,
        walletBalance: fastStatus?.walletBalance ?? dashboard.status.walletBalance,
        availableBalance: fastStatus?.availableBalance ?? dashboard.status.availableBalance,
        accountAsset: fastStatus?.accountAsset ?? dashboard.status.accountAsset,
        lastScanAt: fastStatus?.lastScanAt ?? dashboard.status.lastScanAt,
        liveStatus: {
          ...dashboard.status.liveStatus,
          mode: fastStatus?.feedMode ?? dashboard.status.liveStatus?.mode ?? "",
          ageSeconds: fastStatus?.tickAgeSeconds ?? dashboard.status.liveStatus?.ageSeconds,
          isStale: fastStatus?.tickAgeSeconds != null ? fastStatus.tickAgeSeconds > 10 : dashboard.status.liveStatus?.isStale,
          lastUpdateTime: fastStatus?.updatedAt ?? dashboard.status.liveStatus?.lastUpdateTime,
          dataSource: fastStatus?.feedMode ?? dashboard.status.liveStatus?.dataSource,
        },
      }
    : undefined;
  const diagnostics = dashboard?.diagnostics;
  const savedSettings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(bot.config.data?.settings ?? {}) }), [bot.config.data?.settings]);
  const busy = bot.start.isPending || bot.stop.isPending || bot.emergencyStop.isPending || bot.resetPaper.isPending || bot.resetDailyLoss.isPending || bot.updateConfig.isPending || bot.recover.isPending || bot.clearHistory.isPending;
  const liveFeedBusy = bot.startLiveFeed.isPending || bot.stopLiveFeed.isPending || bot.restartLiveFeed.isPending || bot.recoverRuntime.isPending;
  const researchBusy = bot.importScript.isPending || bot.importTrades.isPending;
  const envBusy = bot.updateEnvConfig.isPending || bot.envConfig.isFetching;
  const runtimeChart = useMemo(() => dashboard?.chart ?? [], [dashboard?.chart]);
  const trackerRows = useMemo(() => (bot.logs.data ?? []).filter((log) => TRACKER_EVENTS.has(log.event)), [bot.logs.data]);
  const liveModeBlocked = Boolean(settings.liveTrading && !status?.liveTradingEnvEnabled);
  const latestRuntimeAlert = diagnostics?.latestAlert;
  const tuningBusy = bot.generateTuningPlan.isPending;
  const webhookAuthority = Boolean(diagnostics?.tradeEligibility?.webhookAuthority);
  const latestWebhookSignal = diagnostics?.tradeEligibility?.latestWebhookSignal;
  const executableWebhookSignal = latestWebhookSignal && ["BUY", "SELL"].includes(latestWebhookSignal)
    ? latestWebhookSignal
    : null;
  const displaySignal = webhookAuthority
    ? (executableWebhookSignal ?? status?.currentSignal ?? "WAIT")
    : (fastBestSignal?.signal && fastBestSignal.signal !== "WAIT" ? fastBestSignal.signal : (status?.currentSignal || "WAIT"));
  const displaySignalSymbol = webhookAuthority
    ? (diagnostics?.webhook?.symbol ?? status?.currentSymbol ?? fastBestSignal?.symbol ?? null)
    : (fastBestSignal?.symbol ?? status?.currentSymbol ?? null);
  const displaySignalConfidence = webhookAuthority
    ? (diagnostics?.tradeEligibility?.bestConfidence ?? fastBestSignal?.confidence ?? status?.confidence ?? 0)
    : (fastBestSignal?.confidence ?? status?.confidence ?? 0);
  const displaySignalMinimum = webhookAuthority
    ? (diagnostics?.tradeEligibility?.activeMinimum ?? fastBestSignal?.effectiveMinConfidence ?? status?.activeMinConfidence ?? settings.minConfidence)
    : (fastBestSignal?.effectiveMinConfidence ?? status?.activeMinConfidence ?? settings.minConfidence);
  const candleChartCandles = useMemo<CandleData[]>(() => {
    return liveCandles
      .map((candle) => {
        const time = candleTime(candle.time);
        const open = Number(candle.open);
        const high = Number(candle.high);
        const low = Number(candle.low);
        const close = Number(candle.close);
        const volume = Number(candle.volume ?? 0);

        if (!time || ![open, high, low, close].every(Number.isFinite)) return null;

        return {
          time,
          open,
          high,
          low,
          close,
          volume: Number.isFinite(volume) ? volume : 0,
        };
      })
      .filter((candle): candle is CandleData => Boolean(candle));
  }, [liveCandles]);
  const candleChartMarkers = useMemo<ChartMarker[]>(() => {
    const lastCandle = candleChartCandles[candleChartCandles.length - 1];
    const signal = String(displaySignal || "").toUpperCase();
    if (!lastCandle || !["BUY", "SELL"].includes(signal)) return [];

    return [{
      time: lastCandle.time,
      side: signal as "BUY" | "SELL",
      text: `${signal} ${n(displaySignalConfidence * 100, 0)}%`,
    }];
  }, [candleChartCandles, displaySignal, displaySignalConfidence]);
  const [predictionSource, setPredictionSource] = useState<"current" | "unified">("current");
  const forecastComparison = useForecastComparison({
    botType: "future_trade",
    symbol: String(fastChart?.symbol ?? status?.currentSymbol ?? ""),
    timeframe: String(fastChart?.timeframe ?? settings.timeframe ?? "1m"),
    expirySeconds: 300,
    candles: candleChartCandles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close })),
    signal: { direction: displaySignal, confidence: displaySignalConfidence },
  });
  const candleChartSide = ["BUY", "SELL"].includes(String(status?.positionSide ?? "").toUpperCase())
    ? String(status?.positionSide).toUpperCase() as "BUY" | "SELL"
    : null;
  const candleEntryPrice = toNumberOrNull(status?.entryPrice);
  const candleStopPrice = candleEntryPrice && candleChartSide
    ? candleEntryPrice * (candleChartSide === "BUY" ? 1 - settings.stopLossPercent / 100 : 1 + settings.stopLossPercent / 100)
    : null;
  const candleTakeProfitPrice = candleEntryPrice && candleChartSide
    ? candleEntryPrice * (candleChartSide === "BUY" ? 1 + settings.takeProfitPercent / 100 : 1 - settings.takeProfitPercent / 100)
    : null;
  const candleChartPnl = candleChartSide && Number.isFinite(Number(status?.unrealizedPnlPercent)) && Number.isFinite(Number(status?.unrealizedPnl))
    ? { side: candleChartSide, pct: Number(status?.unrealizedPnlPercent), value: Number(status?.unrealizedPnl) }
    : null;

  const runRecovery = (action: "auto" | "sync_state" | "cancel_reduce_only") => {
    bot.recover.mutate(action, {
      onSuccess: (result: FutureTradeRecoveryResult) => {
        toast({
          title: result.resolved ? "Future Trade recovery finished" : "Future Trade recovery needs attention",
          description: result.message,
          variant: result.resolved ? "default" : "destructive",
        });
      },
      onError: err(toast),
    });
  };

  const closeOpenTrade = (trade: FutureTradeRecord) => {
    if (!window.confirm(`Close open ${trade.symbol} position now from AutoFinX? This sends a reduce-only market close in live/testnet mode.`)) {
      return;
    }

    bot.closePosition.mutate({ symbol: trade.symbol }, {
      onSuccess: (result: { closed?: boolean; submitted?: boolean; message?: string }) => {
        toast({
          title: result.closed || result.submitted ? "Close requested" : "Close not sent",
          description: result.message || `${trade.symbol} close request completed.`,
          variant: result.closed || result.submitted ? "default" : "destructive",
        });
      },
      onError: err(toast),
    });
  };

  const save = () => {
    if (!window.confirm("Save Future Trade algorithm changes now? Unsaved slider changes will become active after this save.")) {
      return;
    }
    bot.updateConfig.mutate(
      { settings: { ...settings, paperTrading: !settings.liveTrading }, algorithm_notes: notes },
      {
        onSuccess: () => toast({ title: "Future Trade Bot saved", description: settings.liveTrading ? "Live mode requested. Backend env gate decides if it can activate." : "Paper futures mode active." }),
        onError: (error) => toast({ title: "Save failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" }),
      }
    );
  };

  const generateTuningPlan = () => {
    bot.generateTuningPlan.mutate(undefined, {
      onSuccess: (plan) => {
        setTuningPlan(plan);
        toast({ title: "Tuning plan generated", description: "Preview only. Nothing was applied." });
      },
      onError: (error) => toast({ title: "Tuning plan failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" }),
    });
  };

  const saveEnv = () => {
    const payload: FutureTradeEnvConfigPayload = {
      mode: envSettings.mode,
      testnet_enabled: envSettings.mode === "testnet",
      live_enabled: envSettings.mode === "live",
      force_testnet: envSettings.mode !== "live" && envSettings.force_testnet,
      live_api_url: envSettings.live_api_url,
      testnet_api_url: envSettings.testnet_api_url,
      live_api_key: envSettings.live_api_key,
      testnet_api_key: envSettings.testnet_api_key,
      replace_live_secret: liveSecret.length > 0,
      replace_testnet_secret: testnetSecret.length > 0,
      live_api_secret: liveSecret,
      testnet_api_secret: testnetSecret,
    };

    bot.updateEnvConfig.mutate(payload, {
      onSuccess: (saved) => {
        setEnvSettings({ ...DEFAULT_ENV_CONFIG, ...saved });
        setSettings((current) => ({
          ...current,
          liveTrading: saved.mode !== "paper",
          paperTrading: saved.mode === "paper",
          forceTestnet: saved.mode !== "live",
        }));
        setLiveSecret("");
        setTestnetSecret("");
        toast({ title: "Future Trade environment saved", description: saved.mode === "live" ? "Real Binance Futures config is active." : saved.mode === "testnet" ? "Testnet Binance Futures config is active." : "Paper mode is active." });
      },
      onError: (error) => toast({ title: "Environment save failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" }),
    });
  };

  const testEnvConnection = () => {
    bot.testConnection.mutate(undefined, {
      onSuccess: (result) => {
        toast({
          title: result.connected ? "Connection successful" : "Connection not ready",
          description: result.connected
            ? `${result.message} Wallet ${balanceValue(result.walletBalance, 4)} ${result.accountAsset || "USDT"} | Available ${balanceValue(result.availableBalance, 4)}`
            : result.message,
          variant: result.connected ? "default" : "destructive",
        });
      },
      onError: (error) => toast({ title: "Connection test failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" }),
    });
  };

  const exportTradeHistory = () => {
    const rows = (bot.trades.data ?? []).map(flattenTradeForExport);
    if (rows.length === 0) {
      toast({ title: "No trades to export", description: "Live Futures Trades is empty.", variant: "destructive" });
      return;
    }

    downloadExcelWorkbook(`future-trade-trades-${currentWorkspace?.id || "workspace"}.xls`, [
      { name: "Live Futures Trades", rows },
    ]);
    toast({ title: "Trade export ready", description: `${rows.length} trade rows exported.` });
  };

  const exportRuntimeTracker = () => {
    const rows = trackerRows.map(flattenTrackerRowForExport);
    if (rows.length === 0) {
      toast({ title: "No runtime rows to export", description: "Dynamic Runtime Tracker is empty.", variant: "destructive" });
      return;
    }

    downloadExcelWorkbook(`future-trade-runtime-${currentWorkspace?.id || "workspace"}.xls`, [
      { name: "Dynamic Runtime Tracker", rows },
    ]);
    toast({ title: "Runtime export ready", description: `${rows.length} runtime rows exported.` });
  };

  const exportAllFutureTradeData = () => {
    const tradeRows = (bot.trades.data ?? []).map(flattenTradeForExport);
    const runtimeRows = trackerRows.map(flattenTrackerRowForExport);
    if (tradeRows.length === 0 && runtimeRows.length === 0) {
      toast({ title: "No export data", description: "Trades and runtime tracker are both empty.", variant: "destructive" });
      return;
    }

    downloadExcelWorkbook(`future-trade-export-${currentWorkspace?.id || "workspace"}.xls`, [
      { name: "Live Futures Trades", rows: tradeRows },
      { name: "Dynamic Runtime Tracker", rows: runtimeRows },
    ]);
    toast({ title: "Future Trade export ready", description: `${tradeRows.length} trades and ${runtimeRows.length} runtime rows exported.` });
  };

  const handleImportScript = () => {
    bot.importScript.mutate(
      { name: scriptName, source: scriptSource, script: scriptBody },
      {
        onSuccess: () => {
          toast({ title: "Script imported", description: "Research lab parsed the script and extracted indicator hints." });
          setImportScriptOpen(false);
          setScriptName("");
          setScriptBody("");
        },
        onError: err(toast),
      },
    );
  };

  const handleImportTrades = () => {
    bot.importTrades.mutate(
      { name: tradeDatasetName, format: tradeDatasetFormat, payload: tradeDatasetBody },
      {
        onSuccess: () => {
          toast({ title: "Trade dataset imported", description: "Imported trade history is now part of the research analysis." });
          setImportTradesOpen(false);
          setTradeDatasetName("");
          setTradeDatasetBody("");
        },
        onError: err(toast),
      },
    );
  };

  if (loading || !currentWorkspace) {
    return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading workspace...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
              <Bot className="h-6 w-6 text-primary" />
              Future Trade Bot
            </h1>
            <p className="text-sm text-muted-foreground">Video-style Binance Futures scanner with paper execution, BUY/SELL signals, PnL, stop loss, rollback and trailing profit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(status?.status)}>{status?.status || "Stopped"}</Badge>
            <Badge variant={status?.liveTrading ? (status?.liveTradingEnvEnabled ? "outline" : "destructive") : "secondary"}>{status?.mode || "Paper Futures"}</Badge>
            <Badge variant={status?.liveTradingEnvEnabled ? "outline" : "destructive"}>{status?.liveTradingEnvEnabled ? (settings.forceTestnet ? "Testnet Env Enabled" : "Real Env Enabled") : (settings.forceTestnet ? "Testnet Env Blocked" : "Real Env Blocked")}</Badge>
            <Badge variant={settings.useLiveDataFeed ? "default" : "secondary"}>
              {settings.useLiveDataFeed ? "🟢 Live Data" : "🔴 Testnet Data"}
            </Badge>
          </div>
        </div>

        {liveModeBlocked ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
		              Live mode only activates when the selected execution mode is enabled in My Config. Force testnet uses testnet futures keys; turning it off uses real Binance futures keys.
              </div>
            </div>
          ) : null}

        <div className="grid gap-4 xl:grid-cols-5">
          <Metric title="Total Profit" value={`${n(((dashboard?.realized?.closedCount ?? 0) > 0 ? dashboard?.realized?.totalProfit : undefined) ?? status?.totalProfit ?? status?.realizedPnl, 4)} ${status?.accountAsset || "USDT"}`} sub={`Closed trades ${dashboard?.realized?.closedCount ?? 0} | Unrealized ${n(status?.unrealizedPnlPercent, 4)}%`} good={((((dashboard?.realized?.closedCount ?? 0) > 0 ? dashboard?.realized?.totalProfit : undefined) ?? status?.totalProfit ?? status?.realizedPnl) ?? 0) >= 0} />
          <Metric title="Wallet Balance" value={`${balanceValue(status?.walletBalance, 4)} ${status?.accountAsset || "USDT"}`} sub={status?.balanceSource === "PAPER_LEDGER" ? "Paper mode wallet not linked" : status?.balanceSource === "BINANCE_UNAVAILABLE" ? (status?.balanceError || "Binance futures balance unavailable") : status?.balanceSource === "BINANCE_CACHE_STALE" ? (status?.balanceError || "Using cached Binance wallet balance") : status?.balanceSource === "BINANCE_TEMPORARILY_UNAVAILABLE" ? (status?.balanceError || "Temporary Binance wallet sync issue") : `Available ${balanceValue(status?.availableBalance, 4)}`} icon={<Wallet className="h-4 w-4" />} good={status?.balanceSource === "BINANCE_UNAVAILABLE" ? false : status?.balanceSource === "BINANCE_TEMPORARILY_UNAVAILABLE" ? false : undefined} />
          <Metric title="Current Signal" value={displaySignal || "WAIT"} sub={`${displaySignalSymbol || "No symbol"} | confidence ${n(displaySignalConfidence * 100, 2)}% / min ${n(displaySignalMinimum * 100, 2)}%`} />
          <Metric title="Position" value={status?.positionSide || "FLAT"} sub={`Entry ${n(status?.entryPrice, 8)} | Qty ${n(status?.quantity, 6)}`} />
          <Metric title="Loss Summary" value={`${n(dashboard?.realized?.botLoss ?? status?.botLoss ?? status?.dailyLoss, 4)} ${status?.accountAsset || "USDT"}`} sub={`Win ${n(status?.winRate, 2)}% | Trades ${n(status?.tradeCountToday, 0)}`} good={((dashboard?.realized?.botLoss ?? status?.botLoss ?? status?.dailyLoss) ?? 0) === 0} />
        </div>

        <TopStatusStrip
          liveStatus={fastStatus}
          fallbackStatus={status}
          minQtyWarning={fastStatus?.minQuantityPrecheck}
        />

        {latestRuntimeAlert ? <LatestRuntimeAlert alert={latestRuntimeAlert} busy={bot.recover.isPending} onRecover={runRecovery} /> : null}

        {status?.entryReason ? (
          <Card>
            <CardHeader><CardTitle>Entry Watch</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">{status.entryReason}</div>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <Row label="Signal confidence" value={`${n((status?.confidence ?? 0) * 100, 2)}%`} />
                <Row label="Active minimum" value={`${n((status?.activeMinConfidence ?? settings.minConfidence) * 100, 2)}%`} />
                <Row label="Confidence gap" value={`${n((status?.signalConfidenceGap ?? 0) * 100, 2)}%`} />
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <Row label="Strategy mode" value={resolveStrategyMode(settings)} />
                <Row label="Live update mode" value={String(status?.liveStatus?.mode ?? "-")} />
                <Row label="Indicator timing" value={String(status?.liveStatus?.indicatorMode ?? "-")} />
              </div>
              {liveFeedWarning(status?.liveStatus?.mode) ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {liveFeedWarning(status?.liveStatus?.mode)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Asset class</div>
            <AssetClassToggle
              value="CRYPTO"
              onChange={() => {}}
              disabledClasses={["FOREX"]}
              disabledNote="Coming soon — futures execution (leverage/margin/funding) isn't adapted for a forex/CFD broker yet. Use Quick Trade or Robot Trade for Forex."
            />
          </CardContent>
        </Card>

        <WebhookCommandCenter
          settings={settings}
          diagnostics={dashboard?.diagnostics}
          binanceHealth={bot.binanceHealth.data}
          runtimeHealth={bot.runtimeHealth.data}
          lastWebhook={bot.lastWebhook.data}
          runtimeHealthFromDashboard={dashboard?.runtimeHealth}
        />

        <SafetyRuntimePanel
          runtimeHealth={dashboard?.runtimeHealth}
          signalStability={dashboard?.signalStability}
          realized={dashboard?.realized}
          accountAsset={status?.accountAsset || "USDT"}
        />
        <SignalDebugPanel status={status} debug={dashboard?.signalDebug} settings={settings} />

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Live Futures Graph</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{fastChart?.symbol ?? status?.currentSymbol ?? "-"}</span>
                    <span>{fastChart?.timeframe ?? settings.timeframe}</span>
                    <Badge variant={fastChart?.dataSource === "redis_live_feed" ? "default" : "secondary"}>
                      {fastChart?.dataSource ?? "chart"}
                    </Badge>
                  </div>
                </div>
                <Badge variant={statusVariant(fastBestSignal?.signal)}>{fastBestSignal?.signal || "WAIT"}</Badge>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="candles" className="space-y-3">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="candles">Candles</TabsTrigger>
                    <TabsTrigger value="prime">Prime Graph</TabsTrigger>
                  </TabsList>
                  <TabsContent value="prime" className="m-0">
                    <div className="h-[420px]">
                      <FutureTradeProChart
                        candles={liveCandles}
                        runtimePoints={runtimeChart}
                        settings={settings}
                        symbol={fastChart?.symbol ?? status?.currentSymbol}
                        timeframe={fastChart?.timeframe ?? settings.timeframe}
                        bestSignal={fastBestSignal}
                        levels={dashboard?.levels}
                        overlayHints={dashboard?.researchLab?.overlayHints ?? []}
                        chartDebug={fastChartDebug}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="candles" className="m-0">
                    <div className="rounded-md border border-border/70 bg-background/30 p-2">
                      <RobotLiveChart
                        candles={candleChartCandles}
                        side={candleChartSide}
                        entryPrice={candleEntryPrice}
                        stopPrice={candleStopPrice}
                        takeProfitPrice={candleTakeProfitPrice}
                        markers={candleChartMarkers}
                        pnl={candleChartPnl}
                        height={410}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="mt-4"><ForecastComparisonCard current={forecastComparison.data?.current} unified={forecastComparison.data?.unified} agreement={forecastComparison.data?.comparison.agreement} selected={predictionSource} onSelect={setPredictionSource} /></div>
              </CardContent>
              <div className="px-6 pb-4 text-xs text-muted-foreground">
                Chart debug: latestTickPrice={fastChartDebug.latestTickPrice ?? "-"} | chartUpdatedAt={fastChartDebug.chartUpdatedAt ?? "-"} | lastCandleClose={fastChartDebug.lastCandleClose ?? "-"} | candles={candleChartCandles.length} | isFormingCandle={String(fastChartDebug.isFormingCandle)}
              </div>
            </Card>

            <IndicatorExecutionPanel indicatorSuite={dashboard?.indicatorSuite} />

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <SignalBoard signals={fastScanner} />
              <Orderbook bids={dashboard?.orderbook.bids ?? []} asks={dashboard?.orderbook.asks ?? []} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportScriptOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Script
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportTradesOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Trades
              </Button>
              <Button variant="outline" size="sm" onClick={exportTradeHistory}>
                <Download className="mr-2 h-4 w-4" />
                Export Trades
              </Button>
              <Button variant="outline" size="sm" onClick={exportRuntimeTracker}>
                <Download className="mr-2 h-4 w-4" />
                Export Runtime
              </Button>
              <Button size="sm" onClick={exportAllFutureTradeData}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export All Excel
              </Button>
            </div>

            <TradeHistory
              trades={bot.trades.data ?? []}
              liveTrading={status?.liveTrading ?? false}
              closeBusy={bot.closePosition.isPending}
              onClose={closeOpenTrade}
            />
            <FutureTradeAiGatePanel workspaceId={currentWorkspace?.id} />
            <DynamicRuntimeTracker logs={bot.logs.data ?? []} />
            <RuntimeDiagnosticsPanel
              diagnostics={diagnostics}
              busy={busy}
              onRecover={runRecovery}
              onCloseOpenPosition={() => {
                if (!window.confirm("Close the current open Future Trade position now? In live/testnet this sends a reduce-only market close.")) return;
                bot.closePosition.mutate({}, {
                  onSuccess: (result: { closed?: boolean; submitted?: boolean; message?: string }) => toast({
                    title: result.closed || result.submitted ? "Close requested" : "Close not sent",
                    description: result.message || "Close-position request completed.",
                    variant: result.closed || result.submitted ? "default" : "destructive",
                  }),
                  onError: err(toast),
                });
              }}
              onFreshReset={() => {
                if (!confirm("Fresh Reset will clear Future Trade profit/loss summary, trades, logs, diagnostics, and stale app-side open state only if Binance is flat. Continue?")) return;
                bot.clearHistory.mutate(undefined, {
                  onSuccess: (data: any) => toast({
                    title: data?.cleared ? "Fresh reset complete" : "Fresh reset blocked",
                    description: data?.message || `${data?.cleared_trades ?? 0} trades, ${data?.cleared_logs ?? 0} logs deleted.`,
                    variant: data?.blocked ? "destructive" : "default",
                  }),
                  onError: err(toast),
                });
              }}
              onResetDailyLoss={() => bot.resetDailyLoss.mutate(undefined, { onError: err(toast) })}
              onTestConnection={testEnvConnection}
            />
            <PerformanceFeedbackPanel feedback={dashboard?.performanceFeedback} />
            <IndicatorIntelligencePanel intelligence={dashboard?.indicatorIntelligence} />
            <ResearchLabPanel researchLab={dashboard?.researchLab} />
            <TuningPlanPanel
              tuningPlan={tuningPlan}
              versions={bot.config.data?.config_versions ?? []}
              onGenerate={generateTuningPlan}
              busy={tuningBusy}
            />
            <MissedTradeAuditPanel audit={dashboard?.missedTradeAudit} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Bot Controls</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button className="h-11" disabled={busy} onClick={() => bot.start.mutate(undefined, { onError: err(toast) })}><Power className="mr-2 h-4 w-4" />On</Button>
                <Button className="h-11" disabled={busy} variant="outline" onClick={() => bot.stop.mutate(undefined, { onError: err(toast) })}><Square className="mr-2 h-4 w-4" />Off</Button>
                <Button className="h-11" disabled={busy} variant="destructive" onClick={() => bot.emergencyStop.mutate(undefined, { onError: err(toast) })}><ShieldAlert className="mr-2 h-4 w-4" />Emergency</Button>
                <Button className="h-11" disabled={busy} variant="secondary" onClick={() => bot.resetPaper.mutate(undefined, { onError: err(toast) })}><RefreshCw className="mr-2 h-4 w-4" />Reset Paper</Button>
                <Button disabled={busy} variant="outline" className="col-span-2 h-11" onClick={() => bot.resetDailyLoss.mutate(undefined, { onError: err(toast) })}>Reset Day Loss</Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  className="col-span-2 h-11 border-orange-500 text-orange-600 hover:bg-orange-50"
                  onClick={() => {
                    if (!confirm("Fresh Reset will clear Future Trade profit/loss summary, trades, logs, diagnostics, and stale app-side open state only if Binance is flat. Continue?")) return;
                    bot.clearHistory.mutate(undefined, {
                      onSuccess: (data: any) => toast({
                        title: data?.cleared ? "Fresh reset complete" : "Fresh reset blocked",
                        description: data?.message || `${data?.cleared_trades ?? 0} trades, ${data?.cleared_logs ?? 0} logs deleted.`,
                        variant: data?.blocked ? "destructive" : "default",
                      }),
                      onError: err(toast),
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />Fresh Reset Summary
                </Button>
              </CardContent>
            </Card>

            <LiveFeedDaemonCard
              liveFeed={bot.liveFeed.data}
              busy={liveFeedBusy}
              onStart={() => bot.startLiveFeed.mutate(undefined, { onError: err(toast) })}
              onStop={() => bot.stopLiveFeed.mutate(undefined, { onError: err(toast) })}
              onRestart={() => bot.restartLiveFeed.mutate(undefined, { onError: err(toast) })}
              onRecoverRuntime={() => bot.recoverRuntime.mutate(undefined, { onError: err(toast) })}
            />

            <ExecutionSafetyPanel
              settings={settings}
              setSettings={setSettings}
              liveFeed={bot.liveFeed.data}
              lastWebhook={bot.lastWebhook.data}
              onSave={save}
              busy={busy}
            />

            <RiskPanel settings={settings} dynamic={dashboard?.dynamic ?? status?.dynamic} />
            <DynamicSuggestionPanel
              dynamic={dashboard?.dynamic ?? status?.dynamic}
              onApplyRecommendation={(next) => setSettings({ ...settings, ...next })}
              onRestoreManual={() => setSettings(savedSettings)}
            />
            <Tabs defaultValue="algorithm" className="space-y-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
                <TabsTrigger value="my-config">My Config</TabsTrigger>
              </TabsList>
              <TabsContent value="algorithm">
                <ConfigPanel envMode={envSettings.mode} status={status} debug={dashboard?.signalDebug} intelligence={dashboard?.indicatorIntelligence} settings={settings} setSettings={setSettings} notes={notes} setNotes={setNotes} availableSymbols={bot.config.data?.available_symbols ?? FUTURE_TRADE_ALL_SYMBOLS} onSave={save} busy={busy} />
              </TabsContent>
              <TabsContent value="my-config">
                <MyConfigPanel envSettings={envSettings} setEnvSettings={setEnvSettings} liveSecret={liveSecret} setLiveSecret={setLiveSecret} testnetSecret={testnetSecret} setTestnetSecret={setTestnetSecret} onSave={saveEnv} onTestConnection={testEnvConnection} busy={envBusy || bot.testConnection.isPending} />
              </TabsContent>
            </Tabs>
            <LogFeed logs={bot.logs.data ?? []} />
          </div>
        </div>
      </div>
      <Dialog open={importScriptOpen} onOpenChange={setImportScriptOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Import Pine / Strategy Script</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={scriptName} onChange={(e) => setScriptName(e.target.value)} placeholder="Optional display name" /></Field>
            <Field label="Source"><Input value={scriptSource} onChange={(e) => setScriptSource(e.target.value)} placeholder="pine, tradingview, custom" /></Field>
            <Field label="Script body">
              <Textarea className="min-h-[320px] font-mono text-xs" value={scriptBody} onChange={(e) => setScriptBody(e.target.value)} placeholder="Paste Pine Script or previous strategy script here..." />
            </Field>
            <Button disabled={researchBusy || scriptBody.trim() === ""} onClick={handleImportScript}>
              <Upload className="mr-2 h-4 w-4" />
              Import Script
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={importTradesOpen} onOpenChange={setImportTradesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Import Previous Trade Dataset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Dataset name"><Input value={tradeDatasetName} onChange={(e) => setTradeDatasetName(e.target.value)} placeholder="Optional dataset name" /></Field>
            <Field label="Format">
              <RadioGroup value={tradeDatasetFormat} onValueChange={(value) => setTradeDatasetFormat(value as "csv" | "json")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                    <RadioGroupItem value="csv" className="mt-1" />
                    <span><span className="block font-medium">CSV</span><span className="block text-xs text-muted-foreground">Header example: symbol,timeframe,side,entry,exit,net_pnl,vwap_aligned,ema_aligned,adx_ready</span></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                    <RadioGroupItem value="json" className="mt-1" />
                    <span><span className="block font-medium">JSON</span><span className="block text-xs text-muted-foreground">Array of trade rows with pnl/outcome and optional indicator flags.</span></span>
                  </label>
                </div>
              </RadioGroup>
            </Field>
            <Field label="Payload">
              <Textarea className="min-h-[320px] font-mono text-xs" value={tradeDatasetBody} onChange={(e) => setTradeDatasetBody(e.target.value)} placeholder="Paste CSV or JSON trade rows here..." />
            </Field>
            <Button disabled={researchBusy || tradeDatasetBody.trim() === ""} onClick={handleImportTrades}>
              <Upload className="mr-2 h-4 w-4" />
              Import Trades
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function err(toast: ReturnType<typeof useToast>["toast"]) {
  return (error: unknown) => toast({ title: "Future Trade Bot failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
}

function Metric({ title, value, sub, good, icon }: { title: string; value: string; sub: string; good?: boolean; icon?: ReactNode }) {
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent><div className={cn("text-xl font-semibold", good === false && "text-destructive", good === true && "text-running")}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{sub}</div></CardContent></Card>
  );
}

function TopStatusStrip({
  liveStatus,
  fallbackStatus,
  minQtyWarning,
}: {
  liveStatus?: ReturnType<typeof useFutureTradeBot>["liveStatus"]["data"];
  fallbackStatus?: FutureTradeDashboard["status"] | null;
  minQtyWarning?: NonNullable<ReturnType<typeof useFutureTradeBot>["liveStatus"]["data"]>["minQuantityPrecheck"];
}) {
  const feedMode = liveStatus?.feedMode ?? fallbackStatus?.liveStatus?.mode ?? "-";
  const tickAge = liveStatus?.tickAgeSeconds ?? fallbackStatus?.liveStatus?.ageSeconds;
  const scanAge = liveStatus?.scanAgeSeconds ?? null;
  const feedVariant = String(feedMode).includes("STALE") || (tickAge ?? 0) > 10 ? "destructive" : String(feedMode).includes("REST") ? "secondary" : "default";
  const scanVariant = scanAge != null && scanAge > 5 ? "destructive" : "default";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-3 text-xs">
        <Badge variant={liveStatus?.liveTrading || fallbackStatus?.liveTrading ? "outline" : "secondary"}>Mode: {liveStatus?.mode ?? fallbackStatus?.mode ?? "-"}</Badge>
        <Badge variant={(liveStatus?.enabled ?? fallbackStatus?.status === "Running") ? "default" : "destructive"}>Workspace: {liveStatus?.enabled ? "Enabled" : "Disabled"}</Badge>
        <Badge variant="outline">Strategy: {liveStatus?.strategyMode ?? "-"}</Badge>
        <Badge variant="outline">Confidence: {liveStatus?.confidenceMode ?? fallbackStatus?.settings?.confidenceMode ?? "-"}</Badge>
        <Badge variant="outline">Min {n((liveStatus?.minConfidence ?? fallbackStatus?.settings?.minConfidence ?? 0) * 100, 2)}%</Badge>
        <Badge variant="outline">Active {n((liveStatus?.activeMinimum ?? fallbackStatus?.activeMinConfidence ?? 0) * 100, 2)}%</Badge>
        <Badge variant={feedVariant}>Feed: {feedMode}</Badge>
        <Badge variant={feedVariant}>Tick age: {tickAge ?? "-"}s</Badge>
        <Badge variant={scanVariant}>Scan age: {scanAge ?? "-"}s</Badge>
        <Badge variant="outline">Position: {liveStatus?.positionSide ?? fallbackStatus?.positionSide ?? "FLAT"}</Badge>
        <Badge variant="outline">Wallet: {balanceValue(liveStatus?.walletBalance ?? fallbackStatus?.walletBalance, 4)} {liveStatus?.accountAsset ?? fallbackStatus?.accountAsset ?? "USDT"}</Badge>
        <Badge variant={statusVariant(liveStatus?.currentSignal ?? fallbackStatus?.currentSignal)}>{liveStatus?.currentSignal ?? fallbackStatus?.currentSignal ?? "WAIT"} {n((liveStatus?.currentConfidence ?? fallbackStatus?.confidence ?? 0) * 100, 2)}%</Badge>
        {liveStatus?.lastSkipReason ? <Badge variant="secondary">Skip: {liveStatus.lastSkipReason}</Badge> : null}
        {liveStatus?.classicSimpleMode ? <Badge variant="destructive">Indicators are OFF. VWAP/EMA/ADX/MACD weights are ignored.</Badge> : null}
        {tickAge != null && tickAge > 10 ? <Badge variant="destructive">Feed stale. Graph may not update.</Badge> : null}
        {scanAge != null && scanAge > 5 ? <Badge variant="destructive">Scanner stale. Signals may not refresh.</Badge> : null}
        {minQtyWarning && !minQtyWarning.canTrade ? (
          <Badge variant="destructive">
            {minQtyWarning.symbol} trade amount too low. Minimum recommended: {n(minQtyWarning.recommendedTradeAmountUsdt, 2)} USDT
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IndicatorExecutionPanel({ indicatorSuite }: { indicatorSuite?: FutureTradeIndicatorSuite }) {
  if (!indicatorSuite) return null;

  const backtest = indicatorSuite.backtest;
  const trend = indicatorSuite.trend;
  const score = indicatorSuite.score != null ? `${n(indicatorSuite.score * 100, 0)}%` : "-";

  return (
      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{indicatorSuite.preset || "Indicator"} Confirmation Engine</CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="outline">1s refresh</Badge>
          <Badge variant={indicatorSuite.executionReady ? "default" : indicatorSuite.state === "warming_up" ? "secondary" : "outline"}>
            {indicatorSuite.executionReady ? "Execution Ready" : humanizeCode(indicatorSuite.state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{indicatorSuite.summary}</div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Signal</span>
              <Badge variant={statusVariant(indicatorSuite.signal)}>{indicatorSuite.signal || "WAIT"}</Badge>
            </div>
            <Row label="Confirmation score" value={score} />
            <Row label="Trend direction" value={trend?.direction || "-"} />
            <Row label="ADX" value={trend?.adx != null ? n(trend.adx, 2) : "-"} />
            <Row label="VWAP" value={trend?.vwap != null ? n(trend.vwap, 4) : "-"} />
            <Row label="OR High / Low" value={`${trend?.openingRangeHigh != null ? n(trend.openingRangeHigh, 4) : "-"} / ${trend?.openingRangeLow != null ? n(trend.openingRangeLow, 4) : "-"}`} />
            <Row label="Bubble count" value={trend?.bubbleCount != null ? n(trend.bubbleCount, 0) : "-"} />
            <Row label="Supply / Demand" value={`${trend?.zones?.supply != null ? n(trend.zones.supply, 4) : "-"} / ${trend?.zones?.demand != null ? n(trend.zones.demand, 4) : "-"}`} />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Validation checklist</div>
            <div className="space-y-2">
              {indicatorSuite.validations.length === 0 ? (
                <div className="text-sm text-muted-foreground">Indicator checks are still warming up.</div>
              ) : indicatorSuite.validations.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <Badge variant={item.passed ? "default" : "secondary"}>{item.passed ? "Pass" : "Fail"}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric title="Backtest Trades" value={n(backtest.trades, 0)} sub={`${n(backtest.wins, 0)} wins | ${n(backtest.losses, 0)} losses`} />
          <Metric title="Win Rate" value={`${n(backtest.winRate, 2)}%`} sub="Indicator-only sample backtest" good={backtest.winRate >= 50} />
          <Metric title="Net %" value={`${n(backtest.netPercent, 2)}%`} sub={`Best ${n(backtest.bestTrade, 2)}% | Worst ${n(backtest.worstTrade, 2)}%`} good={backtest.netPercent >= 0} />
          <Metric title="Use Case" value={indicatorSuite.executionReady ? "Confirmed" : "Filtered"} sub="Visual support + guard + backtest layer" good={indicatorSuite.executionReady} />
        </div>
      </CardContent>
    </Card>
  );
}

function LatestRuntimeAlert({
  alert,
  busy,
  onRecover,
}: {
  alert: { event: string; reason?: string | null; occurredAt?: string | null };
  busy: boolean;
  onRecover: (action: "auto" | "sync_state" | "cancel_reduce_only") => void;
}) {
  const message = alert.reason || "No error reason provided.";
  const blocksNewEntries = /reduceonly order is rejected|margin is insufficient|insufficient/i.test(message);

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-destructive" /> Latest Runtime Alert</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive">{alert.event}</Badge>
          <span className="text-xs text-muted-foreground">{alert.occurredAt ? new Date(alert.occurredAt).toLocaleString() : "Unknown time"}</span>
        </div>
        <div className="rounded-md border bg-background/60 p-3 text-muted-foreground">{message}</div>
        <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
          {blocksNewEntries
            ? "This error can block fresh entries until Binance position state and bot state are back in sync. Use Auto Resolve first."
            : "This alert does not always stop scanning, but it should be reviewed before trusting the next trade."}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => onRecover("auto")}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Auto Resolve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onRecover("sync_state")}>
            Sync Binance State
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onRecover("cancel_reduce_only")}>
            Cancel Close Orders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionSafetyPanel({
  settings,
  setSettings,
  liveFeed,
  lastWebhook,
  onSave,
  busy,
}: {
  settings: FutureTradeSettings;
  setSettings: (settings: FutureTradeSettings) => void;
  liveFeed?: FutureTradeLiveFeedStatus;
  lastWebhook?: FutureTradeLastWebhook;
  onSave: () => void;
  busy: boolean;
}) {
  const liveFeedMax = Number(settings.liveFeedMaxAgeSeconds ?? liveFeed?.maxAgeSeconds ?? 3);
  const webhookMax = Number(settings.webhookMaxSignalLatencyMs ?? 4000);
  return (
    <ExecutionSafetyControls
      title="Global Execution Safety"
      moduleLabel="Future Trade"
      values={{ liveFeedMaxAgeSeconds: liveFeedMax, webhookMaxSignalLatencyMs: webhookMax }}
      telemetry={{
        feedAgeSeconds: liveFeed?.feedAgeSeconds ?? liveFeed?.ageSeconds ?? null,
        feedState: liveFeed?.feedFresh ? "green" : "red",
        feedReason: liveFeed?.reason ?? liveFeed?.message,
        truthSource: liveFeed?.source ?? liveFeed?.dataSource ?? "binance_futures_ws",
        lastTickAt: liveFeed?.lastTickAt,
        webhookSignalLatencyMs: lastWebhook?.signalLatencyMs ?? null,
        serverNow: liveFeed?.server_now,
      }}
      onChange={(values: ExecutionSafetyValues) => setSettings({
        ...settings,
        liveFeedMaxAgeSeconds: values.liveFeedMaxAgeSeconds,
        webhookMaxSignalLatencyMs: values.webhookMaxSignalLatencyMs,
      })}
      onSave={onSave}
      busy={busy}
    />
  );
}

function RuntimeDiagnosticsPanel({
  diagnostics,
  busy,
  onRecover,
  onCloseOpenPosition,
  onFreshReset,
  onResetDailyLoss,
  onTestConnection,
}: {
  diagnostics?: FutureTradeDiagnostics;
  busy: boolean;
  onRecover: (action: "auto" | "sync_state" | "cancel_reduce_only") => void;
  onCloseOpenPosition: () => void;
  onFreshReset: () => void;
  onResetDailyLoss: () => void;
  onTestConnection: () => void;
}) {
  const pruneStale = usePruneStalePendingJobs();
  const restartWorkers = useRestartWorkers();

  if (!diagnostics) return null;

  const queueBacklog = Number(diagnostics.server.queue?.queue_backlog ?? 0);
  const queueFailed = Number(diagnostics.server.queue?.failed_jobs ?? 0);
  const queueWarn = Number(diagnostics.server.queue?.warning_threshold ?? 0);
  const queueBlock = Number(diagnostics.server.queue?.block_threshold ?? 0);
  const queueState = String(diagnostics.server.queue?.state ?? "unknown");
  const webhookState = String(diagnostics.webhook?.state ?? "waiting");
  const actionBusy = busy || pruneStale.isPending || restartWorkers.isPending;
  const autoPruneThreshold = 300;
  const eligibility = diagnostics.tradeEligibility;
  const firstBlocker = eligibility?.firstBlockerLabel || (eligibility?.firstBlocker ? humanizeCode(eligibility.firstBlocker) : null);
  const runSuggestedAction = (action: string) => {
    if (action === "sync_state") onRecover("sync_state");
    if (action === "close_position") onCloseOpenPosition();
    if (action === "clear_history") onFreshReset();
    if (action === "reset_daily_loss") onResetDailyLoss();
    if (action === "test_connection") onTestConnection();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Runtime Diagnostics</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{diagnostics.summary}</div>

        <div className="grid gap-3 lg:grid-cols-4">
          <DiagnosticBox
            title="Bot blockers"
            tone={diagnostics.botBlockers.length > 0 ? "danger" : diagnostics.botWarnings.length > 0 ? "warning" : "ok"}
            lines={(diagnostics.botBlockers.length > 0 ? diagnostics.botBlockers : diagnostics.botWarnings.length > 0 ? diagnostics.botWarnings : ["none"]).map(humanizeCode)}
          />
          <DiagnosticBox
            title="Wallet"
            tone={diagnostics.wallet.state === "blocked" ? "danger" : diagnostics.wallet.state === "warning" ? "warning" : "ok"}
            lines={[
              diagnostics.wallet.message,
              `Wallet ${balanceValue(diagnostics.wallet.walletBalance, 4)} ${diagnostics.wallet.accountAsset || "USDT"}`,
              `Available ${balanceValue(diagnostics.wallet.availableBalance, 4)}`,
            ]}
          />
          <DiagnosticBox
            title="Server health"
            tone={diagnostics.server.state === "blocked" ? "danger" : diagnostics.server.state === "degraded" || diagnostics.server.state === "caution" ? "warning" : "ok"}
            lines={[
              `State ${humanizeCode(diagnostics.server.state)}`,
              `Scheduler ${humanizeCode(String(diagnostics.server.scheduler?.state ?? "unknown"))}`,
              `Queue ${humanizeCode(queueState)}`,
              `Backlog ${n(queueBacklog, 0)} | warn ${n(queueWarn, 0)} | block ${n(queueBlock, 0)} | failed ${n(queueFailed, 0)}`,
            ]}
          />
          <DiagnosticBox
            title="Webhook latency"
            tone={webhookState === "healthy" ? "ok" : webhookState === "stale" || webhookState === "warning" ? "warning" : "ok"}
            lines={[
              diagnostics.webhook?.summary ?? "No TradingView webhook received yet.",
              `Latest ${diagnostics.webhook?.latestEvent ?? "-"} ${diagnostics.webhook?.signal ?? ""}`.trim(),
              diagnostics.webhook?.reason ? `Reason ${diagnostics.webhook.reason}` : "Reason -",
              `Signal latency ${diagnostics.webhook?.signalLatencyMs != null ? `${n(diagnostics.webhook.signalLatencyMs, 0)} ms` : "-"}`,
              `Transport ${diagnostics.webhook?.transportLatencyMs != null ? `${n(diagnostics.webhook.transportLatencyMs, 0)} ms` : "-"}`,
            ]}
          />
        </div>

        {diagnostics.tradeEligibility ? (
          <div className="rounded-md border bg-muted/10 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-medium">Trade eligibility</div>
                <div className="mt-1 text-xs text-muted-foreground">{diagnostics.tradeEligibility.summary}</div>
              </div>
              <Badge variant={diagnostics.tradeEligibility.decision === "eligible" ? "outline" : diagnostics.tradeEligibility.decision === "blocked" ? "destructive" : "secondary"}>
                {humanizeCode(diagnostics.tradeEligibility.decision ?? "waiting")}
              </Badge>
            </div>
            <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${diagnostics.tradeEligibility.decision === "blocked" ? "border-destructive/40 bg-destructive/10" : "border-emerald-500/30 bg-emerald-500/5"}`}>
              <div className="font-medium">
                {diagnostics.tradeEligibility.decision === "blocked"
                  ? `First blocker: ${firstBlocker || "Unknown blocker"}`
                  : diagnostics.tradeEligibility.decision === "eligible"
                    ? "Ready for next executable signal"
                    : "No hard blocker"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {diagnostics.tradeEligibility.nextAction || "Waiting for the next valid TradingView signal."}
              </div>
              {(diagnostics.tradeEligibility.recoveryActions ?? []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(diagnostics.tradeEligibility.recoveryActions ?? []).map((item) => (
                    <Button
                      key={`${item.action}-${item.label}`}
                      size="sm"
                      variant={item.action === "wait_webhook" ? "outline" : "secondary"}
                      disabled={actionBusy || item.action === "wait_webhook"}
                      onClick={() => runSuggestedAction(item.action)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
              <div>Source <span className="font-mono text-foreground">{humanizeCode(diagnostics.tradeEligibility.signalSource ?? "-")}</span></div>
              <div>Webhook <span className="font-mono text-foreground">{diagnostics.tradeEligibility.latestWebhookEvent ?? "-"}</span></div>
              <div>Signal <span className="font-mono text-foreground">{diagnostics.tradeEligibility.latestWebhookSignal ?? diagnostics.tradeEligibility.bestSignal ?? "-"}</span></div>
              <div>Confidence <span className="font-mono text-foreground">{n((diagnostics.tradeEligibility.bestConfidence ?? 0) * 100, 1)}% / min {n((diagnostics.tradeEligibility.activeMinimum ?? 0) * 100, 1)}%</span></div>
            </div>
            {(diagnostics.tradeEligibility.blockers ?? []).length > 0 ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                <span className="font-medium text-destructive">Blockers: </span>
                {(diagnostics.tradeEligibility.blockers ?? []).map(humanizeCode).join(", ")}
              </div>
            ) : null}
            {(diagnostics.tradeEligibility.warnings ?? []).length > 0 ? (
              <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-amber-300">Warnings: </span>
                {(diagnostics.tradeEligibility.warnings ?? []).map(humanizeCode).join(", ")}
              </div>
            ) : null}
          </div>
        ) : null}

        {queueBacklog >= queueBlock || queueState === "blocked" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-destructive">Queue recovery actions</div>
                <div className="text-xs text-muted-foreground">
                  Safe stale jobs older than 30 minutes can be pruned automatically after backlog {autoPruneThreshold}. Protected live queues stay untouched.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionBusy}
                  onClick={() => {
                    if (window.confirm("Prune stale safe jobs now? Live execution, reconcile, and exit-monitor queues stay protected.")) {
                      pruneStale.mutate({ confirm: true });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Prune Safe Stale Jobs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => {
                    if (window.confirm("Send queue restart signal now? Workers will restart after the current job.")) {
                      restartWorkers.mutate({});
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Restart Workers
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <div className="text-sm font-medium">Active checks</div>
            <div className="space-y-2">
              {diagnostics.botChecks.length === 0 ? (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No diagnostics checks yet.</div>
              ) : diagnostics.botChecks.map((check, index) => (
                <div key={`${check.label}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{check.label}</span>
                    <Badge variant={check.state === "blocked" ? "destructive" : check.state === "warning" ? "secondary" : "outline"}>{humanizeCode(check.state)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{check.message}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Scheduler history</div>
            <div className="space-y-2">
              {(diagnostics.recentSchedulerRuns ?? []).length === 0 ? (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No scheduler history yet.</div>
              ) : diagnostics.recentSchedulerRuns?.map((run) => (
                <div key={run.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{run.command}</span>
                    <Badge variant={run.status === "completed" ? "outline" : run.status === "running" ? "secondary" : "destructive"}>{run.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : "Unknown start"} {run.duration_ms != null ? `| ${n(run.duration_ms, 0)} ms` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(diagnostics.server.blockers.length > 0 || diagnostics.server.warnings.length > 0) ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Server safety signals</div>
            <div className="flex flex-wrap gap-2">
              {diagnostics.server.blockers.map((item) => <Badge key={`b-${item}`} variant="destructive">{humanizeCode(item)}</Badge>)}
              {diagnostics.server.warnings.map((item) => <Badge key={`w-${item}`} variant="secondary">{humanizeCode(item)}</Badge>)}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PerformanceFeedbackPanel({ feedback }: { feedback?: FutureTradeDashboard["performanceFeedback"] | null }) {
  if (!feedback) return null;

  const exitRows = Object.entries(feedback.exitReasons ?? {}).slice(0, 6);
  const sideRows = Object.entries(feedback.sides ?? {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric title="Closed sample" value={n(feedback.sampleSize, 0)} sub="Last 50 closed trades" />
          <Metric title="Win rate" value={feedback.winRate != null ? `${n(feedback.winRate, 1)}%` : "-"} sub={`${n(feedback.wins ?? 0, 0)} wins | ${n(feedback.losses ?? 0, 0)} losses`} />
          <Metric title="Net PnL" value={feedback.netPnl != null ? `${n(feedback.netPnl, 4)} USDT` : "-"} sub={`Avg ${n(feedback.avgNetPnl ?? 0, 4)}`} />
          <Metric title="Avg signal latency" value={feedback.latency?.avgSignalLatencyMs != null ? `${n(feedback.latency.avgSignalLatencyMs, 0)} ms` : "-"} sub={`${n(feedback.latency?.samples ?? 0, 0)} samples`} />
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          {feedback.summary ?? "Closed trade feedback is waiting for data."}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Exit quality</div>
            {exitRows.length === 0 ? (
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No exit stats yet.</div>
            ) : exitRows.map(([reason, row]) => (
              <div key={reason} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{humanizeCode(reason)}</span>
                <span className="text-muted-foreground">{n(row.count, 0)} trades | {n(row.winRate, 1)}% | {n(row.netPnl, 4)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Side quality</div>
            {sideRows.length === 0 ? (
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No side stats yet.</div>
            ) : sideRows.map(([side, row]) => (
              <div key={side} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{side}</span>
                <span className="text-muted-foreground">{n(row.count, 0)} trades | {n(row.winRate, 1)}% | {n(row.netPnl, 4)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Auto tuning notes</div>
          <div className="space-y-2">
            {(feedback.suggestions ?? ["No suggestions yet."]).map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-md border px-3 py-2 text-xs text-muted-foreground">{item}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosticBox({ title, tone, lines }: { title: string; tone: "ok" | "warning" | "danger"; lines: string[] }) {
  return (
    <div className={cn("rounded-md border p-3 text-sm", tone === "danger" && "border-destructive/30 bg-destructive/5", tone === "warning" && "border-amber-500/30 bg-amber-500/5")}>
      <div className="mb-2 font-medium">{title}</div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {lines.map((line, index) => <div key={`${title}-${index}`}>{line}</div>)}
      </div>
    </div>
  );
}

function SignalBoard({ signals }: { signals: Array<{ symbol: string; signal: string; price: number; changePercent: number; confidence: number; timeframe: string; reason: string; rsi14?: number | null; emaBullish?: boolean | null; macdBullish?: boolean | null; macdHistGrowing?: boolean | null; htfBullish?: boolean | null; htf4hBullish?: boolean | null; symbolPerfAdj?: number | null }> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Signal Scanner</CardTitle>
          <Badge variant="outline">1s refresh</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          BUY/SELL means scanner direction. Move is recent price change; red only means the latest move is negative. Confidence is shown separately and must be above the active minimum before a trade qualifies.
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {signals.slice(0, 10).map((signal) => (
          <div key={signal.symbol} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant={statusVariant(signal.signal)}>{signal.signal}</Badge>
                <span className="font-medium">FUTURES - {signal.symbol} - {signal.timeframe}</span>

                {/* RSI */}
                {signal.rsi14 != null && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-mono", signal.rsi14 >= 70 ? "bg-destructive/20 text-destructive" : signal.rsi14 <= 30 ? "bg-running/20 text-running" : "bg-muted text-muted-foreground")}>
                    RSI {n(signal.rsi14, 1)}
                  </span>
                )}

                {/* MACD */}
                {signal.macdBullish != null && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-mono", signal.macdBullish ? "bg-running/20 text-running" : "bg-destructive/20 text-destructive")}>
                    MACD {signal.macdBullish ? "▲" : "▼"}{signal.macdHistGrowing ? "+" : ""}
                  </span>
                )}

                {/* EMA crossover */}
                {signal.emaBullish != null && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", signal.emaBullish ? "bg-running/20 text-running" : "bg-destructive/20 text-destructive")}>
                    EMA {signal.emaBullish ? "↑" : "↓"}
                  </span>
                )}

                {/* 1h HTF */}
                {signal.htfBullish != null && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", signal.htfBullish ? "bg-running/10 text-running" : "bg-destructive/10 text-destructive")}>
                    1h {signal.htfBullish ? "▲" : "▼"}
                  </span>
                )}

                {/* 4h HTF */}
                {signal.htf4hBullish != null && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-semibold", signal.htf4hBullish ? "bg-running/10 text-running" : "bg-destructive/10 text-destructive")}>
                    4h {signal.htf4hBullish ? "▲▲" : "▼▼"}
                  </span>
                )}

                {/* Symbol performance */}
                {signal.symbolPerfAdj != null && signal.symbolPerfAdj !== 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", signal.symbolPerfAdj > 0 ? "bg-running/10 text-running" : "bg-destructive/10 text-destructive")}>
                    Perf {signal.symbolPerfAdj > 0 ? "+" : ""}{(signal.symbolPerfAdj * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">{signal.reason}</div>
            </div>
            <div className="text-right ml-3 shrink-0">
              <div>{n(signal.price, 8)}</div>
              <div className={cn("text-xs", signal.changePercent >= 0 ? "text-running" : "text-destructive")}>Move {n(signal.changePercent, 2)}%</div>
              <div className="text-xs text-muted-foreground">Conf {n(signal.confidence * 100, 1)}%</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Orderbook({ bids, asks }: { bids: Array<{ price: number; qty: number }>; asks: Array<{ price: number; qty: number }> }) {
  return (
    <Card>
      <CardHeader><CardTitle>Orderbook Ladder</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">{asks.slice().reverse().map((row) => <div key={`a-${row.price}`} className="flex justify-between rounded bg-destructive/10 px-2 py-1 text-destructive"><span>{n(row.price, 8)}</span><span>{n(row.qty, 4)}</span></div>)}</div>
        <div className="space-y-1">{bids.map((row) => <div key={`b-${row.price}`} className="flex justify-between rounded bg-running/10 px-2 py-1 text-running"><span>{n(row.price, 8)}</span><span>{n(row.qty, 4)}</span></div>)}</div>
      </CardContent>
    </Card>
  );
}

function RiskPanel({ settings, dynamic }: { settings: FutureTradeSettings; dynamic?: FutureTradeDynamicDecision }) {
  const active = dynamic?.recommended;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Loss Prevention</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Base stop loss" value={`${settings.stopLossPercent}%`} />
        <Row label="Active stop loss" value={`${n(active?.stopLossPercent ?? settings.stopLossPercent, 3)}%`} />
        <Row label="Rollback loss" value={`${settings.rollbackLossPercent}%`} />
        <Row label="Base trailing" value={`${settings.trailingTakeProfitPercent}%`} />
        <Row label="Active trailing" value={`${n(active?.trailingTakeProfitPercent ?? settings.trailingTakeProfitPercent, 3)}%`} />
        <Row label="Base take profit" value={`${settings.takeProfitPercent}%`} />
        <Row label="Active take profit" value={`${n(active?.takeProfitPercent ?? settings.takeProfitPercent, 3)}%`} />
        <Row label="Confidence mode" value={String(settings.confidenceMode || "fixed").replace("_", " ")} />
        <Row label="Base confidence" value={`${n(settings.minConfidence * 100, 2)}%`} />
        <Row label="Active confidence" value={`${n((dynamic?.effectiveMinConfidence ?? settings.minConfidence) * 100, 2)}%`} />
        <Row label="Daily loss limit" value={`${settings.maxDailyLossPercent}%`} />
        <Row label="Active cooldown" value={`${n(active?.cooldownSeconds ?? settings.cooldownSeconds, 0)}s`} />
        <Row label="Active trade size" value={`${n(active?.tradeAmountUsdt ?? settings.tradeAmountUsdt, 2)} USDT`} />
        <Row label="Active leverage" value={`${n(active?.leverage ?? settings.leverage, 0)}x`} />
        <Row label="Max leverage" value={`${settings.maxLeverage}x`} />
      </CardContent>
    </Card>
  );
}

function DynamicSuggestionPanel({ dynamic, onApplyRecommendation, onRestoreManual }: { dynamic?: FutureTradeDynamicDecision; onApplyRecommendation: (next: Partial<FutureTradeSettings>) => void; onRestoreManual: () => void }) {
  if (!dynamic) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Dynamic Idea Box</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">{dynamic.suggestion}</div>
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
          <div className="mb-2 text-xs font-medium text-primary">Active runtime values used by the bot</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Row label="Confidence" value={`${n(dynamic.recommended.minConfidence * 100, 2)}%`} />
            <Row label="Take profit" value={`${n(dynamic.recommended.takeProfitPercent, 3)}%`} />
            <Row label="Stop loss" value={`${n(dynamic.recommended.stopLossPercent, 3)}%`} />
            <Row label="Trailing" value={`${n(dynamic.recommended.trailingTakeProfitPercent, 3)}%`} />
            <Row label="Cooldown" value={`${n(dynamic.recommended.cooldownSeconds, 0)}s`} />
            <Row label="Trade size" value={`${n(dynamic.recommended.tradeAmountUsdt, 2)} USDT`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Row label="Mode" value={formatLabel(dynamic.mode, "dynamic")} />
          <Row label="Trend" value={`${n(dynamic.analysis.trendStrength * 100, 0)}%`} />
          <Row label="Direction" value={dynamic.analysis.direction} />
          <Row label="Agreement" value={`${n(dynamic.analysis.directionAgreement * 100, 0)}%`} />
          <Row label="Move" value={`${n(dynamic.analysis.priceChangePercent, 3)}%`} />
          <Row label="Volatility" value={`${n(dynamic.analysis.volatilityPercent, 3)}%`} />
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium">Direction breakdown</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Row label="Price bias" value={dynamic.analysis.priceDirection || "-"} />
            <Row label="Signal bias" value={dynamic.analysis.signalDirection || "-"} />
            <Row label="Direction source" value={humanizeCode(dynamic.analysis.directionSource || "-")} />
            <Row label="Usable scans" value={n(dynamic.analysis.usableSignalCount ?? 0, 0)} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => onApplyRecommendation({
              minConfidence: dynamic.recommended.minConfidence,
              takeProfitPercent: dynamic.recommended.takeProfitPercent,
              stopLossPercent: dynamic.recommended.stopLossPercent,
              trailingTakeProfitPercent: dynamic.recommended.trailingTakeProfitPercent,
              cooldownSeconds: dynamic.recommended.cooldownSeconds,
              tradeAmountUsdt: dynamic.recommended.tradeAmountUsdt,
            })}
          >
            Apply Runtime Recommendation
          </Button>
          <Button type="button" variant="outline" onClick={onRestoreManual}>
            Use My Values
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigPanel({ envMode, status, debug, intelligence, settings, setSettings, notes, setNotes, availableSymbols, onSave, busy }: { envMode: FutureTradeEnvConfig["mode"]; status?: { dailyLossLocked?: boolean; manualRestartAllowed?: boolean; activeMinConfidence?: number | null } | null; debug?: FutureTradeDashboard["signalDebug"] | null; intelligence?: FutureTradeDashboard["indicatorIntelligence"] | null; settings: FutureTradeSettings; setSettings: (settings: FutureTradeSettings) => void; notes: string; setNotes: (value: string) => void; availableSymbols: string[]; onSave: () => void; busy: boolean }) {
  const update = <K extends keyof FutureTradeSettings>(key: K, value: FutureTradeSettings[K]) => setSettings({ ...settings, [key]: value });
  const updateLeverage = (value: number) => setSettings({
    ...settings,
    leverage: value,
    maxLeverage: Math.max(Number(settings.maxLeverage ?? 1), value),
  });
  const isPrimeProfile = settings.signalProfile === "autofinx_prime_v6_1_7_crypto" && String(settings.marketProfile ?? "Crypto").toLowerCase() === "crypto";
  const selectedSymbols = normalizeList(settings.symbols, DEFAULT_SETTINGS.symbols);
  const recoveryMode = Boolean(status?.dailyLossLocked);
  const applyRecoveryPreset = () => setSettings({ ...settings, ...LOSS_LOCK_RECOVERY_PRESET });
  const applyStrictPreset = () => setSettings({ ...settings, ...STRICT_BTC_ETH_FULLY_DYNAMIC_PRESET });
  const applyEthPrimeSafePreset = () => setSettings({
    ...settings,
    symbols: ["ETHUSDT"],
    tradeAmountUsdt: 10,
    tradeScoreThreshold: 72,
    watchScoreThreshold: 58,
    stopLossPercent: 0.25,
    takeProfitPercent: 0.5,
    trailingTakeProfitPercent: 0.18,
    rollbackLossPercent: 0.15,
    maxTradesPerDay: 2,
    maxDailyLossPercent: 0.3,
    maxLeverage: 2,
    cooldownSeconds: 180,
    useAtrRiskTargets: false,
    useWebhookRiskOverrides: false,
    avoidChoppyMarket: true,
    strictEntryGuards: true,
    useChopFilter: true,
    useVolume: true,
    useMomentumBreakoutFilter: true,
    minBodyRatio: 0.6,
    cryptoRelVolMin: 1.05,
  });
  const applyClassicSimpleMode = () => setSettings({
    ...settings,
    classicSimpleMode: true,
    confidenceMode: "fixed",
    minConfidence: Math.min(Number(settings.minConfidence ?? 0.52), 0.5),
    dynamicMinConfidenceFloor: 0.45,
    dynamicMinConfidenceCeiling: 0.55,
    corePassRule: 2,
    avoidChoppyMarket: false,
  });
  const applyInfluencePreset = (preset: typeof INDICATOR_PRESETS[number]) => setSettings({
    ...settings,
    classicSimpleMode: false,
    corePassRule: preset.corePassRule,
    indicatorInfluence: { ...preset.indicatorInfluence },
    indicatorControls: Object.fromEntries(Object.entries(preset.indicatorInfluence).map(([key, weight]) => [
      key,
      {
        ...(settings.indicatorControls?.[key] ?? {}),
        key,
        label: intelligence?.controls.find((item) => item.key === key)?.label ?? key,
        note: intelligence?.controls.find((item) => item.key === key)?.note ?? "",
        category: intelligence?.controls.find((item) => item.key === key)?.category ?? "indicator",
        impact: intelligence?.controls.find((item) => item.key === key)?.impact ?? "positive",
        defaultWeight: displayInfluenceWeight(DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5),
        configurable: true,
        enabled: weight > 0,
        weight,
      },
    ])),
  });
  const updateInfluence = (key: string, value: number) => setSettings({
    ...settings,
    indicatorInfluence: {
      ...mergeInfluenceWeights(DEFAULT_SETTINGS.indicatorInfluence),
      ...(settings.indicatorInfluence ?? {}),
      [key]: Number(value.toFixed(2)),
    },
    indicatorControls: {
      ...(settings.indicatorControls ?? {}),
      [key]: {
        ...(settings.indicatorControls?.[key] ?? {}),
        key,
        label: intelligence?.controls.find((item) => item.key === key)?.label ?? key,
        note: intelligence?.controls.find((item) => item.key === key)?.note ?? "",
        category: intelligence?.controls.find((item) => item.key === key)?.category ?? "indicator",
        impact: intelligence?.controls.find((item) => item.key === key)?.impact ?? "positive",
        defaultWeight: displayInfluenceWeight(DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5),
        configurable: true,
        enabled: Number(value) > 0,
        weight: Number(value.toFixed(2)),
      },
    },
  });
  const toggleInfluence = (key: string, enabled: boolean) => setSettings({
    ...settings,
    indicatorInfluence: {
      ...mergeInfluenceWeights(DEFAULT_SETTINGS.indicatorInfluence),
      ...(settings.indicatorInfluence ?? {}),
      [key]: enabled
        ? Number(settings.indicatorControls?.[key]?.weight ?? settings.indicatorInfluence?.[key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5)
        : 0,
    },
    indicatorControls: {
      ...(settings.indicatorControls ?? {}),
      [key]: {
        ...(settings.indicatorControls?.[key] ?? {}),
        key,
        label: intelligence?.controls.find((item) => item.key === key)?.label ?? key,
        note: intelligence?.controls.find((item) => item.key === key)?.note ?? "",
        category: intelligence?.controls.find((item) => item.key === key)?.category ?? "indicator",
        impact: intelligence?.controls.find((item) => item.key === key)?.impact ?? "positive",
        defaultWeight: displayInfluenceWeight(DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5),
        configurable: true,
        enabled,
        weight: enabled
          ? Number(settings.indicatorControls?.[key]?.weight ?? settings.indicatorInfluence?.[key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5)
          : Number(settings.indicatorControls?.[key]?.weight ?? settings.indicatorInfluence?.[key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[key] ?? 5),
      },
    },
  });
  const resetInfluenceControls = () => setSettings({
    ...settings,
    indicatorInfluence: { ...(DEFAULT_SETTINGS.indicatorInfluence ?? {}) },
    indicatorControls: Object.fromEntries(Object.entries(DEFAULT_SETTINGS.indicatorInfluence ?? {}).map(([key, weight]) => [
      key,
      {
        ...(settings.indicatorControls?.[key] ?? {}),
        key,
        label: intelligence?.controls.find((item) => item.key === key)?.label ?? key,
        note: intelligence?.controls.find((item) => item.key === key)?.note ?? "",
        category: intelligence?.controls.find((item) => item.key === key)?.category ?? "indicator",
        impact: intelligence?.controls.find((item) => item.key === key)?.impact ?? "positive",
        defaultWeight: displayInfluenceWeight(weight),
        configurable: true,
        enabled: Number(weight) > 0,
        weight: Number(weight),
      },
    ])),
  });
  const simulatedCurrent = useMemo(() => simulateSignalConfidence(debug, settings), [debug, settings]);
  const presetComparisons = useMemo(() => INDICATOR_PRESETS.map((preset) => ({
    label: preset.label,
    ...simulateSignalConfidence(debug, preset),
  })), [debug]);
  const influenceControls = useMemo(() => {
    const backendControls = intelligence?.controls ?? [];
    if (backendControls.length) {
      const order = new Map(INDICATOR_INFLUENCE_CONTROLS.map((item, index) => [item.key, index]));
      return [...backendControls].sort((left, right) => (order.get(left.key) ?? 999) - (order.get(right.key) ?? 999));
    }
    return INDICATOR_INFLUENCE_CONTROLS.map((item) => ({
      key: item.key,
      label: item.label,
      note: item.note,
      impact: item.impact ?? "positive",
      category: "indicator",
      weight: Number(settings.indicatorInfluence?.[item.key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[item.key] ?? 5),
      enabled: controlEnabled(settings, item.key, Number(settings.indicatorInfluence?.[item.key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[item.key] ?? 5)),
      defaultWeight: Number(DEFAULT_SETTINGS.indicatorInfluence?.[item.key] ?? 5),
      configurable: true,
    }));
  }, [intelligence, settings]);

  const selectSymbol = (sym: string) => {
    setSettings({
      ...settings,
      symbols: [sym],
      validatedDefaultSymbols: [sym],
      validationSymbols: [sym],
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" /> Algorithm Config</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {recoveryMode ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium text-amber-700">Loss-lock recovery mode</div>
                <p className="text-xs leading-relaxed text-amber-800/90">
                  `DAILY_LOSS_LIMIT_HIT` locked this bot for the current trading day. Press `On` only after saving safer settings for a supervised retry.
                </p>
              </div>
              {status?.manualRestartAllowed ? (
                <Button type="button" variant="outline" size="sm" onClick={applyRecoveryPreset}>
                  Apply Safer Preset
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <Field label="Symbol - one active scanner at a time">
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {availableSymbols.map((sym) => {
              const active = selectedSymbols.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => selectSymbol(sym)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {String(sym).replace("USDT", "")}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Selected: {String(selectedSymbols[0] ?? "ETHUSDT").replace("USDT", "")}</p>
        </Field>
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          Execution mode is controlled from `My Config`.
          Current mode: <span className="font-medium text-foreground">{envMode === "live" ? "Live" : envMode === "testnet" ? "Testnet" : "Paper"}</span>.
        </div>
        {isPrimeProfile ? (
          <Card className="border-cyan-500/40 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="text-base">Prime v6.1.7 Pine Mirror</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <Row label="Active Signal Brain" value={(settings.signalSource ?? "webhook") === "binance" ? "AutoFinX Prime v11 Native Binance" : "AutoFinX Prime v6.1.7 Pine"} />
                <Row label="Prime Signal Source" value={(settings.signalSource ?? "webhook") === "binance" ? "Binance Native Brain" : (settings.signalSource ?? "webhook") === "mirror" ? "Backend Mirror Scanner" : (settings.signalSource === "webhook" || !settings.signalSource ? "TradingView Webhook" : "Webhook + Binance Fallback")} />
                <Row label="Backend Mirror" value={(settings.signalSource ?? "webhook") === "binance" ? "Native Signal + Execution Enabled" : (settings.signalSource ?? "webhook") === "mirror" ? "Signal + Execution Enabled" : (settings.signalSource === "webhook" || !settings.signalSource ? "Validation Only" : "Fallback Execution Enabled")} />
                <Row label="Secondary AI Weighting" value="Disabled" />
                <Row label="Legacy Weighted Scoring" value="Bypassed" />
                <Row label="Default timeframe" value="15m locked" />
              </div>
              <div className={cn("flex items-center justify-between rounded-md border p-3", (settings.signalSource ?? "webhook") !== "webhook" ? "border-amber-500/50 bg-amber-500/10" : "border-cyan-500/30 bg-cyan-500/5")}>
                <div>
                  <div className="text-sm font-medium">Binance Mirror Fallback</div>
                  <div className="text-xs text-muted-foreground">
                    {(settings.signalSource ?? "webhook") === "webhook"
                      ? "OFF: webhook-only mode; backend scanner stays read-only for diagnostics and CSV validation."
                      : (settings.signalSource === "binance"
                        ? "Binance ON: backend uses Binance futures data as source of truth and executes native Prime signals."
                      : (settings.signalSource === "mirror"
                        ? "Mirror ON: backend scanner uses Binance futures data and executes Prime signals."
                        : "Fallback ON: TradingView webhook is primary; Binance mirror executes only when webhook is stale."))}
                  </div>
                </div>
                <Switch
                  checked={(settings.signalSource ?? "webhook") !== "webhook"}
                  onCheckedChange={(value) => setSettings({
                    ...settings,
                    signalSource: value ? "webhook_fallback" : "webhook",
                    primeMirrorLiveEnabled: value,
                    primeMirrorExecutionEnabled: value,
                  })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Profile"><Input value={settings.signalProfileName || "AutoFinX Prime v6.1.7 Crypto Stable Default"} readOnly /></Field>
                <Field label="Timeframe"><Input value="15m" readOnly /></Field>
                <Field label="Trade direction">
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={settings.tradeDirection || "Both"} onChange={(e) => update("tradeDirection", e.target.value)}>
                    <option>Both</option>
                    <option>Long Only</option>
                    <option>Short Only</option>
                  </select>
                </Field>
                <Field label="Trade score threshold"><Input type="number" value={Number(settings.tradeScoreThreshold ?? 72)} onChange={(e) => update("tradeScoreThreshold", Number(e.target.value))} /></Field>
                <Field label="Watch score threshold"><Input type="number" value={Number(settings.watchScoreThreshold ?? 58)} onChange={(e) => update("watchScoreThreshold", Number(e.target.value))} /></Field>
                <Field label="HTF1 / HTF2"><Input value={`${settings.htf1 ?? "60"} / ${settings.htf2 ?? "240"}`} readOnly /></Field>
                <Field label="EMA fast / slow / trend / major"><Input value={`${settings.emaFast ?? 9} / ${settings.emaSlow ?? 21} / ${settings.emaTrend ?? 50} / ${settings.emaMajor ?? 200}`} readOnly /></Field>
                <Field label="Donchian length"><Input type="number" value={Number(settings.donchianLength ?? 20)} onChange={(e) => update("donchianLength", Number(e.target.value))} /></Field>
                <Field label="Crypto max choppiness"><Input type="number" step="0.1" value={Number(settings.cryptoChopMax ?? 61.8)} onChange={(e) => update("cryptoChopMax", Number(e.target.value))} /></Field>
                <Field label="Relative volume min"><Input type="number" step="0.01" value={Number(settings.cryptoRelVolMin ?? 1.0)} onChange={(e) => update("cryptoRelVolMin", Number(e.target.value))} /></Field>
                <Field label="Min candle body ratio"><Input type="number" step="0.01" value={Number(settings.minBodyRatio ?? 0.55)} onChange={(e) => update("minBodyRatio", Number(e.target.value))} /></Field>
                <Field label="ADX min"><Input type="number" value={Number(settings.adxMin ?? 20)} onChange={(e) => update("adxMin", Number(e.target.value))} /></Field>
                <Field label="ATR SL multiplier"><Input type="number" step="0.1" value={Number(settings.slAtrMultiplier ?? 1.4)} onChange={(e) => update("slAtrMultiplier", Number(e.target.value))} /></Field>
                <Field label="TP1 / TP2 RR"><Input value={`${settings.tp1RR ?? 1.0} / ${settings.tp2RR ?? 2.0}`} readOnly /></Field>
                <Field label="Trail ATR multiplier"><Input type="number" step="0.1" value={Number(settings.trailAtrMultiplier ?? 1.0)} onChange={(e) => update("trailAtrMultiplier", Number(e.target.value))} /></Field>
                <Field label="Cooldown bars"><Input type="number" value={Number(settings.cooldownBars ?? 3)} onChange={(e) => update("cooldownBars", Number(e.target.value))} /></Field>
                <Field label="Opposite exit score"><Input type="number" value={Number(settings.oppositeExitScore ?? 78)} onChange={(e) => update("oppositeExitScore", Number(e.target.value))} /></Field>
                <Field label="Webhook fallback timeout sec"><Input type="number" value={Number(settings.pineWebhookFallbackTimeoutSeconds ?? 1200)} onChange={(e) => update("pineWebhookFallbackTimeoutSeconds", Number(e.target.value))} /></Field>
              </div>
              <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Prime Risk & Execution</div>
                    <div className="text-xs text-muted-foreground">Use these for ETH-only live/testnet sizing and loss limits.</div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={applyEthPrimeSafePreset}>
                    Apply ETH Safe Preset
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Leverage"><Input type="number" min={1} max={125} step="1" value={Number(settings.leverage ?? 2)} onChange={(e) => updateLeverage(Number(e.target.value))} /></Field>
                  <Field label="Trade size USDT"><Input type="number" step="1" value={Number(settings.tradeAmountUsdt ?? 10)} onChange={(e) => update("tradeAmountUsdt", Number(e.target.value))} /></Field>
                  <Field label="Max leverage"><Input type="number" min={1} max={125} step="1" value={Number(settings.maxLeverage ?? 2)} onChange={(e) => update("maxLeverage", Math.max(Number(e.target.value), Number(settings.leverage ?? 1)))} /></Field>
                  <Field label="Stop loss %"><Input type="number" step="0.01" value={Number(settings.stopLossPercent ?? 0.75)} onChange={(e) => update("stopLossPercent", Number(e.target.value))} /></Field>
                  <Field label="Rollback loss %"><Input type="number" step="0.01" value={Number(settings.rollbackLossPercent ?? 0.6)} onChange={(e) => update("rollbackLossPercent", Number(e.target.value))} /></Field>
                  <Field label="Take profit %"><Input type="number" step="0.01" value={Number(settings.takeProfitPercent ?? 1.5)} onChange={(e) => update("takeProfitPercent", Number(e.target.value))} /></Field>
                  <Field label="Trailing %"><Input type="number" step="0.01" value={Number(settings.trailingTakeProfitPercent ?? 0.45)} onChange={(e) => update("trailingTakeProfitPercent", Number(e.target.value))} /></Field>
                  <Field label="Max trades/day"><Input type="number" step="1" value={Number(settings.maxTradesPerDay ?? 50)} onChange={(e) => update("maxTradesPerDay", Number(e.target.value))} /></Field>
                  <Field label="Daily loss limit %"><Input type="number" step="0.1" value={Number(settings.maxDailyLossPercent ?? 2.0)} onChange={(e) => update("maxDailyLossPercent", Number(e.target.value))} /></Field>
                  <Field label="Cooldown seconds"><Input type="number" step="30" value={Number(settings.cooldownSeconds ?? 180)} onChange={(e) => update("cooldownSeconds", Number(e.target.value))} /></Field>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="VWAP filter" checked={Boolean(settings.useVWAP ?? true)} onChange={(value) => update("useVWAP", value)} />
                <Toggle label="Relative volume filter" checked={Boolean(settings.useVolume ?? true)} onChange={(value) => update("useVolume", value)} />
                <Toggle label="ATR volatility filter" checked={Boolean(settings.useVolatilityFilter ?? true)} onChange={(value) => update("useVolatilityFilter", value)} />
                <Toggle label="Choppiness filter" checked={Boolean(settings.useChopFilter ?? true)} onChange={(value) => update("useChopFilter", value)} />
                <Toggle label="Momentum breakout filter" checked={Boolean(settings.useMomentumBreakoutFilter ?? false)} onChange={(value) => update("useMomentumBreakoutFilter", value)} />
                <Toggle label="ATR trailing second half" checked={Boolean(settings.useAtrTrailingSecondHalf ?? true)} onChange={(value) => update("useAtrTrailingSecondHalf", value)} />
                <Toggle label="Exit on opposite score" checked={Boolean(settings.exitOnStrongOppositeScore ?? true)} onChange={(value) => update("exitOnStrongOppositeScore", value)} />
                <Toggle label="ATR dynamic risk targets" checked={Boolean(settings.useAtrRiskTargets ?? false)} onChange={(value) => update("useAtrRiskTargets", value)} />
                <Toggle
                  label="Webhook risk overrides"
                  checked={Boolean(settings.useWebhookRiskOverrides ?? false)}
                  onChange={(value) => update("useWebhookRiskOverrides", value)}
                  note="ON: SL/TP/trailing/rollback come from the TradingView webhook payload when present. OFF (default): always uses the saved values above. Leverage is never overridden by this toggle."
                />
              </div>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Old MACD/RSI weighted scoring, symbol-performance penalty, aggressive AI modes, dynamic confidence overrides, UT Bot defaults, and indicator influence sliders are hidden and ignored for this profile.
              </div>
            </CardContent>
          </Card>
        ) : null}
        {!isPrimeProfile ? (
          <>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={applyStrictPreset}>
            Apply BTC+ETH Safe Preset
          </Button>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Stricter fully dynamic starter for BTC and ETH only.
          </div>
        </div>
        <Field label="Strategy mode" note="Quick switch between the full weighted engine, the lighter core-only filter, and classic graph-based live signals.">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" variant={resolveStrategyMode(settings) === "Full Indicator Intelligence" ? "default" : "outline"} onClick={() => applyInfluencePreset(INDICATOR_PRESETS[0])}>
              Full Indicator Intelligence
            </Button>
            <Button type="button" variant={resolveStrategyMode(settings) === "Core Only" ? "default" : "outline"} onClick={() => applyInfluencePreset(INDICATOR_PRESETS[1])}>
              Core Only
            </Button>
            <Button type="button" variant={settings.classicSimpleMode ? "default" : "outline"} onClick={applyClassicSimpleMode}>
              Classic Simple Live Signal
            </Button>
          </div>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Current strategy mode: <span className="font-medium text-foreground">{resolveStrategyMode(settings)}</span>
          </div>
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant={settings.classicSimpleMode ? "default" : "outline"} onClick={applyClassicSimpleMode}>
            Enable Indicators Off Mode
          </Button>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Classic simple mode ignores indicator influence, soft penalties, and dynamic inflation. Signals follow basic graph price action like the older simple flow.
          </div>
        </div>
        <div className={cn("flex items-center justify-between rounded-md p-3 border", settings.classicSimpleMode ? "border-cyan-500/40 bg-cyan-500/10" : "border-muted")}>
          <div>
            <div className="text-sm font-medium">Indicators Off / Classic Simple Mode</div>
            <div className="text-xs text-muted-foreground">
              {settings.classicSimpleMode
                ? "Active: scanner uses simple graph/price-action signals only."
                : "Off: scanner uses the full indicator + influence system."}
            </div>
          </div>
          <Switch checked={Boolean(settings.classicSimpleMode)} onCheckedChange={(v) => update("classicSimpleMode", v)} />
        </div>
        <div className={cn("flex items-center justify-between rounded-md border p-3", settings.strictEntryGuards ? "border-amber-500/40 bg-amber-500/10" : "border-muted")}>
          <div>
            <div className="text-sm font-medium">Strict Entry Guards</div>
            <div className="text-xs text-muted-foreground">
              {settings.strictEntryGuards
                ? "Active: UT + structure context + weak-setup guard can force WAIT."
                : "Default off: stronger trade preservation, fewer skips from indicator-only conflicts."}
            </div>
          </div>
          <Switch checked={Boolean(settings.strictEntryGuards)} onCheckedChange={(v) => update("strictEntryGuards", v)} />
        </div>
        <Field label="Confidence algorithm">
          <RadioGroup value={settings.confidenceMode || "fixed"} onValueChange={(value) => update("confidenceMode", value)}>
            <div className="grid gap-2">
              {[
                ["fixed", "Fixed", "Manual minConfidence only; strictest manual behavior."],
                ["semi_dynamic", "Semi dynamic", "Safe default. Small capped adjustments for quicker but still guarded entries."],
                ["fully_dynamic", "Fully dynamic", "More active adjustment of confidence, target, cooldown, and size."],
              ].map(([value, title, description]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                  <RadioGroupItem value={value} className="mt-1" />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </RadioGroup>
        </Field>
        <Field label="Core pass rule" note="How many core indicators must align before the setup can pass the core gate.">
          <RadioGroup value={String(settings.corePassRule ?? 3)} onValueChange={(value) => update("corePassRule", Number(value))}>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["2", "2 of 4", "Faster entries, lighter core filter."],
                ["3", "3 of 4", "Balanced default."],
                ["4", "4 of 4", "Strictest core confirmation."],
              ].map(([value, title, description]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                  <RadioGroupItem value={value} className="mt-1" />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </RadioGroup>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["leverage", "tradeAmountUsdt", "minConfidence", "dynamicLookbackMinutes", "dynamicMinConfidenceFloor", "dynamicMinConfidenceCeiling", "dynamicReentryBuffer", "takeProfitPercent", "stopLossPercent", "trailingTakeProfitPercent", "rollbackLossPercent", "maxDailyLossPercent", "maxTradesPerDay", "cooldownSeconds"] as const).map((key) => {
            const highlighted = recoveryMode && (LOSS_LOCK_RECOVERY_KEYS as readonly string[]).includes(key);
            const suggestedValue = LOSS_LOCK_RECOVERY_PRESET[key];

            return (
              <Field
                key={key}
                label={baseFieldLabel(key)}
                className={highlighted ? "rounded-md border border-amber-500/50 bg-amber-500/10 p-3" : undefined}
                note={highlighted && typeof suggestedValue === "number" ? `Safer value: ${suggestedValue}` : undefined}
              >
                <Input type="number" step="0.01" value={Number(settings[key])} onChange={(e) => update(key, Number(e.target.value) as never)} />
              </Field>
            );
          })}
        </div>
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Indicator Influence Controls</CardTitle>
            <div className="flex flex-wrap gap-2">
              {INDICATOR_PRESETS.map((preset) => (
                <Button key={preset.key} type="button" variant="outline" size="sm" onClick={() => applyInfluencePreset(preset)}>
                  {preset.label}
                </Button>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={resetInfluenceControls}>
                Reset Weights
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn("space-y-3", settings.classicSimpleMode && "opacity-60")}>
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              {settings.classicSimpleMode
                ? "Classic simple mode is active. These weights are ignored until you turn classic mode off."
                : "Weight scale: `0-10`. `5` = neutral/default. `0` = disable. `10` = strongest influence. Positive and penalty weights are separate where needed, so you can reduce blockers without weakening good signals."}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Power</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Use</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {influenceControls.map((item) => {
                    const current = displayInfluenceWeight(settings.indicatorInfluence?.[item.key] ?? item.weight ?? DEFAULT_SETTINGS.indicatorInfluence?.[item.key] ?? 5);
                    const enabled = controlEnabled(settings, item.key, current);
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">{item.impact ?? "positive"}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <Slider
                            min={0}
                            max={10}
                            step={1}
                            value={[current]}
                            disabled={Boolean(settings.classicSimpleMode) || !enabled}
                            onValueChange={([value]) => updateInfluence(item.key, value ?? 5)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{n(current, 0)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-2">
                            <span>{item.note}</span>
                            <Switch checked={enabled} disabled={Boolean(settings.classicSimpleMode)} onCheckedChange={(value) => toggleInfluence(item.key, value)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader><CardTitle className="text-base">Dry-Run Simulation</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">Current unsaved settings</div>
              <div className="mt-2 grid gap-2 text-xs">
                <Row label="Dry-run confidence" value={`${n(simulatedCurrent.finalConfidence * 100, 2)}%`} />
                <Row label="Current active minimum" value={`${n((Number(status?.activeMinConfidence ?? settings.minConfidence)) * 100, 2)}%`} />
                <Row label="Core pass" value={`${simulatedCurrent.corePassCount}/${simulatedCurrent.corePassRule} ${simulatedCurrent.corePassed ? "PASS" : "FAIL"}`} />
                <Row label="Live order placement" value="Disabled in dry-run" />
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">Preset comparison for current signal</div>
              <div className="mt-2 space-y-2 text-xs">
                {presetComparisons.map((preset) => (
                  <div key={preset.label} className="flex items-center justify-between rounded border px-2 py-1">
                    <span>{preset.label}</span>
                    <span className="font-mono">{n(preset.finalConfidence * 100, 2)}% | {preset.corePassCount}/{preset.corePassRule}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        ) : null}
        {/* Signal source: Mirror (backend) vs Webhook (TradingView). No conflicts:
            exactly ONE path is active at any moment. */}
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Signal Source</div>
              <div className="text-xs text-muted-foreground">
                Binance = native backend brain executes from Binance data. Mirror = Binance-backed scanner executes. Webhook = only TradingView Pine alerts execute.
                Fallback = webhook is primary, but Binance mirror executes when webhook is stale.
              </div>
            </div>
            <div className="flex shrink-0 gap-1 rounded-md border bg-muted/30 p-1">
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  (settings.signalSource ?? "webhook") === "binance"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setSettings({
                  ...settings,
                  signalSource: "binance",
                  primeMirrorLiveEnabled: true,
                  primeMirrorExecutionEnabled: true,
                  useLiveDataFeed: true,
                })}
              >
                Binance
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  (settings.signalSource ?? "webhook") === "mirror"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setSettings({
                  ...settings,
                  signalSource: "mirror",
                  primeMirrorLiveEnabled: true,
                  primeMirrorExecutionEnabled: true,
                })}
              >
                Mirror
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  (settings.signalSource ?? "webhook") === "webhook_fallback"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setSettings({
                  ...settings,
                  signalSource: "webhook_fallback",
                  primeMirrorLiveEnabled: true,
                  primeMirrorExecutionEnabled: true,
                })}
              >
                Fallback
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  settings.signalSource === "webhook"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setSettings({
                  ...settings,
                  signalSource: "webhook",
                  primeMirrorLiveEnabled: false,
                  primeMirrorExecutionEnabled: false,
                })}
              >
                Webhook
              </button>
            </div>
          </div>
          {settings.signalSource === "webhook" ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-200 space-y-1">
              <div>
                <span className="font-semibold">Webhook mode active.</span>{" "}
                TradingView Pine webhook signals will open/close live positions
                after risk and Binance safety checks pass. Backend scanner is
                read-only and will not independently open positions.
              </div>
              <div className="text-emerald-300/80">
                Send TradingView alerts to{" "}
                <span className="font-mono">POST /api/v1/future-trade/pine-webhook/{`{workspace}`}</span>{" "}
                with the Pine webhook token.
              </div>
            </div>
          ) : settings.signalSource === "webhook_fallback" ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              Fallback mode active. TradingView webhook is accepted when available; if no webhook arrives within
              <span className="font-mono"> {Number(settings.pineWebhookFallbackTimeoutSeconds ?? 1200)}s</span>,
              Binance futures mirror signals can execute.
            </div>
          ) : settings.signalSource === "binance" ? (
            <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-2 text-xs text-cyan-100">
              Binance native mode active. Backend uses Binance futures candles/ticks as the source of truth, runs the Prime brain server-side, and rejects TradingView webhooks to avoid double-entry conflicts.
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              Mirror mode active. Backend scanner generates and executes entries on its own.
              Incoming TradingView webhooks will be rejected with <span className="font-mono">webhook_disabled_in_mirror_mode</span>.
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Auto paper execute" checked={settings.autoExecutePaperSignals} onChange={(value) => update("autoExecutePaperSignals", value)} />
          <Toggle label="Avoid choppy market" checked={settings.avoidChoppyMarket} onChange={(value) => update("avoidChoppyMarket", value)} />
          <div className={cn("flex items-center justify-between rounded-md p-3 border", settings.useLiveDataFeed ? "border-green-500/40 bg-green-500/10" : "border-muted")}>
            <div>
              <div className="text-sm font-medium">Live Data Feed</div>
              <div className="text-xs text-muted-foreground">{settings.useLiveDataFeed ? "fapi.binance.com — real prices" : "Testnet data"}</div>
            </div>
            <Switch checked={settings.useLiveDataFeed} onCheckedChange={(v) => update("useLiveDataFeed", v)} />
          </div>
        </div>

        {/* Trading Hours */}
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Trading Hours (UTC)</div>
              <div className="text-xs text-muted-foreground">Only enter positions within this window. 24h = disable.</div>
            </div>
            <Switch
              checked={settings.tradingHoursEnabled}
              onCheckedChange={(v) => update("tradingHoursEnabled", v)}
            />
          </div>
          {settings.tradingHoursEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start (UTC)">
                <Input type="time" value={settings.tradingHoursStartUtc} onChange={(e) => update("tradingHoursStartUtc", e.target.value)} />
              </Field>
              <Field label="End (UTC)">
                <Input type="time" value={settings.tradingHoursEndUtc} onChange={(e) => update("tradingHoursEndUtc", e.target.value)} />
              </Field>
            </div>
          )}
          {settings.tradingHoursEnabled && (
            <div className="text-xs text-muted-foreground">
              Active window: {settings.tradingHoursStartUtc} → {settings.tradingHoursEndUtc} UTC
              {settings.tradingHoursStartUtc > settings.tradingHoursEndUtc ? " (overnight window)" : ""}
            </div>
          )}
        </div>

        <Field label="Algorithm Notes"><Textarea className="min-h-[120px] font-mono text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Slider changes are local only until you press `Save Algorithm` and confirm.
        </div>
        <Button className="w-full" disabled={busy} onClick={onSave}><Save className="mr-2 h-4 w-4" />Save Algorithm</Button>
      </CardContent>
    </Card>
  );
}

function MyConfigPanel({
  envSettings,
  setEnvSettings,
  liveSecret,
  setLiveSecret,
  testnetSecret,
  setTestnetSecret,
  onSave,
  onTestConnection,
  busy,
}: {
  envSettings: FutureTradeEnvConfig;
  setEnvSettings: (settings: FutureTradeEnvConfig) => void;
  liveSecret: string;
  setLiveSecret: (value: string) => void;
  testnetSecret: string;
  setTestnetSecret: (value: string) => void;
  onSave: () => void;
  onTestConnection: () => void;
  busy: boolean;
}) {
  const update = <K extends keyof FutureTradeEnvConfig>(key: K, value: FutureTradeEnvConfig[K]) => setEnvSettings({ ...envSettings, [key]: value });
  const setMode = (mode: FutureTradeEnvConfig["mode"]) => {
    setEnvSettings({
      ...envSettings,
      mode,
      testnet_enabled: mode === "testnet" ? true : envSettings.testnet_enabled,
      live_enabled: mode === "live" ? true : envSettings.live_enabled,
      force_testnet: mode !== "live",
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> My Config</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Execution mode">
          <RadioGroup value={envSettings.mode} onValueChange={(value) => setMode(value as FutureTradeEnvConfig["mode"])}>
            <div className="grid gap-2">
              {[
                ["paper", "Paper", "No Binance orders. Scanner and paper trades only."],
                ["testnet", "Testnet", "Uses Binance Futures testnet URL and testnet credentials."],
                ["live", "Live", "Uses real Binance Futures URL and live credentials."],
              ].map(([value, title, description]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
                  <RadioGroupItem value={value} className="mt-1" />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </RadioGroup>
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Testnet gate" checked={envSettings.testnet_enabled} onChange={(value) => update("testnet_enabled", value)} />
          <Toggle label="Live gate" checked={envSettings.live_enabled} onChange={(value) => update("live_enabled", value)} />
          <Toggle label="Force testnet" checked={envSettings.force_testnet} onChange={(value) => update("force_testnet", value)} />
        </div>

        <div className="grid gap-3">
          <Field label="Live futures URL"><Input value={envSettings.live_api_url} onChange={(e) => update("live_api_url", e.target.value)} /></Field>
          <Field label="Live futures API key"><Input value={envSettings.live_api_key} onChange={(e) => update("live_api_key", e.target.value)} /></Field>
          <Field label={`Live futures API secret${envSettings.live_api_secret_masked ? ` (${envSettings.live_api_secret_masked})` : ""}`}>
            <Input type="password" value={liveSecret} placeholder={envSettings.live_api_secret_masked ? "Leave blank to keep current secret" : "Enter live API secret"} onChange={(e) => setLiveSecret(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3">
          <Field label="Testnet futures URL"><Input value={envSettings.testnet_api_url} onChange={(e) => update("testnet_api_url", e.target.value)} /></Field>
          <Field label="Testnet futures API key"><Input value={envSettings.testnet_api_key} onChange={(e) => update("testnet_api_key", e.target.value)} /></Field>
          <Field label={`Testnet futures API secret${envSettings.testnet_api_secret_masked ? ` (${envSettings.testnet_api_secret_masked})` : ""}`}>
            <Input type="password" value={testnetSecret} placeholder={envSettings.testnet_api_secret_masked ? "Leave blank to keep current secret" : "Enter testnet API secret"} onChange={(e) => setTestnetSecret(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-2 text-xs">
          <Row label="Live credentials" value={envSettings.live_configured ? "Configured" : "Missing"} />
          <Row label="Testnet credentials" value={envSettings.testnet_configured ? "Configured" : "Missing"} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={busy} onClick={onTestConnection}>Test Connection</Button>
          <Button className="w-full" disabled={busy} onClick={onSave}><Save className="mr-2 h-4 w-4" />Save My Config</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LogFeed({ logs }: { logs: Array<{ id: string; event: string; symbol?: string | null; signal?: string | null; reason?: string | null; occurred_at: string }> }) {
  return (
    <Card><CardHeader><CardTitle>Decision Feed</CardTitle></CardHeader><CardContent className="space-y-2">{logs.slice(0, 10).map((log) => <div key={log.id} className="rounded-md border px-3 py-2 text-sm"><div className="flex items-center justify-between gap-3"><div><Badge variant={statusVariant(log.event)}>{log.event}</Badge><span className="ml-2 text-muted-foreground">{log.symbol} {log.signal}</span></div><span className="text-[11px] text-muted-foreground">{new Date(log.occurred_at).toLocaleTimeString()}</span></div><div className="mt-1 text-xs text-muted-foreground">{log.reason}</div></div>)}</CardContent></Card>
  );
}

function IndicatorIntelligencePanel({ intelligence }: { intelligence?: FutureTradeDashboard["indicatorIntelligence"] | null }) {
  if (!intelligence) return null;

  const current = intelligence.currentBreakdown ?? [];
  const performance = intelligence.performance ?? [];
  const suggestions = intelligence.suggestions ?? [];
  const validation = intelligence.validation;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4" />Indicator Intelligence</CardTitle>
        <Badge variant="outline">{formatLabel(intelligence.profile, "indicator profile")}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {validation ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="text-muted-foreground">Readiness</div>
              <div className="mt-1 text-xl font-semibold">{validation.overallReadinessScore}/100</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="text-muted-foreground">Graph Mode</div>
              <div className="mt-1 font-semibold">{validation.normalGraphModeWorks ? "OK" : "Check"}</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="text-muted-foreground">Live Signal Flow</div>
              <div className="mt-1 font-semibold">{validation.liveSignalFlowDetected ? "Detected" : "No signal yet"}</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="text-muted-foreground">Indicators Off</div>
              <div className="mt-1 font-semibold">{validation.classicSimpleMode ? "Active" : "Available"}</div>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Current influence</div>
            <div className="mt-3 space-y-2 text-xs">
              {current.slice(0, 8).map((item) => (
                <div key={`${item.controlKey ?? item.key}-${item.label}`} className="flex items-center justify-between gap-3 rounded border px-2 py-1">
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground">{item.enabled ? `On • W${item.configuredWeight ?? 0}` : "Off"} • {item.category ?? "indicator"}</div>
                  </div>
                  <span className={cn("font-mono", Number(item.finalContribution ?? 0) >= 0 ? "text-running" : "text-destructive")}>
                    {Number(item.finalContribution ?? 0) >= 0 ? "+" : ""}{n(item.finalContribution ?? 0, 4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Accuracy snapshot</div>
            <div className="mt-3 space-y-2 text-xs">
              {performance.slice(0, 6).map((item) => (
                <div key={item.key} className="rounded border px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.sampleState}</Badge>
                      <Badge variant={item.rating === "A" ? "default" : item.rating === "B" ? "secondary" : item.rating === "C" ? "outline" : "destructive"}>{item.rating ?? "-"}</Badge>
                    </div>
                  </div>
                  <div className="mt-1 grid gap-1 text-muted-foreground">
                    <span>Samples {item.samples} • W{item.weight} • Avg {n(item.avgContribution, 4)} • Score {item.successScore ?? 0}</span>
                    <span>Success {item.successRate != null ? `${n(item.successRate * 100, 0)}%` : "-"} • Points {n(item.successPoints ?? 0, 1)}</span>
                    <span>Support win {item.supportiveWinRate != null ? `${n(item.supportiveWinRate * 100, 0)}%` : "-" } • Block accuracy {item.blockingAccuracy != null ? `${n(item.blockingAccuracy * 100, 0)}%` : "-"}</span>
                    <span>Tracker align {item.trackerAlignmentRate != null ? `${n(item.trackerAlignmentRate * 100, 0)}%` : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Strategy suggestions</div>
            <div className="mt-3 space-y-2 text-xs">
              {suggestions.slice(0, 6).map((item) => (
                <div key={`${item.key}-${item.action}`} className="rounded border px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.action}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{item.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-medium">Hard safety blockers</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {intelligence.hardBlockers.map((item) => (
              <Badge key={item.key} variant="destructive">{item.label}</Badge>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            These are always read-only guards. Indicator controls can change confidence scoring only; they cannot bypass execution safety.
          </div>
          {intelligence.integrationReadiness?.note ? (
            <div className="mt-2 text-xs text-muted-foreground">{intelligence.integrationReadiness.note}</div>
          ) : null}
          {validation?.blockers?.length ? (
            <div className="mt-2 text-xs text-destructive">{validation.blockers.join(" | ")}</div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">No active indicator-system blocker detected in the current validation snapshot.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResearchLabPanel({ researchLab }: { researchLab?: FutureTradeResearchLab | null }) {
  if (!researchLab) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" />Research Lab</CardTitle>
        <Badge variant="outline">{researchLab.scripts.length} scripts · {researchLab.datasets.length} datasets</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Imported scripts</div>
            <div className="mt-3 space-y-2 text-xs">
              {researchLab.scripts.length ? researchLab.scripts.slice(0, 6).map((script) => (
                <div key={script.id} className="rounded border px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{script.name}</span>
                    <Badge variant="outline">{script.scriptType}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {script.source} {script.version ? `v${script.version}` : ""} · {script.lineCount} lines
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {script.detectedIndicators.slice(0, 6).map((item) => <Badge key={`${script.id}-${item}`} variant="secondary">{item}</Badge>)}
                  </div>
                </div>
              )) : <div className="text-muted-foreground">No external scripts imported yet.</div>}
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Imported trade stats</div>
            <div className="mt-3 space-y-2 text-xs">
              {researchLab.importedIndicatorStats.length ? researchLab.importedIndicatorStats.slice(0, 8).map((item) => (
                <div key={item.key} className="rounded border px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.key.toUpperCase()}</span>
                    <span className="font-mono">{item.winRate != null ? `${n(item.winRate * 100, 0)}%` : "-"}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">Samples {item.samples} · Wins {item.wins} · Losses {item.losses} · Avg PnL {n(item.avgPnl, 4)}</div>
                </div>
              )) : <div className="text-muted-foreground">No imported trade dataset analysis yet.</div>}
            </div>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Training-style suggestions</div>
            <div className="mt-3 space-y-2 text-xs">
              {researchLab.trainingSuggestions.length ? researchLab.trainingSuggestions.map((item) => (
                <div key={`${item.key}-${item.action}`} className="rounded border px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline">{item.action}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{item.reason}</div>
                </div>
              )) : <div className="text-muted-foreground">Import more scripts or trade datasets to generate optimizer guidance.</div>}
            </div>
          </div>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Overlay hints on the graph are extracted from imported scripts. This is parser-based metadata mapping, not full Pine execution yet. Imported data is used for analysis and suggestions only, not for bypassing live safety guards.
        </div>
      </CardContent>
    </Card>
  );
}

function MissedTradeAuditPanel({ audit }: { audit?: FutureTradeDashboard["missedTradeAudit"] | null }) {
  if (!audit) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Missed Trade Audit</CardTitle>
        <Badge variant="outline">{audit.totalSkippedSignals} skipped · {audit.reviewedSignals} reviewed</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Missed wins</div><div className="mt-1 text-xl font-semibold">{audit.missedWins}</div></div>
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Correct skips</div><div className="mt-1 text-xl font-semibold">{audit.correctSkips}</div></div>
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Avoided losses</div><div className="mt-1 text-xl font-semibold">{audit.avoidedLosses}</div></div>
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Neutral</div><div className="mt-1 text-xl font-semibold">{audit.neutral}</div></div>
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Pending review</div><div className="mt-1 text-xl font-semibold">{audit.pendingReview}</div></div>
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="text-muted-foreground">Missed win rate</div><div className="mt-1 text-xl font-semibold">{audit.missedWinRate != null ? `${n(audit.missedWinRate * 100, 0)}%` : "-"}</div></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-4 text-sm font-medium">Mode comparison</div>
            <div className="mb-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Would trade</TableHead>
                    <TableHead className="text-right">Captured wins</TableHead>
                    <TableHead className="text-right">Bad signals</TableHead>
                    <TableHead className="text-right">Correct skips</TableHead>
                    <TableHead className="text-right">Net PnL</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.modeComparison.length ? audit.modeComparison.map((item) => (
                    <TableRow key={item.mode}>
                      <TableCell className="font-medium">{formatLabel(item.mode, "mode")}</TableCell>
                      <TableCell className="text-right">{item.wouldTrade}</TableCell>
                      <TableCell className="text-right">{item.capturedMissedWins}</TableCell>
                      <TableCell className="text-right">{item.allowedBadSignals}</TableCell>
                      <TableCell className="text-right">{item.correctSkips}</TableCell>
                      <TableCell className="text-right">{n(item.netWouldHavePnlPercent, 2)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.recommendation}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No mode comparison data yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm font-medium">Top blockers causing skips</div>
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blocker</TableHead>
                    <TableHead className="text-right">Skips</TableHead>
                    <TableHead className="text-right">Missed wins</TableHead>
                    <TableHead className="text-right">Protected</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.topBlockers.length ? audit.topBlockers.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.totalSkips}</TableCell>
                      <TableCell className="text-right">{item.missedWins}</TableCell>
                      <TableCell className="text-right">{item.correctSkips + item.avoidedLosses}</TableCell>
                      <TableCell className="text-right">{n(item.accuracy * 100, 0)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.factor} · W{item.currentWeight}→{item.recommendedWeight} · {item.recommendation}
                        <div>{item.reason}</div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No missed-trade blocker analytics yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">Recent skipped signals</div>
            <div className="mt-3 space-y-2 text-xs">
              {audit.recent.length ? audit.recent.map((item) => (
                <div key={item.id} className="rounded border px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.symbol} {item.side}</span>
                    <Badge variant={item.wouldHaveResult === "MISSED_WIN" ? "destructive" : item.wouldHaveResult === "AVOIDED_LOSS" || item.wouldHaveResult === "CORRECT_SKIP" ? "secondary" : "outline"}>
                      {item.wouldHaveResult ?? item.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Conf {n(item.finalConfidence * 100, 1)}% / Min {n(item.activeMinimum * 100, 1)}% · Gap {n(item.confidenceGap * 100, 1)}%
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {item.topSkipReason ?? "Skipped"} · {item.topBlockers.slice(0, 3).join(" | ")}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Window {item.reviewWindowMinutes}m · First hit {item.firstHit ?? "-"} · Gross {item.grossWouldHavePnlPercent != null ? `${n(item.grossWouldHavePnlPercent, 2)}%` : "-"} · Net {item.netWouldHavePnlPercent != null ? `${n(item.netWouldHavePnlPercent, 2)}%` : "-"}
                  </div>
                  {item.modeComparison ? (
                    <div className="mt-1 text-muted-foreground">
                      {Object.entries(item.modeComparison).map(([mode, row]) => `${formatLabel(mode, "mode")}: ${row.decision} @ ${n(row.confidence * 100, 1)}%`).join(" · ")}
                    </div>
                  ) : null}
                </div>
              )) : <div className="text-muted-foreground">No skipped-signal audit records yet.</div>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TuningPlanPanel({
  tuningPlan,
  versions,
  onGenerate,
  busy,
}: {
  tuningPlan: FutureTradeTuningPlanPreview | null;
  versions: NonNullable<FutureTradeConfig["config_versions"]>;
  onGenerate: () => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" />Tuning Plan Preview</CardTitle>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onGenerate}>
          {busy ? "Generating..." : "Generate Tuning Plan"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {tuningPlan ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="text-muted-foreground">Current</div>
                <div className="mt-1 font-semibold">{formatLabel(tuningPlan.current.mode, "current")}</div>
                <div className="text-xs text-muted-foreground">Min {n(tuningPlan.current.minConfidence * 100, 1)}% · {tuningPlan.current.confidenceMode}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="text-muted-foreground">Recommended</div>
                <div className="mt-1 font-semibold">{formatLabel(tuningPlan.recommended.mode, "recommended")}</div>
                <div className="text-xs text-muted-foreground">Min {n(tuningPlan.recommended.minConfidence * 100, 1)}% · {tuningPlan.recommended.confidenceMode}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="text-muted-foreground">Forward validation</div>
                <div className="mt-1 font-semibold">{tuningPlan.forwardValidation.reviewedSamples} samples</div>
                <div className="text-xs text-muted-foreground">{tuningPlan.forwardValidation.recommendation}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border px-3 py-2 text-sm">Captured missed wins Δ: <span className="font-semibold">{tuningPlan.previewImpact.capturedMissedWinsDelta >= 0 ? "+" : ""}{tuningPlan.previewImpact.capturedMissedWinsDelta}</span></div>
              <div className="rounded-md border px-3 py-2 text-sm">Allowed bad signals Δ: <span className="font-semibold">{tuningPlan.previewImpact.allowedBadSignalsDelta >= 0 ? "+" : ""}{tuningPlan.previewImpact.allowedBadSignalsDelta}</span></div>
              <div className="rounded-md border px-3 py-2 text-sm">Net PnL Δ: <span className="font-semibold">{tuningPlan.previewImpact.netWouldHavePnlDelta >= 0 ? "+" : ""}{n(tuningPlan.previewImpact.netWouldHavePnlDelta, 2)}%</span></div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-sm font-medium">Recommended weight changes</div>
              <div className="mt-3 space-y-2 text-xs">
                {tuningPlan.recommended.weightChanges.length ? tuningPlan.recommended.weightChanges.map((item) => (
                  <div key={item.factor} className="rounded border px-2 py-2">
                    <div className="font-medium">{item.factor} · W{item.currentWeight}→{item.recommendedWeight}</div>
                    <div className="mt-1 text-muted-foreground">{item.reason}</div>
                  </div>
                )) : <div className="text-muted-foreground">No immediate weight changes recommended.</div>}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            Generate a tuning plan to preview recommended mode, threshold, confidence mode, and weight changes using missed-trade audit evidence. Preview only; nothing is auto-applied.
          </div>
        )}

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-medium">Config versions</div>
          <div className="mt-3 space-y-2 text-xs">
            {versions.length ? versions.map((item) => (
              <div key={item.id} className="rounded border px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">V{item.versionNumber} · {item.label ?? item.source}</span>
                  <Badge variant="outline">{item.source}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</div>
              </div>
            )) : <div className="text-muted-foreground">No saved config versions yet.</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TRACKER_PAGE_SIZE = 5;
const TRADE_HISTORY_PAGE_SIZE = 5;
const TRACKER_EVENTS = new Set([
  "BUY_EXECUTED",
  "SELL_EXECUTED",
  "LIVE_BUY_EXECUTED",
  "LIVE_SELL_EXECUTED",
  "TAKE_PROFIT_HIT",
  "STOP_LOSS_HIT",
  "TRAILING_PROFIT_HIT",
  "LOSS_ROLLBACK_TRIGGERED",
  "LIVE_TAKE_PROFIT_HIT",
  "LIVE_STOP_LOSS_HIT",
  "LIVE_TRAILING_PROFIT_HIT",
  "LIVE_LOSS_ROLLBACK_TRIGGERED",
  "SCAN_STATUS",
  "PINE_WEBHOOK_WAIT",
  "PINE_WEBHOOK_SIGNAL",
  "PINE_WEBHOOK_CLOSE",
  "MARKET_SNAPSHOT_FAILED",
  "TRADE_BLOCKED",
  "SIGNAL_SKIPPED",
  "EMERGENCY_STOP",
  "LIVE_GUARD_BLOCKED",
]);

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function flattenTradeForExport(trade: FutureTradeRecord) {
  const dynamic = trade.meta?.dynamic;
  const signal = trade.meta?.signal;

  return {
    id: trade.id,
    created_at: trade.created_at,
    symbol: trade.symbol,
    side: trade.side,
    entry_price: trade.entry_price ?? "",
    exit_price: trade.exit_price ?? "",
    quantity: trade.quantity ?? "",
    leverage: trade.leverage ?? "",
    net_pnl: trade.net_pnl ?? "",
    reason: trade.reason ?? "",
    mode: trade.mode,
    status: trade.status,
    signal_profile: trade.meta?.signal_profile ?? "",
    signal_profile_name: trade.meta?.signal_profile_name ?? "",
    market_profile: trade.meta?.market_profile ?? "",
    runtime_timeframe: trade.meta?.timeframe ?? signal?.timeframe ?? "",
    algorithm_flag: algorithmFlag(dynamic?.mode || trade.meta?.algorithm_mode),
    algorithm_mode: trade.meta?.algorithm_mode ?? "",
    dynamic_mode: dynamic?.mode ?? "",
    dynamic_base_min_confidence: dynamic?.baseMinConfidence ?? "",
    dynamic_effective_min_confidence: dynamic?.effectiveMinConfidence ?? "",
    dynamic_recommended_min_confidence: dynamic?.recommended?.minConfidence ?? "",
    dynamic_take_profit_percent: dynamic?.recommended?.takeProfitPercent ?? "",
    dynamic_stop_loss_percent: dynamic?.recommended?.stopLossPercent ?? "",
    dynamic_trailing_take_profit_percent: dynamic?.recommended?.trailingTakeProfitPercent ?? "",
    dynamic_cooldown_seconds: dynamic?.recommended?.cooldownSeconds ?? "",
    dynamic_trade_amount_usdt: dynamic?.recommended?.tradeAmountUsdt ?? "",
    signal_symbol: signal?.symbol ?? "",
    signal_signal: signal?.signal ?? "",
    signal_price: signal?.price ?? "",
    signal_change_percent: signal?.changePercent ?? "",
    signal_volume: signal?.volume ?? "",
    signal_range_percent: signal?.rangePercent ?? "",
    signal_confidence: signal?.confidence ?? "",
    signal_effective_min_confidence: signal?.effectiveMinConfidence ?? "",
    signal_dynamic_mode: signal?.dynamicMode ?? "",
    signal_timeframe: signal?.timeframe ?? "",
    signal_reason: signal?.reason ?? "",
    meta_json: trade.meta ? JSON.stringify(trade.meta) : "",
  };
}

function flattenTrackerRowForExport(log: FutureTradeLog) {
  const hardBlockers = normalizeList(log.context?.hardBlockers, log.context?.hardBlocker);
  const softPenalties = normalizeList(log.context?.softPenalties);
  const positiveFactors = normalizeList(log.context?.positiveFactors);
  const negativeFactors = normalizeList(log.context?.negativeFactors);

  return {
    id: log.id,
    occurred_at: log.occurred_at,
    event: log.event,
    status: trackerStatusLabel(log),
    symbol: log.symbol ?? "",
    signal: log.signal ?? "",
    price: log.price ?? "",
    confidence: log.confidence ?? "",
    reason: log.reason ?? "",
    side: log.context?.side ?? "",
    mode: log.context?.mode ?? "",
    entry_price: log.context?.entryPrice ?? "",
    exit_price: log.context?.exitPrice ?? "",
    quantity: log.context?.quantity ?? "",
    net_pnl: log.context?.netPnl ?? "",
    algorithm_mode: log.context?.algorithmMode ?? "",
    algorithm_flag: log.context?.algorithmFlag ?? "NORMAL",
    effective_min_confidence: log.context?.effectiveMinConfidence ?? "",
    active_confidence_min: log.context?.activeConfidenceMin ?? log.context?.effectiveMinConfidence ?? "",
    active_take_profit_percent: log.context?.activeTakeProfitPercent ?? "",
    active_stop_loss_percent: log.context?.activeStopLossPercent ?? "",
    active_trailing_take_profit_percent: log.context?.activeTrailingTakeProfitPercent ?? "",
    active_cooldown_seconds: log.context?.activeCooldownSeconds ?? "",
    active_trade_amount_usdt: log.context?.activeTradeAmountUsdt ?? "",
    trend_strength: log.context?.trendStrength ?? "",
    direction_agreement: log.context?.directionAgreement ?? "",
    vwap_aligned: booleanExportValue(log.context?.vwapAligned),
    ema_aligned: booleanExportValue(log.context?.emaAligned),
    adx_value: log.context?.adxValue ?? "",
    macd_direction: booleanExportValue(log.context?.macdDirection),
    rsi_value: log.context?.rsiValue ?? "",
    volume_aligned: booleanExportValue(log.context?.volumeAligned),
    volume_ratio: log.context?.volumeRatio ?? "",
    htf_aligned: booleanExportValue(log.context?.htfAligned),
    soft_penalty_count: log.context?.softPenaltyCount ?? softPenalties.length,
    soft_penalties: softPenalties.join(" | "),
    decision_reason: log.context?.decisionReason ?? "",
    hard_blocker: log.context?.hardBlocker ?? "",
    hard_blockers: hardBlockers.join(" | "),
    positive_factors: positiveFactors.join(" | "),
    negative_factors: negativeFactors.join(" | "),
    component_scores_json: log.context?.componentScores ? JSON.stringify(log.context.componentScores) : "",
    component_breakdown_json: log.context?.componentBreakdown ? JSON.stringify(log.context.componentBreakdown) : "",
    choppy: log.context?.choppy == null ? "" : log.context.choppy ? "true" : "false",
    context_json: log.context ? JSON.stringify(log.context) : "",
  };
}

function booleanExportValue(value: boolean | null | undefined) {
  if (value == null) return "";
  return value ? "true" : "false";
}

function boolBadge(value: boolean | null | undefined) {
  if (value == null) return "-";
  return value ? "Yes" : "No";
}

function normalizeList(value: unknown, fallback?: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return [value];
  }
  if (typeof fallback === "string" && fallback.trim() !== "") {
    return [fallback];
  }
  if (Array.isArray(fallback)) {
    return fallback.map((item) => String(item)).filter(Boolean);
  }
  return [] as string[];
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExcelWorkbookXml(sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>) {
  const worksheetXml = sheets.map(({ name, rows }) => {
    const columns = Array.from(rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()));
    const headerRow = `<Row>${columns.map((column) => `<Cell><Data ss:Type="String">${xmlEscape(column)}</Data></Cell>`).join("")}</Row>`;
    const dataRows = rows.map((row) => {
      const cells = columns.map((column) => {
        const value = row[column];
        const numeric = toNumber(value);
        if (typeof value === "boolean") {
          return `<Cell><Data ss:Type="String">${value ? "true" : "false"}</Data></Cell>`;
        }
        if (numeric !== null && String(value ?? "").trim() !== "") {
          return `<Cell><Data ss:Type="Number">${numeric}</Data></Cell>`;
        }
        return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
      }).join("");
      return `<Row>${cells}</Row>`;
    }).join("");

    return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
  }).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  ${worksheetXml}
</Workbook>`;
}

function downloadExcelWorkbook(filename: string, sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>) {
  const xml = buildExcelWorkbookXml(sheets);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function DynamicRuntimeTracker({ logs }: { logs: FutureTradeLog[] }) {
  const rows = useMemo(() => logs.filter((log) => TRACKER_EVENTS.has(log.event)), [logs]);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<FutureTradeLog | null>(null);
  const totalPages = Math.max(1, Math.ceil(rows.length / TRACKER_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * TRACKER_PAGE_SIZE;
    return rows.slice(start, start + TRACKER_PAGE_SIZE);
  }, [page, rows]);

  return (
    <Card>
      <CardHeader><CardTitle>Dynamic Runtime Tracker</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Conf</TableHead>
              <TableHead>Active Min</TableHead>
              <TableHead>TP</TableHead>
              <TableHead>SL</TableHead>
              <TableHead>Trail</TableHead>
              <TableHead>Cooldown</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Choppy</TableHead>
              <TableHead>VWAP</TableHead>
              <TableHead>EMA</TableHead>
              <TableHead>ADX</TableHead>
              <TableHead>MACD</TableHead>
              <TableHead>RSI</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>HTF</TableHead>
              <TableHead>Soft</TableHead>
              <TableHead>Blocker</TableHead>
              <TableHead>More</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={24} className="text-center text-sm text-muted-foreground">No runtime status changes yet.</TableCell>
              </TableRow>
            ) : paginatedRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{new Date(row.occurred_at).toLocaleTimeString()}</TableCell>
                <TableCell><Badge variant={algorithmVariant(row.context?.algorithmFlag)}>{row.context?.algorithmFlag || "NORMAL"}</Badge></TableCell>
                <TableCell>{trackerStatusLabel(row)}</TableCell>
                <TableCell>{row.symbol || "-"}</TableCell>
                <TableCell>{row.signal || "-"}</TableCell>
                <TableCell>{n(Number(row.confidence ?? 0) * 100, 2)}%</TableCell>
                <TableCell>{row.context?.effectiveMinConfidence != null ? `${n(row.context.effectiveMinConfidence * 100, 2)}%` : "-"}</TableCell>
                <TableCell>{row.context?.activeTakeProfitPercent != null ? `${n(row.context.activeTakeProfitPercent, 3)}%` : "-"}</TableCell>
                <TableCell>{row.context?.activeStopLossPercent != null ? `${n(row.context.activeStopLossPercent, 3)}%` : "-"}</TableCell>
                <TableCell>{row.context?.activeTrailingTakeProfitPercent != null ? `${n(row.context.activeTrailingTakeProfitPercent, 3)}%` : "-"}</TableCell>
                <TableCell>{row.context?.activeCooldownSeconds != null ? `${n(row.context.activeCooldownSeconds, 0)}s` : "-"}</TableCell>
                <TableCell>{row.context?.activeTradeAmountUsdt != null ? n(row.context.activeTradeAmountUsdt, 2) : "-"}</TableCell>
                <TableCell>{row.context?.trendStrength != null ? `${n(row.context.trendStrength * 100, 0)}%` : "-"}</TableCell>
                <TableCell>{row.context?.choppy == null ? "-" : row.context.choppy ? "Yes" : "No"}</TableCell>
                <TableCell>{boolBadge(row.context?.vwapAligned)}</TableCell>
                <TableCell>{boolBadge(row.context?.emaAligned)}</TableCell>
                <TableCell>{row.context?.adxValue != null ? n(row.context.adxValue, 2) : "-"}</TableCell>
                <TableCell>{boolBadge(row.context?.macdDirection)}</TableCell>
                <TableCell>{row.context?.rsiValue != null ? n(row.context.rsiValue, 2) : "-"}</TableCell>
                <TableCell>{row.context?.volumeRatio != null ? `${boolBadge(row.context?.volumeAligned)} (${n(row.context.volumeRatio, 2)})` : boolBadge(row.context?.volumeAligned)}</TableCell>
                <TableCell>{boolBadge(row.context?.htfAligned)}</TableCell>
                <TableCell>{row.context?.softPenaltyCount ?? normalizeList(row.context?.softPenalties).length}</TableCell>
                <TableCell>{trackerHardBlocker(row)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelectedRow(row)}>More</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Showing {paginatedRows.length === 0 ? 0 : (page - 1) * TRACKER_PAGE_SIZE + 1}-{(page - 1) * TRACKER_PAGE_SIZE + paginatedRows.length} of {rows.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Prev</Button>
            <span className="text-muted-foreground">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      </CardContent>
      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Runtime Tracker Detail</DialogTitle>
          </DialogHeader>
          {selectedRow ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Time" value={new Date(selectedRow.occurred_at).toLocaleString()} />
                <Row label="Event" value={selectedRow.event} />
                <Row label="Status" value={trackerStatusLabel(selectedRow)} />
                <Row label="Signal" value={selectedRow.signal || "-"} />
                <Row label="Confidence" value={`${n(Number(selectedRow.confidence ?? 0) * 100, 2)}%`} />
                <Row label="Active Min" value={selectedRow.context?.activeConfidenceMin != null ? `${n(selectedRow.context.activeConfidenceMin * 100, 2)}%` : "-"} />
                <Row label="VWAP aligned" value={boolBadge(selectedRow.context?.vwapAligned)} />
                <Row label="EMA aligned" value={boolBadge(selectedRow.context?.emaAligned)} />
                <Row label="ADX value" value={selectedRow.context?.adxValue != null ? n(selectedRow.context.adxValue, 2) : "-"} />
                <Row label="MACD direction" value={boolBadge(selectedRow.context?.macdDirection)} />
                <Row label="RSI" value={selectedRow.context?.rsiValue != null ? n(selectedRow.context.rsiValue, 2) : "-"} />
                <Row label="Volume" value={selectedRow.context?.volumeRatio != null ? `${boolBadge(selectedRow.context?.volumeAligned)} (${n(selectedRow.context.volumeRatio, 2)})` : boolBadge(selectedRow.context?.volumeAligned)} />
                <Row label="HTF" value={boolBadge(selectedRow.context?.htfAligned)} />
                <Row label="Soft penalty count" value={String(selectedRow.context?.softPenaltyCount ?? normalizeList(selectedRow.context?.softPenalties).length)} />
                <Row label="Decision note" value={trackerDecisionNote(selectedRow)} />
                <Row label="Blocker" value={trackerHardBlocker(selectedRow)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Soft penalties</div>
                  <div className="text-muted-foreground">{normalizeList(selectedRow.context?.softPenalties).join(" | ") || "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Blockers</div>
                  <div className="text-muted-foreground">{normalizeList(selectedRow.context?.hardBlockers, selectedRow.context?.hardBlocker).join(" | ") || "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Positive factors</div>
                  <div className="text-muted-foreground">{normalizeList(selectedRow.context?.positiveFactors).join(" | ") || "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Negative factors</div>
                  <div className="text-muted-foreground">{normalizeList(selectedRow.context?.negativeFactors).join(" | ") || "-"}</div>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 font-medium">Component scores</div>
                <pre className="overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(selectedRow.context?.componentScores ?? {}, null, 2)}</pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TradeHistory({
  trades,
  liveTrading,
  closeBusy,
  onClose,
}: {
  trades: FutureTradeRecord[];
  liveTrading: boolean;
  closeBusy: boolean;
  onClose: (trade: FutureTradeRecord) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(trades.length / TRADE_HISTORY_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [trades.length, liveTrading]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedTrades = useMemo(() => {
    const start = (page - 1) * TRADE_HISTORY_PAGE_SIZE;
    return trades.slice(start, start + TRADE_HISTORY_PAGE_SIZE);
  }, [page, trades]);

  return (
    <Card>
      <CardHeader><CardTitle>{liveTrading ? "Live Futures Trades" : "Paper Futures Trades"}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Exit</TableHead>
              <TableHead>Net PnL</TableHead>
              <TableHead>Active Min</TableHead>
              <TableHead>TP</TableHead>
              <TableHead>SL</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-sm text-muted-foreground">No trades yet.</TableCell>
              </TableRow>
            ) : paginatedTrades.map((trade) => {
              const dynamic = trade.meta?.dynamic;
              const flag = algorithmFlag(dynamic?.mode || trade.meta?.algorithm_mode);
              const isOpenEntry = ["OPEN", "SUBMITTED"].includes(String(trade.status ?? "").toUpperCase())
                && !String(trade.side ?? "").toUpperCase().includes("CLOSE");
              return (
                <TableRow key={trade.id}>
                  <TableCell>{new Date(trade.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell><Badge variant={algorithmVariant(flag)}>{flag}</Badge></TableCell>
                  <TableCell>{trade.symbol}</TableCell>
                  <TableCell>{trade.side}</TableCell>
                  <TableCell>{n(trade.entry_price, 8)}</TableCell>
                  <TableCell>{n(trade.exit_price, 8)}</TableCell>
                  <TableCell>{n(trade.net_pnl, 6)}</TableCell>
                  <TableCell>{dynamic ? `${n(dynamic.effectiveMinConfidence * 100, 2)}%` : "-"}</TableCell>
                  <TableCell>{dynamic ? `${n(dynamic.recommended.takeProfitPercent, 3)}%` : "-"}</TableCell>
                  <TableCell>{dynamic ? `${n(dynamic.recommended.stopLossPercent, 3)}%` : "-"}</TableCell>
                  <TableCell>{trade.reason}</TableCell>
                  <TableCell>{trade.status}</TableCell>
                  <TableCell>
                    {isOpenEntry ? (
                      <Button size="sm" variant="destructive" disabled={closeBusy} onClick={() => onClose(trade)}>
                        Close Now
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Showing {paginatedTrades.length === 0 ? 0 : (page - 1) * TRADE_HISTORY_PAGE_SIZE + 1}-{(page - 1) * TRADE_HISTORY_PAGE_SIZE + paginatedTrades.length} of {trades.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Prev</Button>
            <span className="text-muted-foreground">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function algorithmFlag(mode?: string | null) {
  if (mode === "pine_mirror") return "PINE";
  if (mode === "fully_dynamic") return "AUTO";
  if (mode === "semi_dynamic") return "SEMI";
  return "NORMAL";
}

function algorithmVariant(flag?: string | null) {
  if (flag === "PINE") return "default";
  if (flag === "AUTO") return "default";
  if (flag === "SEMI") return "secondary";
  return "outline";
}

function trackerStatusLabel(log: FutureTradeLog) {
  const status = log.context?.status || log.event;
  return String(status)
    .replace(/^LIVE_/, "")
    .replace(/_EXECUTED$/, "_OPEN")
    .replace(/_/g, " ")
    .trim();
}

function trackerHardBlocker(log: FutureTradeLog) {
  const blockers = normalizeList(log.context?.hardBlockers, log.context?.hardBlocker);
  return blockers.join(" | ") || "-";
}

function trackerDecisionNote(log: FutureTradeLog) {
  return String(log.context?.decisionReason || log.reason || "-");
}

function humanizeCode(value?: string | null) {
  if (!value) return "-";
  return String(value).replace(/_/g, " ").trim();
}

function formatLabel(value: unknown, fallback = "-") {
  const text = String(value ?? fallback).trim();
  return (text || fallback).replace(/_/g, " ");
}

function Field({ label, children, className, note }: { label: string; children: ReactNode; className?: string; note?: string }) {
  return <div className={cn("space-y-2", className)}><Label className="text-xs text-muted-foreground">{label}</Label>{children}{note ? <div className="text-[11px] text-amber-700">{note}</div> : null}</div>;
}

function baseFieldLabel(key: keyof FutureTradeSettings) {
  const labels: Partial<Record<keyof FutureTradeSettings, string>> = {
    tradeAmountUsdt: "Base tradeAmountUsdt",
    minConfidence: "Base minConfidence",
    takeProfitPercent: "Base takeProfitPercent",
    stopLossPercent: "Base stopLossPercent",
    trailingTakeProfitPercent: "Base trailingTakeProfitPercent",
    cooldownSeconds: "Base cooldownSeconds",
    dynamicLookbackMinutes: "Dynamic lookback minutes",
    dynamicMinConfidenceFloor: "Dynamic confidence floor",
    dynamicMinConfidenceCeiling: "Dynamic confidence ceiling",
    dynamicReentryBuffer: "Dynamic re-entry buffer",
  };

  return labels[key] ?? key;
}

function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (value: boolean) => void; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2" title={note}>
      <div className="flex flex-col">
        <span className="text-sm">{label}</span>
        {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

type SafetyRuntimeHealth = {
  feedFresh?: boolean;
  feedAgeSeconds?: number | null;
  feedMode?: string | null;
  lastTickAt?: string | null;
  lastTickPrice?: number | null;
  openLogicalTrades?: number | null;
  reconciliationRequired?: number | null;
  cooldownUntil?: string | null;
  dailyLossLocked?: boolean;
  liveMode?: boolean;
  userStream?: {
    configured?: boolean;
    status?: string;
    fresh?: boolean;
    ageSeconds?: number | null;
    lastEventAt?: string | null;
    lastKeepAliveAt?: string | null;
  } | null;
  activeBlockers?: string[];
  healthy?: boolean;
} | null | undefined;

type SafetySignalStability = {
  raw?: string;
  confirmed?: string;
  executable?: string;
  reason?: string;
  confirmedScans?: number;
  sameCandleFlip?: boolean;
} | null | undefined;

type SafetyRealized = {
  closedCount?: number;
  botProfit?: number;
  botLoss?: number;
  totalProfit?: number;
  openPositions?: number;
  reconciliationRequired?: number;
} | null | undefined;

function SafetyRuntimePanel({
  runtimeHealth,
  signalStability,
  realized,
  accountAsset,
}: {
  runtimeHealth: SafetyRuntimeHealth;
  signalStability: SafetySignalStability;
  realized: SafetyRealized;
  accountAsset: string;
}) {
  if (!runtimeHealth && !signalStability && !realized) return null;

  const blockers = runtimeHealth?.activeBlockers ?? [];
  const healthy = Boolean(runtimeHealth?.healthy);
  const sameCandleFlip = Boolean(signalStability?.sameCandleFlip);
  const executable = signalStability?.executable ?? "WAIT";
  const confirmed = signalStability?.confirmed ?? "WAIT";
  const raw = signalStability?.raw ?? "WAIT";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Safety &amp; Signal Stability</CardTitle>
        <Badge variant={healthy ? "default" : "destructive"}>{healthy ? "Healthy" : "Blocked"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Runtime health</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>Feed: <span className={runtimeHealth?.feedFresh ? "text-emerald-400" : "text-amber-400"}>{runtimeHealth?.feedFresh ? "fresh" : "stale"}</span> ({runtimeHealth?.feedAgeSeconds ?? "-"}s ago)</div>
              {runtimeHealth?.liveMode ? (
                <div>
                  User stream:{" "}
                  <span className={runtimeHealth?.userStream?.fresh ? "text-emerald-400" : "text-rose-400"}>
                    {runtimeHealth?.userStream?.status ?? "DISCONNECTED"}
                  </span>
                  {" "}({runtimeHealth?.userStream?.ageSeconds ?? "-"}s ago)
                </div>
              ) : (
                <div>User stream: <span className="text-muted-foreground">paper mode</span></div>
              )}
              <div>Open logical trades: <span className="font-mono">{runtimeHealth?.openLogicalTrades ?? 0}</span></div>
              <div>Reconciliation required: <span className="font-mono">{runtimeHealth?.reconciliationRequired ?? 0}</span></div>
              <div>Cooldown until: <span className="font-mono">{runtimeHealth?.cooldownUntil ?? "-"}</span></div>
              <div>Daily loss locked: <span className="font-mono">{runtimeHealth?.dailyLossLocked ? "yes" : "no"}</span></div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signal stability</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>Raw scanner: <span className="font-mono">{raw}</span></div>
              <div>Confirmed: <span className="font-mono">{confirmed}</span></div>
              <div>Executable: <span className={executable === "WAIT" ? "font-mono text-amber-400" : "font-mono text-emerald-400"}>{executable}</span></div>
              <div>Confirmation scans: <span className="font-mono">{signalStability?.confirmedScans ?? 0}</span></div>
              <div>Reason: <span className="font-mono">{signalStability?.reason ?? "-"}</span></div>
              {sameCandleFlip ? <div className="text-amber-400">Same-candle flip detected — WAIT.</div> : null}
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Realized PnL (closed trades only)</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>Total: <span className="font-mono">{Number(realized?.totalProfit ?? 0).toFixed(4)} {accountAsset}</span></div>
              <div>Profit: <span className="font-mono text-emerald-400">{Number(realized?.botProfit ?? 0).toFixed(4)}</span></div>
              <div>Loss: <span className="font-mono text-rose-400">{Number(realized?.botLoss ?? 0).toFixed(4)}</span></div>
              <div>Closed: <span className="font-mono">{realized?.closedCount ?? 0}</span></div>
              <div>Open: <span className="font-mono">{realized?.openPositions ?? 0}</span></div>
            </div>
          </div>
        </div>
        {blockers.length > 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="mb-1 font-medium uppercase tracking-wide">Active blockers</div>
            <div className="flex flex-wrap gap-1">
              {blockers.map((b) => (
                <span key={b} className="rounded bg-amber-500/20 px-2 py-0.5 font-mono">{b}</span>
              ))}
            </div>
            <div className="mt-2 text-[11px] opacity-80">Live execution stays paused while any blocker is active. Raw signal shown for reference only.</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Webhook Command Center — the one panel that answers
 *   "can this Pine webhook open a trade right now, and if not, why?"
 *
 * Three side-by-side cards (Signal Source, Binance State, Execution
 * Eligibility) + a Last TradingView Webhook Payload preview + warnings /
 * blockers that are clearly separated. Reads only from existing backend
 * endpoints — does not initiate trades or recovery.
 */
function WebhookCommandCenter({
  settings,
  diagnostics,
  binanceHealth,
  runtimeHealth,
  lastWebhook,
  runtimeHealthFromDashboard,
}: {
  settings: FutureTradeSettings;
  diagnostics?: FutureTradeDiagnostics;
  binanceHealth?: FutureTradeBinanceHealth;
  runtimeHealth?: FutureTradeRuntimeHealth;
  lastWebhook?: FutureTradeLastWebhook;
  runtimeHealthFromDashboard?: FutureTradeDashboard["runtimeHealth"];
}) {
  // Show the panel whenever webhook is the active signal source — even
  // before any data has loaded — so operators see the surface immediately.
  if (settings.signalSource !== "webhook" && settings.signalSource !== "webhook_fallback") {
    return null;
  }

  const eligibility = diagnostics?.tradeEligibility ?? null;
  const decision = (eligibility?.decision ?? "waiting").toLowerCase();
  const isEligible = decision === "eligible";
  const isBlocked = decision === "blocked";

  const rawBlockers = (eligibility?.blockers ?? []) as string[];
  const rawWarnings = (eligibility?.warnings ?? []) as string[];

  // §18 — only real blockers go in the destructive bucket. AI-disabled and
  // external-context-disabled are NOT blockers in webhook mode — TradingView
  // is the brain, so those internal AI features are expected to be off.
  const softCodes = new Set([
    "ai_trading_disabled",
    "external_context_disabled",
    "backend_scanner_read_only_webhook_mode",
    "user_stream_not_configured_rest_fallback_active",
    "user_stream_stale_rest_fallback_active",
  ]);
  const blockers = rawBlockers.filter((code) => !softCodes.has(code));
  const warnings = [
    ...rawWarnings,
    ...rawBlockers.filter((code) => softCodes.has(code)),
  ];

  // §17 — Binance state card values
  const userStream = runtimeHealthFromDashboard?.userStream;
  const userStreamFresh = Boolean(userStream?.fresh);
  const userStreamConfigured = Boolean(userStream && userStream.status && userStream.status !== "NOT_CONFIGURED");
  const restFresh = Boolean(binanceHealth?.fresh);
  const restAge = binanceHealth?.cached_balance_age_seconds ?? null;
  const restOk = Boolean(binanceHealth?.rest_ok);
  const dnsOk = Boolean(binanceHealth?.dns_ok);

  const mirrorFallback = settings.signalSource === "webhook_fallback";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Webhook Command Center</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">
            TradingView Pine webhook = signal source. Backend scanner read-only. Binance = execution + safety state.
          </div>
        </div>
        <Badge variant={isEligible ? "default" : isBlocked ? "destructive" : "secondary"}>
          {isEligible ? "Eligible" : isBlocked ? "Blocked" : "Waiting"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* §17 Three cards: Signal Source / Binance State / Execution Eligibility */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Signal Source */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signal Source</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>Active source: <span className="font-mono text-foreground">TradingView Webhook</span></div>
              <div>Webhook live: <span className={settings.signalSource ? "text-emerald-400" : "text-rose-400"}>ON</span></div>
              <div>Backend scanner: <span className="text-emerald-400">Read-only</span></div>
              <div>
                Mirror fallback:{" "}
                <span className={mirrorFallback ? "text-amber-400" : "text-emerald-400"}>
                  {mirrorFallback ? "ON (risky)" : "OFF"}
                </span>
              </div>
              <div>Live executor: <span className="font-mono text-foreground">Pine Webhook Only</span></div>
            </div>
          </div>

          {/* Binance State */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Binance State</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>
                Wallet:{" "}
                <span className={restFresh ? "text-emerald-400" : "text-amber-400"}>
                  {restFresh ? "Fresh" : "Stale"}
                </span>
                {" "}({restAge != null ? `${restAge}s ago` : "no sync yet"})
              </div>
              <div>
                Position:{" "}
                <span className={restFresh ? "text-emerald-400" : "text-amber-400"}>
                  {restFresh ? "Fresh" : "Stale"}
                </span>
              </div>
              <div>
                User Stream:{" "}
                {userStreamConfigured ? (
                  <span className={userStreamFresh ? "text-emerald-400" : "text-amber-400"}>
                    {userStreamFresh ? "Connected" : "REST fallback"}
                  </span>
                ) : (
                  <span className="text-amber-400">REST fallback</span>
                )}
              </div>
              <div>
                REST health:{" "}
                <span className={restOk && dnsOk ? "text-emerald-400" : "text-rose-400"}>
                  {restOk && dnsOk ? "OK" : "Degraded"}
                </span>
              </div>
              <div>
                Last sync:{" "}
                <span className="font-mono">
                  {binanceHealth?.last_success_at
                    ? new Date(binanceHealth.last_success_at).toLocaleTimeString()
                    : "-"}
                </span>
              </div>
              {binanceHealth?.failure_reason ? (
                <div className="text-rose-400">Failure: <span className="font-mono">{humanizeCode(binanceHealth.failure_reason)}</span></div>
              ) : null}
            </div>
          </div>

          {/* Execution Eligibility */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Execution Eligibility</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>
                Decision:{" "}
                <Badge variant={isEligible ? "outline" : isBlocked ? "destructive" : "secondary"} className="ml-1">
                  {humanizeCode(decision)}
                </Badge>
              </div>
              <div>Source: <span className="font-mono text-foreground">{humanizeCode(eligibility?.signalSource ?? "pine_webhook")}</span></div>
              <div>Signal: <span className="font-mono text-foreground">{eligibility?.latestWebhookSignal ?? eligibility?.bestSignal ?? "-"}</span></div>
              <div>
                Confidence:{" "}
                <span className="font-mono text-foreground">
                  {n((eligibility?.bestConfidence ?? 0) * 100, 1)}%
                </span>{" "}
                / min{" "}
                <span className="font-mono">
                  {n((eligibility?.activeMinimum ?? 0) * 100, 1)}%
                </span>
              </div>
              <div>
                Executable:{" "}
                <span className={isEligible ? "text-emerald-400" : "text-amber-400"}>
                  {isEligible ? "yes" : "no"}
                </span>
              </div>
              {!isEligible && eligibility?.summary ? (
                <div className="text-muted-foreground italic">{eligibility.summary}</div>
              ) : null}
              {eligibility?.nextAction ? (
                <div className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                  Next: {eligibility.nextAction}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* §11.B Last TradingView Webhook Payload */}
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Last TradingView Webhook Payload</div>
            {lastWebhook?.received ? (
              <Badge variant={lastWebhook.tokenValid && lastWebhook.parsedJsonValid ? "outline" : "destructive"}>
                {lastWebhook.tokenValid && lastWebhook.parsedJsonValid ? "Valid" : "Issue"}
              </Badge>
            ) : (
              <Badge variant="secondary">No payload yet</Badge>
            )}
          </div>
          {!lastWebhook?.received ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {lastWebhook?.summary ?? "No TradingView webhook payload has reached this workspace yet."}
            </div>
          ) : (
            <>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <div>Received: <span className="font-mono text-foreground">{lastWebhook.ageSeconds != null ? `${lastWebhook.ageSeconds}s ago` : "-"}</span></div>
                <div>Symbol: <span className="font-mono text-foreground">{lastWebhook.symbol ?? "-"}</span></div>
                <div>Signal: <span className="font-mono text-foreground">{lastWebhook.signal ?? "-"}</span></div>
                <div>Confidence: <span className="font-mono text-foreground">{n((lastWebhook.confidence ?? 0) * 100, 1)}%</span></div>
                <div>Timeframe: <span className="font-mono text-foreground">{lastWebhook.timeframe ?? "-"}</span></div>
                <div>Bar confirmed: <span className="font-mono text-foreground">{lastWebhook.barConfirmed == null ? "-" : lastWebhook.barConfirmed ? "yes" : "no"}</span></div>
                <div>Token valid: <span className={lastWebhook.tokenValid ? "text-emerald-400" : "text-rose-400"}>{lastWebhook.tokenValid ? "yes" : "no"}</span></div>
                <div>JSON valid: <span className={lastWebhook.parsedJsonValid ? "text-emerald-400" : "text-rose-400"}>{lastWebhook.parsedJsonValid ? "yes" : "no"}</span></div>
                <div>Executable: <span className={lastWebhook.executable ? "text-emerald-400" : "text-amber-400"}>{lastWebhook.executable ? "yes" : "no"}</span></div>
                <div>Duplicate: <span className={lastWebhook.duplicate ? "text-amber-400" : "text-emerald-400"}>{lastWebhook.duplicate ? "yes" : "no"}</span></div>
                <div>Decision event: <span className="font-mono text-foreground">{lastWebhook.decisionEvent ?? "-"}</span></div>
                <div>Remote IP: <span className="font-mono text-foreground">{lastWebhook.remoteIp ?? "-"}</span></div>
              </div>
              {lastWebhook.rejectedReason ? (
                <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs">
                  <span className="font-medium text-rose-300">Rejected reason: </span>
                  <span className="font-mono">{humanizeCode(lastWebhook.rejectedReason)}</span>
                </div>
              ) : null}
              {lastWebhook.rawBodyPreview ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Raw body preview</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px] font-mono">{lastWebhook.rawBodyPreview}</pre>
                </details>
              ) : null}
            </>
          )}
        </div>

        {/* §18 Warnings (amber, non-blocking) and Blockers (red) clearly split */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-300 mb-1">Warnings (non-blocking)</div>
            {warnings.length === 0 ? (
              <div className="text-xs text-muted-foreground">No active warnings.</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {warnings.map((code) => (
                  <li key={`w-${code}`}>
                    <span className="font-mono text-amber-200">{humanizeCode(code)}</span>
                    {code === "ai_trading_disabled" || code === "external_context_disabled" ? (
                      <span className="text-muted-foreground ml-2">— OK for TradingView webhook mode</span>
                    ) : null}
                    {code === "backend_scanner_read_only_webhook_mode" ? (
                      <span className="text-muted-foreground ml-2">— intentional: webhook is the brain</span>
                    ) : null}
                    {(code === "user_stream_not_configured_rest_fallback_active"
                      || code === "user_stream_stale_rest_fallback_active") ? (
                      <span className="text-muted-foreground ml-2">— REST polling fallback active</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="text-xs uppercase tracking-wide text-destructive mb-1">Blockers (live execution paused)</div>
            {blockers.length === 0 ? (
              <div className="text-xs text-muted-foreground">No active blockers. Webhook trades can execute.</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {blockers.map((code) => (
                  <li key={`b-${code}`}>
                    <span className="font-mono text-rose-300">{humanizeCode(code)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {runtimeHealth?.duplicate_workers_detected ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
            Duplicate queue workers detected. Consider running Recover Runtime to clean up.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SignalDebugPanel({
  status,
  debug,
  settings,
}: {
  status?: {
    currentPrice?: number | null;
    currentSignal?: string | null;
    confidence?: number | null;
    activeMinConfidence?: number | null;
    signalConfidenceGap?: number | null;
    lastScanAt?: string | null;
    liveStatus?: {
      mode: string;
      indicatorMode: string;
      dataSource?: string | null;
      lastUpdateTime?: string | null;
      lastCandleTime?: string | null;
      higherTimeframeLastCandleTime?: string | null;
      ageSeconds?: number | null;
      isStale?: boolean;
    } | null;
  } | null;
  debug?: {
    decision?: string;
    decisionStatus?: string;
    signalSide?: string;
    finalConfidence?: number;
    positiveFactors?: string[];
    negativeFactors?: string[];
    componentScores?: Record<string, number>;
    voteSummary?: Record<string, number | string>;
    checks?: {
      corePassRule?: number;
      buyCoreChecks?: Record<string, boolean>;
      sellCoreChecks?: Record<string, boolean>;
    };
    componentBreakdown?: Record<string, { label: string; rawScore: number; influenceLevel: number; finalContribution: number; impact: string }>;
  } | null;
  settings: FutureTradeSettings;
}) {
  if (!status && !debug) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <details className="group rounded-md border bg-muted/20 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            <span>Confidence breakdown and blockers</span>
            <span className="text-xs text-muted-foreground group-open:hidden">Tap to expand</span>
          </summary>
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <Row label="Decision" value={String(debug?.decision ?? status?.currentSignal ?? "WAIT")} />
              <Row label="Decision status" value={String(debug?.decisionStatus ?? "-")} />
              <Row label="Signal side" value={String(debug?.signalSide ?? "-")} />
              <Row label="Last price" value={n(Number(status?.currentPrice ?? 0), 6)} />
              <Row label="Confidence" value={`${n((Number(debug?.finalConfidence ?? status?.confidence ?? 0)) * 100, 2)}%`} />
              <Row label="Active minimum" value={`${n((Number(status?.activeMinConfidence ?? 0)) * 100, 2)}%`} />
              <Row label="Gap" value={`${n((Number(status?.signalConfidenceGap ?? 0)) * 100, 2)}%`} />
              <Row label="Last scan" value={status?.lastScanAt ? new Date(status.lastScanAt).toLocaleTimeString() : "-"} />
              <Row label="Strategy mode" value={resolveStrategyMode(settings)} />
              <Row label="Live mode" value={String(status?.liveStatus?.mode ?? "-")} />
              <Row label="Indicator mode" value={String(status?.liveStatus?.indicatorMode ?? "-")} />
              <Row label="Data source" value={String(status?.liveStatus?.dataSource ?? "-")} />
              <Row label="Stale" value={status?.liveStatus?.isStale ? `Yes (${status?.liveStatus?.ageSeconds ?? 0}s)` : "No"} />
              <Row label="5m candle time" value={status?.liveStatus?.lastCandleTime ? new Date(status.liveStatus.lastCandleTime).toLocaleTimeString() : "-"} />
              <Row label="1h candle time" value={status?.liveStatus?.higherTimeframeLastCandleTime ? new Date(status.liveStatus.higherTimeframeLastCandleTime).toLocaleTimeString() : "-"} />
            </div>

            {liveFeedWarning(status?.liveStatus?.mode) ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {liveFeedWarning(status?.liveStatus?.mode)}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">Positive factors</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(debug?.positiveFactors ?? []).length ? (debug?.positiveFactors ?? []).map((item) => (
                    <div key={item} className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">{item}</div>
                  )) : <div>-</div>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">Blockers</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(debug?.negativeFactors ?? []).length ? (debug?.negativeFactors ?? []).map((item) => (
                    <div key={item} className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1">{item}</div>
                  )) : <div>-</div>}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">Component scores</div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                {Object.entries(debug?.componentScores ?? {}).map(([key, value]) => (
                  <Row key={key} label={humanizeCode(key)} value={`${n(Number(value) * 100, 2)}%`} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-400">Confidence breakdown</div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factor</TableHead>
                      <TableHead>Impact</TableHead>
                      <TableHead>Raw</TableHead>
                      <TableHead>Influence</TableHead>
                      <TableHead>Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(debug?.componentBreakdown ?? {}).length ? Object.entries(debug?.componentBreakdown ?? {}).map(([key, item]) => (
                      <TableRow key={key}>
                        <TableCell>{item.label ?? humanizeCode(key)}</TableCell>
                        <TableCell className="uppercase text-muted-foreground">{item.impact}</TableCell>
                        <TableCell>{n(Number(item.rawScore ?? 0) * 100, 2)}%</TableCell>
                        <TableCell>{n(item.influenceLevel ?? 1, 2)}x</TableCell>
                        <TableCell className={cn(Number(item.finalContribution ?? 0) < 0 ? "text-rose-400" : "text-emerald-400")}>
                          {n(Number(item.finalContribution ?? 0) * 100, 2)}%
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">No component breakdown yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <Row
                label="Core pass"
                value={`${Object.values(debug?.checks?.[debug?.signalSide === "SELL" ? "sellCoreChecks" : "buyCoreChecks"] ?? {}).filter(Boolean).length}/${Number(debug?.checks?.corePassRule ?? 3)} required`}
              />
              <Row label="Signal side" value={String(debug?.signalSide ?? "-")} />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function LiveFeedDaemonCard({
  liveFeed,
  busy,
  onStart,
  onStop,
  onRestart,
  onRecoverRuntime,
}: {
  liveFeed?: FutureTradeLiveFeedStatus;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onRecoverRuntime: () => void;
}) {
  const running = Boolean(liveFeed?.running);
  const fresh = Boolean(liveFeed?.isFresh);
  const startSupported = liveFeed?.startSupported !== false;
  const manualRequired = Boolean(liveFeed?.manualRequired) || !startSupported;
  const displayCommand = liveFeed?.manualCommand || liveFeed?.command;
  const runtimeScheduled = Boolean(liveFeed?.runtimeScheduled);
  const staleOrStopped = !fresh || !running || !runtimeScheduled || Boolean(liveFeed?.restartRecommended);
  const badgeVariant = manualRequired ? "destructive" : running && fresh ? "default" : running ? "secondary" : "outline";
  const modeLabel = manualRequired ? "MANUAL REQUIRED" : (liveFeed?.mode ?? "UNKNOWN");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Future Trade Live Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Feed mode</div>
            <div className="text-xs text-muted-foreground">
              {manualRequired
                ? "Server shell_exec is disabled, so this panel cannot start or stop the daemon. Start it from cPanel cron or terminal."
                : (liveFeed?.message ?? "Loading daemon status...")}
            </div>
          </div>
          <Badge variant={badgeVariant}>{modeLabel}</Badge>
        </div>

        <div className="grid gap-2 text-xs">
          <Row label="Source" value={String(liveFeed?.dataSource ?? "-")} />
          <Row label="PID" value={liveFeed?.pid ? String(liveFeed.pid) : "-"} />
          <Row label="Started" value={liveFeed?.startedAt ? new Date(liveFeed.startedAt).toLocaleString() : "-"} />
          <Row label="Last feed tick" value={liveFeed?.lastTickAt ? new Date(liveFeed.lastTickAt).toLocaleTimeString() : "-"} />
          <Row label="Feed freshness" value={liveFeed?.ageSeconds != null ? `${liveFeed.ageSeconds}s` : "-"} />
          <Row label="Symbol sync" value={liveFeed?.symbolSetInSync ? "In sync" : "Restart recommended"} />
          <Row label="Runtime scheduler" value={runtimeScheduled ? "Enabled" : "Manual cron required"} />
          <Row label="Symbols" value={liveFeed?.desiredSymbols?.join(", ") || "-"} />
        </div>

        {displayCommand ? (
          <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">{manualRequired ? "Manual daemon command" : "Daemon command"}</div>
            <div className="mt-1 break-all font-mono">{displayCommand}</div>
          </div>
        ) : null}

        {!runtimeScheduled ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">Required scanner cron</div>
            <div className="mt-1 break-all font-mono">{liveFeed?.schedulerCommand || liveFeed?.tickCommand || "-"}</div>
            <div className="mt-2">Without this minute cron, the page can refresh but confidence, runtime rows, and trade execution will not keep moving.</div>
          </div>
        ) : null}

        {staleOrStopped ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">Runtime recovery available</div>
            <div className="mt-1">
              Use Recover Runtime when graph, realtime price, signal scanner, or runtime rows stop updating. It restarts the live-feed daemon when supported and runs one immediate scanner tick.
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Button disabled={busy || running || !startSupported} onClick={onStart}>
            <Power className="mr-2 h-4 w-4" />
            Start
          </Button>
          <Button disabled={busy || (!running && !staleOrStopped) || !startSupported} variant="outline" onClick={onRestart}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart
          </Button>
          <Button disabled={busy} variant={staleOrStopped ? "default" : "outline"} onClick={onRecoverRuntime}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recover Runtime
          </Button>
          <Button disabled={busy || !running || !startSupported} variant="secondary" onClick={onStop}>
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          {manualRequired
            ? "Best mode: keep the manual daemon or cPanel cron running for shared websocket ticks and kline cache. If it is offline, Future Trade falls back to REST polling."
            : "Best mode: keep this daemon running for shared websocket ticks and kline cache. If it is offline, Future Trade falls back to REST polling."}
        </div>
      </CardContent>
    </Card>
  );
}
