import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Bot, Brain, Download, FileSpreadsheet, Lightbulb, Power, RefreshCw, Save, ShieldAlert, Square, Trash2, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout";
import { FutureTradeProChart } from "@/components/future-trade/FutureTradeProChart";
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
import { useFutureTradeBot, type FutureTradeDiagnostics, type FutureTradeDynamicDecision, type FutureTradeDynamicPoint, type FutureTradeEnvConfig, type FutureTradeEnvConfigPayload, type FutureTradeIndicatorSuite, type FutureTradeLiveFeedStatus, type FutureTradeLog, type FutureTradeRecord, type FutureTradeRecoveryResult, type FutureTradeSettings } from "@/hooks/useFutureTradeBot";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

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
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT"],
  timeframe: "5m",
  paperTrading: true,
  liveTrading: false,
  forceTestnet: true,
  leverage: 3,
  marginMode: "isolated",
  tradeAmountUsdt: 25,
  minConfidence: 0.52,
  confidenceMode: "fixed",
  dynamicLookbackMinutes: 10,
  dynamicMinConfidenceFloor: 0.5,
  dynamicMinConfidenceCeiling: 0.62,
  dynamicReentryBuffer: 0.005,
  dynamicSuggestionEnabled: false,
  corePassRule: 3,
  classicSimpleMode: false,
  takeProfitPercent: 1.2,
  stopLossPercent: 0.4,
  trailingTakeProfitPercent: 0.3,
  rollbackLossPercent: 0.25,
  maxDailyLossPercent: 2,
  maxOpenPositions: 1,
  maxTradesPerDay: 25,
  maxLeverage: 5,
  maxSpreadPercent: 0.12,
  cooldownSeconds: 60,
  scanIntervalSeconds: 3,
  autoExecutePaperSignals: true,
  avoidChoppyMarket: false,
  emergencyStop: false,
  tradingHoursEnabled: false,
  tradingHoursStartUtc: "00:00",
  tradingHoursEndUtc: "23:59",
  useLiveDataFeed: true,
  indicatorInfluence: { ...BALANCED_INFLUENCE_DEFAULTS },
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
] as const;

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
  if (!Number.isFinite(parsed)) return "None";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function balanceValue(value: unknown, digits = 4) {
  if (value == null || value === "") return "Unavailable";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Unavailable";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
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

function simulateSignalConfidence(
  debug: FutureTradeDashboard["signalDebug"] | null | undefined,
  settings: Pick<FutureTradeSettings, "indicatorInfluence" | "corePassRule" | "classicSimpleMode">,
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
    return total + (Number(item.rawScore ?? 0) * normalizeInfluenceMultiplier(mergedWeights[item.key]));
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
  const status = dashboard?.status;
  const diagnostics = dashboard?.diagnostics;
  const savedSettings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(bot.config.data?.settings ?? {}) }), [bot.config.data?.settings]);
  const busy = bot.start.isPending || bot.stop.isPending || bot.emergencyStop.isPending || bot.resetPaper.isPending || bot.resetDailyLoss.isPending || bot.updateConfig.isPending || bot.recover.isPending || bot.clearHistory.isPending;
  const liveFeedBusy = bot.startLiveFeed.isPending || bot.stopLiveFeed.isPending || bot.restartLiveFeed.isPending;
  const envBusy = bot.updateEnvConfig.isPending || bot.envConfig.isFetching;
  const runtimeChart = useMemo(() => dashboard?.chart ?? [], [dashboard?.chart]);
  const trackerRows = useMemo(() => (bot.logs.data ?? []).filter((log) => TRACKER_EVENTS.has(log.event)), [bot.logs.data]);
  const liveModeBlocked = Boolean(settings.liveTrading && !status?.liveTradingEnvEnabled);
  const latestRuntimeAlert = diagnostics?.latestAlert;

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
          <Metric title="Total Profit" value={`${n(status?.totalProfit ?? status?.realizedPnl, 4)} ${status?.accountAsset || "USDT"}`} sub={`Realized ${n(status?.realizedPnl, 4)} | Unrealized ${n(status?.unrealizedPnlPercent, 4)}%`} good={(status?.totalProfit ?? status?.realizedPnl ?? 0) >= 0} />
          <Metric title="Wallet Balance" value={`${balanceValue(status?.walletBalance, 4)} ${status?.accountAsset || "USDT"}`} sub={status?.balanceSource === "PAPER_LEDGER" ? "Paper mode wallet not linked" : status?.balanceSource === "BINANCE_UNAVAILABLE" ? (status?.balanceError || "Binance futures balance unavailable") : `Available ${balanceValue(status?.availableBalance, 4)}`} icon={<Wallet className="h-4 w-4" />} good={status?.balanceSource === "BINANCE_UNAVAILABLE" ? false : undefined} />
          <Metric title="Current Signal" value={status?.currentSignal || "WAITING"} sub={`${status?.currentSymbol || "No symbol"} | ${n((status?.confidence ?? 0) * 100, 2)}% vs ${n((status?.activeMinConfidence ?? settings.minConfidence) * 100, 2)}% min`} />
          <Metric title="Position" value={status?.positionSide || "FLAT"} sub={`Entry ${n(status?.entryPrice, 8)} | Qty ${n(status?.quantity, 6)}`} />
          <Metric title="Loss Summary" value={`${n(status?.botLoss ?? status?.dailyLoss, 4)} ${status?.accountAsset || "USDT"}`} sub={`Win ${n(status?.winRate, 2)}% | Trades ${n(status?.tradeCountToday, 0)}`} good={(status?.botLoss ?? status?.dailyLoss ?? 0) === 0} />
        </div>

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
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <Row label="Live update mode" value={String(status?.liveStatus?.mode ?? "-")} />
                <Row label="Indicator timing" value={String(status?.liveStatus?.indicatorMode ?? "-")} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <SignalDebugPanel status={status} debug={dashboard?.signalDebug} />

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Live Futures Graph</CardTitle>
                <Badge variant={statusVariant(dashboard?.bestSignal?.signal)}>{dashboard?.bestSignal?.signal || "WAIT"}</Badge>
              </CardHeader>
              <CardContent className="h-[420px]">
                <FutureTradeProChart
                  candles={dashboard?.marketChart?.candles ?? []}
                  runtimePoints={runtimeChart}
                  settings={settings}
                  symbol={dashboard?.marketChart?.symbol ?? status?.currentSymbol}
                  timeframe={dashboard?.marketChart?.timeframe ?? settings.timeframe}
                  bestSignal={dashboard?.bestSignal}
                  levels={dashboard?.levels}
                />
              </CardContent>
            </Card>

            <IndicatorExecutionPanel indicatorSuite={dashboard?.indicatorSuite} />

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <SignalBoard signals={dashboard?.scanner ?? []} />
              <Orderbook bids={dashboard?.orderbook.bids ?? []} asks={dashboard?.orderbook.asks ?? []} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
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

            <TradeHistory trades={bot.trades.data ?? []} liveTrading={status?.liveTrading ?? false} />
            <DynamicRuntimeTracker logs={bot.logs.data ?? []} />
            <RuntimeDiagnosticsPanel diagnostics={diagnostics} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Bot Controls</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button disabled={busy} onClick={() => bot.start.mutate(undefined, { onError: err(toast) })}><Power className="mr-2 h-4 w-4" />On</Button>
                <Button disabled={busy} variant="outline" onClick={() => bot.stop.mutate(undefined, { onError: err(toast) })}><Square className="mr-2 h-4 w-4" />Off</Button>
                <Button disabled={busy} variant="destructive" onClick={() => bot.emergencyStop.mutate(undefined, { onError: err(toast) })}><ShieldAlert className="mr-2 h-4 w-4" />Emergency</Button>
                <Button disabled={busy} variant="secondary" onClick={() => bot.resetPaper.mutate(undefined, { onError: err(toast) })}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button>
                <Button disabled={busy} variant="outline" className="col-span-2" onClick={() => bot.resetDailyLoss.mutate(undefined, { onError: err(toast) })}>Reset Day Loss</Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  className="col-span-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                  onClick={() => {
                    if (!confirm("Palaya trades + logs ellam delete aagum. Bot running ga irukkum. Continue?")) return;
                    bot.clearHistory.mutate(undefined, {
                      onSuccess: (data: any) => toast({ title: "History cleared", description: `${data?.cleared_trades ?? 0} trades, ${data?.cleared_logs ?? 0} logs deleted.` }),
                      onError: err(toast),
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />Clear History
                </Button>
              </CardContent>
            </Card>

            <LiveFeedDaemonCard
              liveFeed={bot.liveFeed.data}
              busy={liveFeedBusy}
              onStart={() => bot.startLiveFeed.mutate(undefined, { onError: err(toast) })}
              onStop={() => bot.stopLiveFeed.mutate(undefined, { onError: err(toast) })}
              onRestart={() => bot.restartLiveFeed.mutate(undefined, { onError: err(toast) })}
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
                <ConfigPanel envMode={envSettings.mode} status={status} debug={dashboard?.signalDebug} settings={settings} setSettings={setSettings} notes={notes} setNotes={setNotes} availableSymbols={bot.config.data?.available_symbols ?? FUTURE_TRADE_ALL_SYMBOLS} onSave={save} busy={busy} />
              </TabsContent>
              <TabsContent value="my-config">
                <MyConfigPanel envSettings={envSettings} setEnvSettings={setEnvSettings} liveSecret={liveSecret} setLiveSecret={setLiveSecret} testnetSecret={testnetSecret} setTestnetSecret={setTestnetSecret} onSave={saveEnv} onTestConnection={testEnvConnection} busy={envBusy || bot.testConnection.isPending} />
              </TabsContent>
            </Tabs>
            <LogFeed logs={bot.logs.data ?? []} />
          </div>
        </div>
      </div>
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

function IndicatorExecutionPanel({ indicatorSuite }: { indicatorSuite?: FutureTradeIndicatorSuite }) {
  if (!indicatorSuite) return null;

  const backtest = indicatorSuite.backtest;
  const trend = indicatorSuite.trend;
  const score = indicatorSuite.score != null ? `${n(indicatorSuite.score * 100, 0)}%` : "-";

  return (
      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{indicatorSuite.preset || "Indicator"} Confirmation Engine</CardTitle>
        <Badge variant={indicatorSuite.executionReady ? "default" : indicatorSuite.state === "warming_up" ? "secondary" : "outline"}>
          {indicatorSuite.executionReady ? "Execution Ready" : humanizeCode(indicatorSuite.state)}
        </Badge>
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

function RuntimeDiagnosticsPanel({ diagnostics }: { diagnostics?: FutureTradeDiagnostics }) {
  if (!diagnostics) return null;

  const pruneStale = usePruneStalePendingJobs();
  const restartWorkers = useRestartWorkers();
  const queueBacklog = Number(diagnostics.server.queue?.queue_backlog ?? 0);
  const queueFailed = Number(diagnostics.server.queue?.failed_jobs ?? 0);
  const queueWarn = Number(diagnostics.server.queue?.warning_threshold ?? 0);
  const queueBlock = Number(diagnostics.server.queue?.block_threshold ?? 0);
  const queueState = String(diagnostics.server.queue?.state ?? "unknown");
  const actionBusy = pruneStale.isPending || restartWorkers.isPending;
  const autoPruneThreshold = 300;

  return (
    <Card>
      <CardHeader><CardTitle>Runtime Diagnostics</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{diagnostics.summary}</div>

        <div className="grid gap-3 lg:grid-cols-3">
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
        </div>

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
            <div className="text-sm font-medium">Server blockers and warnings</div>
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
        <CardTitle>Signal Scanner</CardTitle>
        <div className="text-xs text-muted-foreground">
          `BUY/SELL` means scanner direction. Red/green percent is recent price move, not confidence. The last percent is signal confidence, and a trade only qualifies when confidence is above the active minimum threshold.
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
              <div className={cn("text-xs", signal.changePercent >= 0 ? "text-running" : "text-destructive")}>{n(signal.changePercent, 2)}% | {n(signal.confidence * 100, 1)}%</div>
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
          <Row label="Mode" value={dynamic.mode.replace("_", " ")} />
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

function ConfigPanel({ envMode, status, debug, settings, setSettings, notes, setNotes, availableSymbols, onSave, busy }: { envMode: FutureTradeEnvConfig["mode"]; status?: { dailyLossLocked?: boolean; manualRestartAllowed?: boolean; activeMinConfidence?: number | null } | null; debug?: FutureTradeDashboard["signalDebug"] | null; settings: FutureTradeSettings; setSettings: (settings: FutureTradeSettings) => void; notes: string; setNotes: (value: string) => void; availableSymbols: string[]; onSave: () => void; busy: boolean }) {
  const update = <K extends keyof FutureTradeSettings>(key: K, value: FutureTradeSettings[K]) => setSettings({ ...settings, [key]: value });
  const recoveryMode = Boolean(status?.dailyLossLocked);
  const applyRecoveryPreset = () => setSettings({ ...settings, ...LOSS_LOCK_RECOVERY_PRESET });
  const applyStrictPreset = () => setSettings({ ...settings, ...STRICT_BTC_ETH_FULLY_DYNAMIC_PRESET });
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
  });
  const updateInfluence = (key: string, value: number) => setSettings({
    ...settings,
    indicatorInfluence: {
      ...mergeInfluenceWeights(DEFAULT_SETTINGS.indicatorInfluence),
      ...(settings.indicatorInfluence ?? {}),
      [key]: Number(value.toFixed(2)),
    },
  });
  const resetInfluenceControls = () => update("indicatorInfluence", { ...(DEFAULT_SETTINGS.indicatorInfluence ?? {}) });
  const simulatedCurrent = useMemo(() => simulateSignalConfidence(debug, settings), [debug, settings]);
  const presetComparisons = useMemo(() => INDICATOR_PRESETS.map((preset) => ({
    label: preset.label,
    ...simulateSignalConfidence(debug, preset),
  })), [debug]);

  const toggleSymbol = (sym: string) => {
    const active = settings.symbols.includes(sym);
    if (active && settings.symbols.length <= 1) return; // keep at least one
    const next = active ? settings.symbols.filter((s) => s !== sym) : [...settings.symbols, sym];
    update("symbols", next);
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
        <Field label="Symbols — click to toggle scan list">
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {availableSymbols.map((sym) => {
              const active = settings.symbols.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggleSymbol(sym)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {sym.replace("USDT", "")}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{settings.symbols.length} coin{settings.symbols.length !== 1 ? "s" : ""} selected: {settings.symbols.map((s) => s.replace("USDT", "")).join(", ")}</p>
        </Field>
        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          Execution mode is controlled from `My Config`.
          Current mode: <span className="font-medium text-foreground">{envMode === "live" ? "Live" : envMode === "testnet" ? "Testnet" : "Paper"}</span>.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={applyStrictPreset}>
            Apply BTC+ETH Safe Preset
          </Button>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Stricter fully dynamic starter for BTC and ETH only.
          </div>
        </div>
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
                  {INDICATOR_INFLUENCE_CONTROLS.map((item) => {
                    const current = displayInfluenceWeight(settings.indicatorInfluence?.[item.key] ?? DEFAULT_SETTINGS.indicatorInfluence?.[item.key] ?? 5);
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">{("impact" in item && item.impact) ? item.impact : "positive"}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <Slider
                            min={0}
                            max={10}
                            step={1}
                            value={[current]}
                            disabled={Boolean(settings.classicSimpleMode)}
                            onValueChange={([value]) => updateInfluence(item.key, value ?? 5)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{n(current, 0)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.note}</TableCell>
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
              <TableHead>Hard blocker</TableHead>
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
                <TableCell>{row.context?.hardBlocker ?? normalizeList(row.context?.hardBlockers)[0] ?? "-"}</TableCell>
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
                <Row label="Hard blocker" value={selectedRow.context?.hardBlocker ?? normalizeList(selectedRow.context?.hardBlockers)[0] ?? "-"} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Soft penalties</div>
                  <div className="text-muted-foreground">{normalizeList(selectedRow.context?.softPenalties).join(" | ") || "-"}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-2 font-medium">Hard blockers</div>
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

function TradeHistory({ trades, liveTrading }: { trades: FutureTradeRecord[]; liveTrading: boolean }) {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">No trades yet.</TableCell>
              </TableRow>
            ) : paginatedTrades.map((trade) => {
              const dynamic = trade.meta?.dynamic;
              const flag = algorithmFlag(dynamic?.mode || trade.meta?.algorithm_mode);
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
  if (mode === "fully_dynamic") return "AUTO";
  if (mode === "semi_dynamic") return "SEMI";
  return "NORMAL";
}

function algorithmVariant(flag?: string | null) {
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

function humanizeCode(value: string) {
  return value.replace(/_/g, " ").trim();
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function SignalDebugPanel({
  status,
  debug,
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
              <Row label="Live mode" value={String(status?.liveStatus?.mode ?? "-")} />
              <Row label="Indicator mode" value={String(status?.liveStatus?.indicatorMode ?? "-")} />
              <Row label="Data source" value={String(status?.liveStatus?.dataSource ?? "-")} />
              <Row label="Stale" value={status?.liveStatus?.isStale ? `Yes (${status?.liveStatus?.ageSeconds ?? 0}s)` : "No"} />
              <Row label="5m candle time" value={status?.liveStatus?.lastCandleTime ? new Date(status.liveStatus.lastCandleTime).toLocaleTimeString() : "-"} />
              <Row label="1h candle time" value={status?.liveStatus?.higherTimeframeLastCandleTime ? new Date(status.liveStatus.higherTimeframeLastCandleTime).toLocaleTimeString() : "-"} />
            </div>

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
}: {
  liveFeed?: FutureTradeLiveFeedStatus;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  const running = Boolean(liveFeed?.running);
  const fresh = Boolean(liveFeed?.isFresh);
  const badgeVariant = running && fresh ? "default" : running ? "secondary" : "outline";

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
            <div className="text-xs text-muted-foreground">{liveFeed?.message ?? "Loading daemon status..."}</div>
          </div>
          <Badge variant={badgeVariant}>{liveFeed?.mode ?? "UNKNOWN"}</Badge>
        </div>

        <div className="grid gap-2 text-xs">
          <Row label="Source" value={String(liveFeed?.dataSource ?? "-")} />
          <Row label="PID" value={liveFeed?.pid ? String(liveFeed.pid) : "-"} />
          <Row label="Started" value={liveFeed?.startedAt ? new Date(liveFeed.startedAt).toLocaleString() : "-"} />
          <Row label="Last feed tick" value={liveFeed?.lastTickAt ? new Date(liveFeed.lastTickAt).toLocaleTimeString() : "-"} />
          <Row label="Feed freshness" value={liveFeed?.ageSeconds != null ? `${liveFeed.ageSeconds}s` : "-"} />
          <Row label="Symbol sync" value={liveFeed?.symbolSetInSync ? "In sync" : "Restart recommended"} />
          <Row label="Symbols" value={liveFeed?.desiredSymbols?.join(", ") || "-"} />
        </div>

        {liveFeed?.command ? (
          <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">Daemon command</div>
            <div className="mt-1 break-all font-mono">{liveFeed.command}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Button disabled={busy || running} onClick={onStart}>
            <Power className="mr-2 h-4 w-4" />
            Start
          </Button>
          <Button disabled={busy || !running} variant="outline" onClick={onRestart}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart
          </Button>
          <Button disabled={busy || !running} variant="secondary" onClick={onStop}>
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          Best mode: keep this daemon running for shared websocket ticks and kline cache. If it is offline, Future Trade falls back to REST polling.
        </div>
      </CardContent>
    </Card>
  );
}
