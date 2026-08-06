import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { ExecutionSafetyControls, type ExecutionSafetyValues } from "@/components/trading/ExecutionSafetyControls";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
import { NearTermForecastCard } from "@/components/trading/NearTermForecastCard";
import { TradeDealList } from "@/components/trading/TradeDealList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBalances } from "@/hooks/useWallet";
import { useRiskProfiles } from "@/hooks/useRisk";
import { useUpdateTradingSettings } from "@/hooks/useTradingMode";
import { useQuickTradeChart, useQuickTradeMetadata, useSettleQuickTrades } from "@/hooks/useQuickTrade";
import {
  useCreateRobotSession,
  useDeleteRobotSession,
  useResetRobotSession,
  useResetDailyLoss,
  useUpdateRobotSession,
  useEvaluateRobotSession,
  useExchangeBalance,
  useForceCloseSession,
  usePauseRobotSession,
  useRobotLiveStats,
  useRobotSessions,
  useRobotSessionStatus,
  useStartRobotSession,
  useStopRobotSession,
} from "@/hooks/useRobotTrading";
import { useRepairRuntime, useRuntimeHealth } from "@/hooks/useRuntimeHealth";
import { useRuntimeSafetySettings, useUpdateRuntimeSafetySettings } from "@/hooks/useRuntimeSafetySettings";
import { type CandleData, useRobotCandleFeed } from "@/hooks/useRobotCandleFeed";
import { RobotLiveChart } from "@/components/trading/RobotLiveChart";
import { AssetClassToggle } from "@/components/trading/AssetClassToggle";
import { ProviderSelect } from "@/components/trading/ProviderSelect";
import type { AssetClass } from "@/hooks/useProviderCatalog";

const MIN_ROBOT_STAKE = 20;

export default function RobotTradingPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: balances = [] } = useBalances(workspaceId);
  const { data: riskProfiles = [] } = useRiskProfiles(workspaceId);
  const { data: metadata } = useQuickTradeMetadata(workspaceId);
  const runtimeHealth = useRuntimeHealth(workspaceId);
  const repairRuntime = useRepairRuntime(workspaceId);
  const runtimeSafety = useRuntimeSafetySettings(workspaceId);
  const updateRuntimeSafety = useUpdateRuntimeSafetySettings(workspaceId);
  const [repairOutputOpen, setRepairOutputOpen] = useState(false);
  const updateTradingSettings = useUpdateTradingSettings(workspaceId);

  const sessionsQuery = useRobotSessions(workspaceId);
  const sessions = sessionsQuery.data ?? [];
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const sessionStatus = useRobotSessionStatus(selectedSessionId);

  const createSession = useCreateRobotSession(workspaceId);
  const startSession = useStartRobotSession();
  const pauseSession = usePauseRobotSession();
  const stopSession = useStopRobotSession();
  const deleteSession = useDeleteRobotSession();
  const updateSession = useUpdateRobotSession(workspaceId);
  const resetSession = useResetRobotSession();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const evaluateSession = useEvaluateRobotSession();
  const settleTrades = useSettleQuickTrades();

  const [name, setName] = useState("Binance robot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1m");
  const [expirySeconds, setExpirySeconds] = useState(60);
  const [baseStake, setBaseStake] = useState(MIN_ROBOT_STAKE);
  const [strategyProfile, setStrategyProfile] = useState("balanced");
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [maxActiveTrades, setMaxActiveTrades] = useState(2);
  const [profitTarget, setProfitTarget] = useState(20);
  const [lossLimit, setLossLimit] = useState(5);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(2);
  const [riskProfileId, setRiskProfileId] = useState<string>("none");
  const [indicatorSet, setIndicatorSet] = useState<string[]>(["RSI", "MACD"]);
  const [selectedProvider, setSelectedProvider] = useState("binance");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("auto");
  const [botMode, setBotMode] = useState<"candle_direction" | "timed_expiry">("candle_direction");
  const [assetClass, setAssetClass] = useState<AssetClass>("CRYPTO");
  const [stopLossPct, setStopLossPct] = useState(12);
  const [takeProfitPct, setTakeProfitPct] = useState<number | "">("");
  const [cooldownSeconds, setCooldownSeconds] = useState(600);
  const [dailyLossLimit, setDailyLossLimit] = useState<number | "">(5);
  const [multiSymbol, setMultiSymbol] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [chartSymbolOverride, setChartSymbolOverride] = useState<string | null>(null);
  const [safetyValues, setSafetyValues] = useState<ExecutionSafetyValues>({
    liveFeedMaxAgeSeconds: 3,
    webhookMaxSignalLatencyMs: 4000,
  });

  const forceClose = useForceCloseSession();
  const resetDailyLoss = useResetDailyLoss();

  const tradingState = metadata?.trading_state;
  const activeMode = tradingState?.mode ?? "paper";
  const liveReady = Boolean(tradingState?.live_ready);
  const providerCatalogAll = Object.values(tradingState?.provider_catalog ?? {});
  const providerCatalog = providerCatalogAll.filter((provider) => (provider.asset_class ?? "CRYPTO") === assetClass);
  const providerIntegrations = (tradingState?.active_integrations ?? []).filter(
    (integration) => integration.provider_key === selectedProvider
  );

  useEffect(() => {
    if (!metadata) return;

    if (!metadata.symbols.some((option) => option.symbol === symbol)) {
      setSymbol(metadata.symbols[0]?.symbol ?? "");
      setName(`${metadata.symbols[0]?.display ?? "Trading"} robot`);
    }
    if (!metadata.timeframes.some((option) => option.key === timeframe)) {
      setTimeframe(metadata.timeframes[0]?.key ?? metadata.quick_trade.default_timeframe);
    }
    if (!metadata.durations.some((option) => option.seconds === expirySeconds)) {
      setExpirySeconds(metadata.durations[0]?.seconds ?? metadata.quick_trade.default_duration);
    }

    const allowedIndicators = new Set(metadata.quick_trade.allowed_indicators);
    setIndicatorSet((current) => {
      const filtered = current.filter((indicator) => allowedIndicators.has(indicator));
      if (filtered.length > 0) return filtered;
      return (metadata.robot_trade.default_indicators ?? metadata.quick_trade.allowed_indicators ?? []).slice(0, 2);
    });

    setConfidenceThreshold((current) => current || metadata.robot_trade.confidence_threshold);
    setMaxActiveTrades((current) => current || metadata.robot_trade.max_active_trades);
    setStrategyProfile((current) => current || metadata.robot_trade.strategy_profiles[1]?.key || "balanced");

    const provider = tradingState?.preferred_provider ?? metadata.quick_trade.default_provider ?? "binance";
    setSelectedProvider(provider);
    setSelectedIntegrationId(tradingState?.preferred_integration_id ?? "auto");
  }, [expirySeconds, metadata, symbol, timeframe, tradingState]);

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Reset chart symbol override when switching to a different session.
  useEffect(() => {
    setChartSymbolOverride(null);
  }, [selectedSessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      settleTrades.mutate(25);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [settleTrades]);

  useEffect(() => {
    if (!runtimeSafety.data) return;
    setSafetyValues({
      liveFeedMaxAgeSeconds: Number(runtimeSafety.data.live_feed_max_age_seconds ?? 3),
      webhookMaxSignalLatencyMs: Number(runtimeSafety.data.webhook_max_signal_latency_ms ?? 4000),
    });
  }, [runtimeSafety.data]);

  const selectedBalance = useMemo(() => {
    if (activeMode === "live") {
      return (
        balances.find((account: any) => {
          const provider = String(account?.metadata?.provider ?? "").toLowerCase();
          const integrationId = String(account?.metadata?.integration_id ?? "");
          return (
            String(account?.type ?? "").toLowerCase() === "exchange" &&
            (provider === "" || provider === selectedProvider) &&
            (selectedIntegrationId === "auto" || integrationId === selectedIntegrationId)
          );
        }) ??
        balances.find((account: any) => String(account?.type ?? "").toLowerCase() === "exchange") ??
        balances[0]
      );
    }

    return (
      balances.find((account: any) => String(account?.wallet_type ?? "").toLowerCase() === "paper") ??
      balances.find((account: any) => String(account?.type ?? "").toLowerCase() === "cash" && String(account?.currency ?? "").toUpperCase() === "USD") ??
      balances[0]
    );
  }, [activeMode, balances, selectedIntegrationId, selectedProvider]);
  const balance = Number(selectedBalance?.available ?? selectedBalance?.balance ?? 0);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const isCandleBot = (selectedSession?.bot_mode ?? "timed_expiry") === "candle_direction";

  const liveStatsQuery = useRobotLiveStats(selectedSessionId, isCandleBot);
  const liveStats = liveStatsQuery.data ?? null;
  const livePosition = liveStats?.position ?? null;

  // Keep the graph tied to the asset dropdown first. If the operator clicks a
  // running session card, the form is loaded with that symbol so the chart still
  // follows one selected symbol at a time.
  const chartEnabled = botMode === "candle_direction" && Boolean(symbol);
  const baseChartSymbol = symbol;
  const chartSymbol = chartSymbolOverride ?? baseChartSymbol;
  const chartTimeframe = timeframe;

  const chartQuery = useQuickTradeChart({
    workspaceId,
    symbol: chartSymbol,
    timeframe: chartTimeframe,
    chartType: "candles",
    indicatorSet,
    mode: activeMode,
    provider: selectedProvider,
    integrationId: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
  });

  const feed = useRobotCandleFeed(
    chartSymbol,
    chartTimeframe,
    chartEnabled,
    isCandleBot ? selectedSessionId : undefined,
  );

  const fallbackCandles = useMemo<CandleData[]>(() => {
    if (!chartQuery.data?.candles?.length) return [];
    return chartQuery.data.candles.map((c) => ({
      time: Math.floor(Number(c.timestamp) / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      isClosed: true,
    }));
  }, [chartQuery.data?.candles]);

  const chartCandles = feed.candles.length > 0 ? feed.candles : fallbackCandles;
  const chartLivePosition = selectedSession?.symbol === chartSymbol ? livePosition : null;

  const takeProfitPrice = useMemo(() => {
    if (!chartLivePosition || !selectedSession?.take_profit_pct) return null;
    const pct = Number(selectedSession.take_profit_pct) / 100;
    return chartLivePosition.side === "SELL"
      ? chartLivePosition.entry_price * (1 - pct)
      : chartLivePosition.entry_price * (1 + pct);
  }, [chartLivePosition, selectedSession?.take_profit_pct]);

  // Entry marker (snapped to the nearest candle) + live PnL overlay for the chart.
  const chartMarkers = useMemo(() => {
    if (chartLivePosition?.active_since) {
      const entrySec = Math.floor(new Date(chartLivePosition.active_since).getTime() / 1000);
      const earlier = chartCandles.filter((c) => c.time <= entrySec).map((c) => c.time);
      const markerTime = earlier.length ? earlier[earlier.length - 1] : entrySec;
      return [{ time: markerTime, side: chartLivePosition.side, text: `${chartLivePosition.side} @ ${chartLivePosition.entry_price}` }];
    }
    const action = liveStats?.last_decision?.action;
    const latestCandle = chartCandles[chartCandles.length - 1];
    if ((action === "BUY" || action === "SELL") && latestCandle) {
      return [{ time: latestCandle.time, side: action, text: `${action} signal` }];
    }
    return [];
  }, [chartLivePosition, chartCandles, liveStats?.last_decision?.action]);

  const chartPnl = chartLivePosition
    ? { side: chartLivePosition.side, pct: chartLivePosition.unrealized_pct, value: chartLivePosition.unrealized_pnl }
    : null;
  const trustState = liveStats?.trust_chain?.state ?? "blocked";
  const trustTone =
    trustState === "ready"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : trustState === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
        : "border-rose-500/25 bg-rose-500/10 text-rose-200";
  const recentTrades = sessionStatus.data?.recent_trades ?? [];
  const exportRobotDealsCsv = () => {
    const rows = recentTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      status: trade.status,
      stake_amount: trade.stake_amount,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      pnl: trade.profit_loss,
      opened_at: trade.entry_at,
      settled_at: trade.settled_at,
    }));
    const headers = Object.keys(rows[0] ?? { id: "", symbol: "", side: "", status: "", stake_amount: "", entry_price: "", exit_price: "", pnl: "", opened_at: "", settled_at: "" });
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => {
        const value = String((row as Record<string, unknown>)[key] ?? "");
        return `"${value.replaceAll('"', '""')}"`;
      }).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `robot-deals-${selectedSession?.symbol ?? "session"}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const strategyProfiles = metadata?.robot_trade.strategy_profiles ?? [];
  const runtimeBadgeTone =
    selectedSession?.status === "RUNNING"
      ? "bg-emerald-500/10 text-emerald-300"
      : selectedSession?.status === "PAUSED"
        ? "bg-amber-500/10 text-amber-300"
        : "bg-slate-500/10 text-slate-300";
  const sessionPnl = useMemo(
    () => Number(sessionStatus.data?.session.total_pnl ?? selectedSession?.total_pnl ?? 0),
    [sessionStatus.data, selectedSession]
  );
  const selectedIntegrationLabel =
    providerIntegrations.find((integration) => integration.id === selectedIntegrationId)?.display_name ??
    tradingState?.preferred_integration_label ??
    "Auto";

  const updateMode = (nextMode: "paper" | "live", provider = selectedProvider, integrationId = selectedIntegrationId) => {
    if (!workspaceId) return;

    updateTradingSettings.mutate({
      trading_mode: nextMode,
      live_enabled: nextMode === "live",
      venue_environment: nextMode === "live" ? "live" : "sandbox",
      preferred_provider: provider,
      preferred_integration_id: integrationId === "auto" ? null : integrationId,
    });
  };

  // Testnet vs Live both run in live mode; they differ only by which exchange
  // integration (environment) is selected. Resolve each from the connected
  // integrations so the 3-way switch points the wallet at the right credentials.
  const integrationsForProvider = (tradingState?.active_integrations ?? []).filter(
    (integration) => integration.provider_key === selectedProvider
  );
  const testnetIntegration = integrationsForProvider.find((i) => (i.environment ?? "live") === "testnet");
  const liveIntegration = integrationsForProvider.find((i) => (i.environment ?? "live") === "live");
  const currentEnv: "paper" | "testnet" | "live" =
    activeMode !== "live" ? "paper" : (tradingState?.exchange_environment ?? "live") === "testnet" ? "testnet" : "live";

  const setTradeEnv = (env: "paper" | "testnet" | "live") => {
    if (env === "paper") {
      updateMode("paper");
      return;
    }
    const integration = env === "testnet" ? testnetIntegration : liveIntegration;
    if (!integration) return; // button is disabled when missing
    setSelectedProvider(selectedProvider);
    setSelectedIntegrationId(integration.id);
    updateMode("live", selectedProvider, integration.id);
  };

  // In live/testnet mode, show the REAL balance pulled live from the exchange
  // (not the internal/seeded wallet ledger).
  const exchangeBalanceQuery = useExchangeBalance(workspaceId, currentEnv !== "paper");
  const exchangeBalance = exchangeBalanceQuery.data ?? null;
  const realBalance =
    currentEnv !== "paper" && exchangeBalance?.source === "exchange" && exchangeBalance.available != null
      ? Number(exchangeBalance.available)
      : null;
  const displayBalance = realBalance ?? balance;
  const balanceIsLive = realBalance != null;

  const createRobot = async () => {
    if (!workspaceId) return;

    const basePayload = {
      timeframe,
      expiry_seconds: expirySeconds,
      indicator_set: indicatorSet,
      strategy_profile: strategyProfile,
      base_stake: Math.max(MIN_ROBOT_STAKE, Number(baseStake || 0)),
      profit_target: profitTarget,
      loss_limit: lossLimit,
      max_consecutive_losses: maxConsecutiveLosses,
      max_active_trades: maxActiveTrades,
      confidence_threshold: confidenceThreshold,
      risk_profile_id: riskProfileId === "none" ? undefined : riskProfileId,
      provider: selectedProvider,
      integration_id: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
      bot_mode: botMode,
      stop_loss_pct: stopLossPct,
      take_profit_pct: takeProfitPct === "" ? null : Number(takeProfitPct),
      cooldown_seconds: cooldownSeconds,
      daily_loss_limit: dailyLossLimit === "" ? null : Math.max(0, Number(dailyLossLimit)),
    };

    // Editing an existing session â€” PATCH it in place.
    if (editingSessionId) {
      await updateSession.mutateAsync({
        id: editingSessionId,
        payload: { ...basePayload, name, symbol, multi_symbol: false, symbol_list: [symbol] },
      });
      setEditingSessionId(null);
      return;
    }

    // Multi-symbol candle bots fan out to one independent session per symbol.
    const fanOut = false;
    if (fanOut) {
      const display = (sym: string) => metadata?.symbols.find((o) => o.symbol === sym)?.display ?? sym;
      for (const sym of selectedSymbols) {
        await createSession.mutateAsync({
          ...basePayload,
          name: `${display(sym)} candle bot`,
          symbol: sym,
          multi_symbol: true,
          symbol_list: selectedSymbols,
        });
      }
      return;
    }

    createSession.mutate({ ...basePayload, name, symbol, multi_symbol: false, symbol_list: [symbol] });
  };

  const toggleIndicator = (key: string, checked: boolean) => {
    setIndicatorSet((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((entry) => entry !== key)
    );
  };

  const loadSessionIntoForm = (s: (typeof sessions)[number]) => {
    setEditingSessionId(s.id);
    setName(s.name);
    setSymbol(s.symbol);
    setChartSymbolOverride(null);
    setTimeframe(s.timeframe);
    setExpirySeconds(s.expiry_seconds);
    setBaseStake(Math.max(MIN_ROBOT_STAKE, Number(s.base_stake)));
    setBotMode((s.bot_mode ?? "timed_expiry") as "candle_direction" | "timed_expiry");
    setStopLossPct(Number(s.stop_loss_pct ?? 12));
    setTakeProfitPct(s.take_profit_pct == null ? "" : Number(s.take_profit_pct));
    setCooldownSeconds(Number(s.cooldown_seconds ?? 600));
    setDailyLossLimit(s.daily_loss_limit == null ? "" : Number(s.daily_loss_limit));
    setMultiSymbol(false);
    setSelectedSymbols([s.symbol]);
    setConfidenceThreshold(s.confidence_threshold ?? 70);
    setMaxActiveTrades(s.max_active_trades ?? 2);
    setProfitTarget(Number(s.profit_target ?? 0));
    setLossLimit(Number(s.loss_limit ?? 0));
    setMaxConsecutiveLosses(s.max_consecutive_losses ?? 2);
    setStrategyProfile(s.strategy_profile ?? "balanced");
    setRiskProfileId(s.risk_profile_id ?? "none");
    if (Array.isArray(s.indicator_set) && s.indicator_set.length) setIndicatorSet(s.indicator_set);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => setEditingSessionId(null);

  const actionDisabled = activeMode === "live" && !liveReady;
  const robotFeedHardBlock =
    activeMode === "live" &&
    (runtimeHealth.isSuccess ? runtimeHealth.data?.robot_trade?.market_feed === "red" : false);
  const robotRuntimeRed = robotFeedHardBlock;
  const marketFeedDetail = runtimeHealth.data?.robot_trade?.market_feed_detail ?? {};
  const evaluatorDetail = runtimeHealth.data?.robot_trade?.evaluator_detail ?? {};
  const saveRuntimeSafety = () => {
    updateRuntimeSafety.mutate({
      live_feed_max_age_seconds: safetyValues.liveFeedMaxAgeSeconds,
      webhook_max_signal_latency_ms: safetyValues.webhookMaxSignalLatencyMs,
    });
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,#020617_0%,#071120_100%)] text-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 md:px-6">
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Robot trading</div>
                <div className="mt-2 text-3xl font-semibold">
                  {currentEnv === "live" ? "Live wallet" : currentEnv === "testnet" ? "Testnet wallet" : "Paper balance"}{" "}
                  {balanceIsLive ? (exchangeBalance?.asset ?? "USDT") : (selectedBalance?.currency ?? "USD")} {displayBalance.toFixed(2)}
                </div>
                {currentEnv !== "paper" && (
                  <div className="mt-1 text-xs text-slate-500">
                    {balanceIsLive
                      ? `Live from ${(exchangeBalance?.provider ?? "binance").toUpperCase()} ${exchangeBalance?.environment ?? ""} account`
                      : exchangeBalance?.error
                        ? `Exchange balance unavailable: ${exchangeBalance.error}`
                        : "Fetching live exchange balanceâ€¦"}
                  </div>
                )}
                <div className="mt-2 text-sm text-slate-400">
                  {botMode === "candle_direction"
                    ? "Candle bot analyzes 20â€“100 past candles for pattern + momentum + trend. Exits on reverse candle, trailing stop, or take-profit â€” not by time."
                    : activeMode === "live"
                    ? "Live robots open Binance timed futures positions and auto-close them on the configured duration."
                    : "Paper robots share the same expiry engine, wallet, and ledger as manual quick trades."}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={runtimeBadgeTone}>{selectedSession?.status ?? "STOPPED"}</Badge>
                <Badge className={sessionPnl >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}>
                  PnL {sessionPnl >= 0 ? "+" : ""}
                  {sessionPnl.toFixed(2)}
                </Badge>
                <Badge className={currentEnv === "live" ? "bg-emerald-500/10 text-emerald-300" : currentEnv === "testnet" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-300"}>
                  {currentEnv.toUpperCase()}
                </Badge>
                <Badge className="bg-blue-500/10 text-blue-300">{selectedProvider.toUpperCase()}</Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Mode</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="ghost"
                    className={currentEnv === "paper" ? "bg-slate-100 text-slate-950 hover:bg-slate-200" : "bg-slate-950 text-slate-300"}
                    disabled={updateTradingSettings.isPending}
                    onClick={() => setTradeEnv("paper")}
                  >
                    Paper
                  </Button>
                  <Button
                    variant="ghost"
                    title={testnetIntegration ? "" : "Connect a Binance testnet key in Connections first"}
                    className={currentEnv === "testnet" ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "bg-slate-950 text-slate-300"}
                    disabled={updateTradingSettings.isPending || !testnetIntegration}
                    onClick={() => setTradeEnv("testnet")}
                  >
                    Testnet
                  </Button>
                  <Button
                    variant="ghost"
                    title={liveIntegration ? "" : "Connect a Binance live key in Connections first"}
                    className={currentEnv === "live" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-slate-950 text-slate-300"}
                    disabled={updateTradingSettings.isPending || !liveIntegration}
                    onClick={() => setTradeEnv("live")}
                  >
                    Live
                  </Button>
                </div>
                {currentEnv !== "paper" && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {currentEnv === "testnet" ? "Binance testnet â€” practice funds." : "Binance live â€” real funds."}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Asset class</div>
                <AssetClassToggle
                  value={assetClass}
                  onChange={(nextClass) => {
                    setAssetClass(nextClass);
                    const nextProvider = providerCatalogAll.find(
                      (provider) => (provider.asset_class ?? "CRYPTO") === nextClass
                    );
                    const providerKey = nextProvider?.key ?? (nextClass === "CRYPTO" ? "binance" : "metal_broker");
                    const nextIntegration = (tradingState?.active_integrations ?? []).find(
                      (integration) => integration.provider_key === providerKey
                    )?.id;
                    setSelectedProvider(providerKey);
                    setSelectedIntegrationId(nextIntegration ?? "auto");
                    updateMode(activeMode, providerKey, nextIntegration ?? "auto");
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
                <ProviderSelect
                  providers={providerCatalog}
                  value={selectedProvider}
                  onChange={(value) => {
                    const nextIntegration = (tradingState?.active_integrations ?? []).find(
                      (integration) => integration.provider_key === value
                    )?.id;
                    setSelectedProvider(value);
                    setSelectedIntegrationId(nextIntegration ?? "auto");
                    updateMode(activeMode, value, nextIntegration ?? "auto");
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Integration</div>
                <Select
                  value={selectedIntegrationId}
                  onValueChange={(value) => {
                    setSelectedIntegrationId(value);
                    updateMode(activeMode, selectedProvider, value);
                  }}
                >
                  <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    {providerIntegrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeMode === "live" && !liveReady && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                {tradingState?.live_ready_reason ?? "Connect an active Binance integration before starting live robots."}
              </div>
            )}

            <div className="mt-4">
              <ExecutionSafetyControls
                title="Robot Execution Safety"
                moduleLabel="Robot Trade"
                values={safetyValues}
                telemetry={{
                  feedAgeSeconds: numberFrom(marketFeedDetail.age_seconds ?? liveStats?.market_feed?.age_seconds),
                  feedState: runtimeHealth.data?.robot_trade?.market_feed,
                  feedReason: String(marketFeedDetail.reason ?? liveStats?.market_feed?.reason ?? ""),
                  truthSource: String(marketFeedDetail.truth_source ?? marketFeedDetail.source ?? liveStats?.market_feed?.source ?? feed.source ?? "binance_futures_ws"),
                  lastTickAt: String(marketFeedDetail.last_tick_at ?? liveStats?.market_feed?.last_tick_at ?? ""),
                  evaluatorAgeSeconds: numberFrom(runtimeHealth.data?.robot_trade?.evaluator_age_seconds),
                  evaluatorState: runtimeHealth.data?.robot_trade?.evaluator,
                  latestDecisionAgeSeconds: secondsSince(liveStats?.as_of),
                  chartLatencyMs: feed.latencyMs,
                  serverNow: runtimeHealth.data?.generated_at,
                }}
                onChange={setSafetyValues}
                onSave={saveRuntimeSafety}
                busy={updateRuntimeSafety.isPending}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-slate-800 bg-slate-950 text-slate-50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{editingSessionId ? "Edit robot session" : "New robot session"}</span>
                  {editingSessionId && (
                    <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={cancelEdit}>
                      Cancel edit
                    </button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} className="border-slate-800 bg-slate-900 text-slate-100" />
                </div>

                <div className="space-y-2">
                  <Label>Bot mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className={botMode === "candle_direction" ? "bg-blue-500 text-slate-950 hover:bg-blue-400" : "bg-slate-900 text-slate-300"}
                      onClick={() => setBotMode("candle_direction")}
                    >
                      Candle direction
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={botMode === "timed_expiry" ? "bg-blue-500 text-slate-950 hover:bg-blue-400" : "bg-slate-900 text-slate-300"}
                      onClick={() => setBotMode("timed_expiry")}
                    >
                      Timed expiry
                    </Button>
                  </div>
                </div>

                {botMode === "candle_direction" && (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Trailing stop loss (%)</Label>
                        <Input type="number" min={0.1} max={100} step={0.5} value={stopLossPct} onChange={(event) => setStopLossPct(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <Label>Take profit (% â€” optional)</Label>
                        <Input type="number" min={0.1} step={0.5} placeholder="Off" value={takeProfitPct} onChange={(event) => setTakeProfitPct(event.target.value === "" ? "" : Number(event.target.value))} className="border-slate-800 bg-slate-900 text-slate-100" />
                      </div>
                    </div>

                    {botMode === "candle_direction" && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Cooldown after loss</Label>
                          <Select value={String(cooldownSeconds)} onValueChange={(v) => setCooldownSeconds(Number(v))}>
                            <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No cooldown</SelectItem>
                              <SelectItem value="60">1 minute</SelectItem>
                              <SelectItem value="180">3 minutes</SelectItem>
                              <SelectItem value="300">5 minutes</SelectItem>
                              <SelectItem value="600">10 minutes</SelectItem>
                              <SelectItem value="900">15 minutes</SelectItem>
                              <SelectItem value="1800">30 minutes</SelectItem>
                              <SelectItem value="3600">1 hour</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">Wait after a losing trade before next entry.</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Daily loss limit (optional)</Label>
                          <Input type="number" min={0} step={1} placeholder="No limit" value={dailyLossLimit} onChange={(e) => setDailyLossLimit(e.target.value === "" ? "" : Number(e.target.value))} className="border-slate-800 bg-slate-900 text-slate-100" />
                          <p className="text-xs text-slate-500">Stop trading for the day when total loss hits this amount. Resets at UTC midnight.</p>
                        </div>
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                      <Checkbox
                        checked={false}
                        disabled
                        onCheckedChange={(value) => {
                          const on = Boolean(value);
                          setMultiSymbol(on);
                          if (on && selectedSymbols.length === 0 && symbol) setSelectedSymbols([symbol]);
                        }}
                      />
                      One symbol at a time (graph follows the selected asset)
                    </label>

                    {multiSymbol && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Symbols ({selectedSymbols.length} selected â€” one bot each)</Label>
                          {selectedSymbols.length > 0 && (
                            <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setSelectedSymbols([])}>
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                          {(metadata?.symbols ?? []).map((option) => {
                            const checked = selectedSymbols.includes(option.symbol);
                            return (
                              <label key={option.symbol} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800/60">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    setSelectedSymbols((current) =>
                                      value ? Array.from(new Set([...current, option.symbol])) : current.filter((s) => s !== option.symbol)
                                    )
                                  }
                                />
                                {option.display}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-100">
                      Trailing stop keeps {stopLossPct}% of peak profit. If you reach +$10 profit, the bot closes when profit
                      drops to +${(10 * (1 - stopLossPct / 100)).toFixed(2)}.
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Trading asset</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(metadata?.symbols ?? []).map((option) => (
                          <SelectItem key={option.symbol} value={option.symbol}>
                            {option.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timeframe</Label>
                    <Select value={timeframe} onValueChange={setTimeframe}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(metadata?.timeframes ?? []).map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {botMode === "timed_expiry" ? (
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Select value={String(expirySeconds)} onValueChange={(value) => setExpirySeconds(Number(value))}>
                        <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(metadata?.durations ?? []).map((option) => (
                            <SelectItem key={option.seconds} value={String(option.seconds)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-slate-400">Duration</Label>
                      <div className="rounded-xl border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500">
                        Not used in candle mode â€” exits via trailing stop, reverse candle, or take profit.
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Base stake</Label>
                    <Input
                      type="number"
                      min={MIN_ROBOT_STAKE}
                      step={1}
                      value={baseStake}
                      onBlur={() => setBaseStake((current) => Math.max(MIN_ROBOT_STAKE, Number(current || 0)))}
                      onChange={(event) => setBaseStake(Number(event.target.value || 0))}
                      className="border-slate-800 bg-slate-900 text-slate-100"
                    />
                    <p className="text-xs text-slate-500">Minimum ${MIN_ROBOT_STAKE} so BTCUSDT/ETHUSDT live orders do not fail as too small.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Strategy profile</Label>
                    <Select value={strategyProfile} onValueChange={setStrategyProfile}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {strategyProfiles.map((profile) => (
                          <SelectItem key={profile.key} value={profile.key}>
                            {profile.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Risk profile</Label>
                    <Select value={riskProfileId} onValueChange={setRiskProfileId}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {riskProfiles.map((profile: any) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Confidence threshold</Label>
                    <Input type="number" min={1} max={100} value={confidenceThreshold} onChange={(event) => setConfidenceThreshold(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max active trades</Label>
                    <Input type="number" min={1} max={20} value={maxActiveTrades} onChange={(event) => setMaxActiveTrades(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Profit target</Label>
                    <Input type="number" min={0} value={profitTarget} onChange={(event) => setProfitTarget(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Loss limit</Label>
                    <Input type="number" min={0} value={lossLimit} onChange={(event) => setLossLimit(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max loss streak</Label>
                    <Input type="number" min={1} max={10} value={maxConsecutiveLosses} onChange={(event) => setMaxConsecutiveLosses(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Technical indicators</Label>
                  {(metadata?.indicators ?? []).filter((item) => item.key !== "HEIKIN_ASHI").map((indicator) => {
                    const checked = indicatorSet.includes(indicator.key);
                    return (
                      <label key={indicator.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleIndicator(indicator.key, Boolean(value))} />
                        <div>
                          <div className="font-medium text-slate-100">{indicator.label}</div>
                          <div className="text-sm text-slate-400">{indicator.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                  {activeMode === "live"
                    ? `Live mode will use ${selectedProvider.toUpperCase()} / ${selectedIntegrationLabel} and auto-close timed positions at expiry.`
                    : "Paper mode uses indicator consensus and deterministic heuristics. It does not promise returns."}
                </div>

                {(() => {
                  const isEditing = Boolean(editingSessionId);
                  const fanOut = false;
                  const fanOutBlocked = fanOut && selectedSymbols.length === 0;
                  const busy = createSession.isPending || updateSession.isPending;
                  const label = busy
                    ? "Saving..."
                    : isEditing
                      ? "Update robot session"
                      : fanOut
                        ? `Save ${selectedSymbols.length || ""} robot session${selectedSymbols.length === 1 ? "" : "s"}`.replace("  ", " ")
                        : "Save robot session";
                  return (
                    <Button
                      className="h-14 w-full rounded-3xl bg-blue-500 text-lg font-semibold hover:bg-blue-400"
                      onClick={createRobot}
                      disabled={busy || updateTradingSettings.isPending || actionDisabled || fanOutBlocked}
                    >
                      {label}
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {chartEnabled && (
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                      {/* Symbol pills */}
                      <div className="flex flex-wrap gap-1">
                        {["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT"].map((sym) => {
                          const active = chartSymbol === sym;
                          const isSessionSym = sym === baseChartSymbol;
                          return (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => {
                                setSymbol(sym);
                                setChartSymbolOverride(null);
                              }}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                active
                                  ? "border-blue-500 bg-blue-500/20 text-blue-200"
                                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                              } ${isSessionSym ? "font-semibold" : ""}`}
                            >
                              {sym.replace("USDT", "")}
                              {isSessionSym && <span className="ml-1 text-emerald-400">â—</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{chartSymbol} Â· {chartTimeframe}</span>
                        {chartSymbolOverride && (
                          <button type="button" onClick={() => setChartSymbolOverride(null)} className="text-xs text-slate-500 hover:text-slate-300">
                            â† bot
                          </button>
                        )}
                        {!isCandleBot && <Badge className="bg-slate-700/40 text-slate-300">PREVIEW</Badge>}
                        <Badge className={feed.connected ? "bg-emerald-500/10 text-emerald-300" : chartCandles.length > 0 ? "bg-blue-500/10 text-blue-300" : "bg-slate-500/10 text-slate-300"}>
                          {feed.connected ? `LIVE · ${feed.latencyMs}ms` : chartCandles.length > 0 ? "REST" : "CONNECTING"}
                        </Badge>
                        {feed.source && <Badge className="bg-blue-500/10 text-blue-300">{feed.source.toUpperCase()}</Badge>}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RobotLiveChart
                      candles={chartCandles}
                      side={chartLivePosition?.side ?? null}
                      entryPrice={chartLivePosition?.entry_price ?? null}
                      stopPrice={chartLivePosition?.stop_price ?? null}
                      takeProfitPrice={takeProfitPrice}
                      markers={chartMarkers}
                      pnl={chartPnl}
                    />

                    <div className={`rounded-2xl border px-4 py-3 ${trustTone}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide opacity-70">Decision trust chain</div>
                          <div className="text-sm font-semibold">{liveStats?.trust_chain?.summary ?? "Waiting for backend health data."}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={liveStats?.market_feed?.fresh ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"}>
                            Feed {liveStats?.market_feed?.fresh ? "fresh" : "stale"}
                          </Badge>
                          <Badge className="bg-slate-900/50 text-slate-200">
                            {liveStats?.market_feed?.age_seconds ?? "-"}s / {liveStats?.market_feed?.max_age_seconds ?? "-"}s
                          </Badge>
                          <Badge className={trustState === "ready" ? "bg-emerald-500/20 text-emerald-200" : trustState === "warning" ? "bg-amber-500/20 text-amber-200" : "bg-rose-500/20 text-rose-200"}>
                            {trustState.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      {liveStats?.trust_chain?.checks && (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {liveStats.trust_chain.checks.slice(0, 6).map((check) => (
                            <div key={check.key} className="rounded-xl bg-slate-950/40 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-200">{check.label}</span>
                                <span className={`h-2.5 w-2.5 rounded-full ${check.ok ? "bg-emerald-400" : check.severity === "soft" ? "bg-amber-400" : "bg-rose-400"}`} />
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs text-slate-400">{check.detail}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <NearTermForecastCard forecast={liveStats?.forecast} />

                    {chartLivePosition ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge className={chartLivePosition.side === "BUY" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}>
                              {chartLivePosition.side === "BUY" ? "LONG" : "SHORT"}
                            </Badge>
                            <span className="text-sm text-slate-400">
                              Entry {livePosition.entry_price} Â· Now {livePosition.current_price}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="rounded-xl bg-rose-500 text-white hover:bg-rose-400"
                            onClick={() => selectedSession && forceClose.mutate(selectedSession.id)}
                            disabled={forceClose.isPending || !selectedSession}
                          >
                            Force close
                          </Button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">PnL</div>
                            <div className={`text-lg font-semibold ${chartLivePosition.unrealized_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {chartLivePosition.unrealized_pnl >= 0 ? "+" : ""}
                              {chartLivePosition.unrealized_pnl.toFixed(2)} ({chartLivePosition.unrealized_pct.toFixed(2)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">Peak</div>
                            <div className="text-lg font-semibold text-slate-200">+{chartLivePosition.peak_pct.toFixed(2)}%</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">Stop at</div>
                            <div className="text-lg font-semibold text-rose-300">{chartLivePosition.stop_price}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">In trade</div>
                            <div className="text-lg font-semibold text-slate-200">
                              {Math.floor(chartLivePosition.seconds_in_trade / 60)}m {chartLivePosition.seconds_in_trade % 60}s
              </div>
            </div>
            {activeMode === "live" && robotRuntimeRed && (
              <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                Live robot start is blocked because backend market feed is red. Evaluator: {runtimeHealth.data?.robot_trade?.evaluator ?? "unknown"}, backend feed: {runtimeHealth.data?.robot_trade?.market_feed ?? "unknown"}. Warnings will auto-repair in the background; hard stale feed still blocks entries.
              </div>
            )}
            {activeMode === "live" && runtimeHealth.data?.robot_trade?.market_feed !== "green" && feed.connected && (
              <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                Chart WebSocket is connected, but backend market feed is not green. Robot live entry will stay blocked to prevent chart/server price mismatch.
              </div>
            )}
          </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800 p-4 space-y-3">
                        {liveStats?.last_decision ? (
                          <>
                            {/* Signal badges row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${liveStats.last_decision.action === "BUY" ? "bg-emerald-500/20 text-emerald-300" : liveStats.last_decision.action === "SELL" ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-400"}`}>
                                {liveStats.last_decision.action ?? "HOLD"}
                              </span>
                              {liveStats.last_decision.pattern && liveStats.last_decision.pattern !== "none" && liveStats.last_decision.pattern !== "Normal Candle" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
                                  {liveStats.last_decision.pattern}
                                </span>
                              )}
                              {liveStats.last_decision.trend_bias && liveStats.last_decision.trend_bias !== "neutral" && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${liveStats.last_decision.trend_bias === "bullish" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                  {liveStats.last_decision.trend_bias} trend
                                </span>
                              )}
                              {liveStats.last_decision.confidence !== undefined && (
                                <span className="ml-auto text-xs font-semibold text-slate-300">{(liveStats.last_decision.confidence * 100).toFixed(0)}% conf</span>
                              )}
                            </div>
                            {/* Momentum + continuation metrics */}
                            {(liveStats.last_decision.momentum_score !== undefined || liveStats.last_decision.continuation_pct !== undefined) && (
                              <div className="grid grid-cols-2 gap-2">
                                {liveStats.last_decision.momentum_score !== undefined && (
                                  <div className="rounded-lg bg-slate-900 px-3 py-2">
                                    <div className="text-xs text-slate-500 mb-1">Momentum</div>
                                    <div className="flex gap-0.5">
                                      {Array.from({length: 5}, (_, i) => (
                                        <div key={i} className={`h-2 flex-1 rounded-sm ${i < (liveStats.last_decision?.momentum_score ?? 0) ? (liveStats.last_decision?.action === "BUY" ? "bg-emerald-500" : "bg-rose-500") : "bg-slate-700"}`} />
                                      ))}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">{liveStats.last_decision.momentum_score}/5 candles</div>
                                  </div>
                                )}
                                {liveStats.last_decision.continuation_pct != null && (
                                  <div className="rounded-lg bg-slate-900 px-3 py-2">
                                    <div className="text-xs text-slate-500 mb-1">Hist. rate</div>
                                    <div className={`text-lg font-bold ${(liveStats.last_decision.continuation_pct ?? 0) >= 60 ? "text-emerald-400" : (liveStats.last_decision.continuation_pct ?? 0) <= 40 ? "text-rose-400" : "text-slate-300"}`}>
                                      {liveStats.last_decision.continuation_pct?.toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-slate-500">past continuations</div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 leading-relaxed">{liveStats.last_decision.reason}</div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">Waiting for a candle-direction signal.</div>
                        )}
                      </div>
                    )}

                    {/* Cooldown / Daily loss status banners */}
                    {liveStats?.cooldown?.active && (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-300">
                        <span className="text-base">â³</span>
                        <div className="flex-1">
                          <span className="font-semibold">Loss cooldown</span>
                          <span className="ml-2 text-xs text-amber-400">
                            {Math.floor((liveStats.cooldown.seconds_left ?? 0) / 60)}m {(liveStats.cooldown.seconds_left ?? 0) % 60}s remaining â€” next trade after cooldown
                          </span>
                        </div>
                        {selectedSessionId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs px-2 py-1 h-auto"
                            disabled={resetDailyLoss.isPending}
                            onClick={() => resetDailyLoss.mutate(selectedSessionId)}
                          >
                            Skip
                          </Button>
                        )}
                      </div>
                    )}
                    {liveStats?.daily_loss?.hit && (
                      <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-300">
                        <span className="text-base mt-0.5">ðŸ›‘</span>
                        <div className="flex-1">
                          <span className="font-semibold">Daily loss limit hit</span>
                          <span className="ml-2 text-xs text-rose-400">
                            ${liveStats.daily_loss.today.toFixed(2)} lost today (limit ${liveStats.daily_loss.limit?.toFixed(2)}). Resumes tomorrow at UTC midnight.
                          </span>
                        </div>
                        {selectedSessionId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs px-2 py-1 h-auto"
                            disabled={resetDailyLoss.isPending}
                            onClick={() => resetDailyLoss.mutate(selectedSessionId)}
                          >
                            Reset now
                          </Button>
                        )}
                      </div>
                    )}
                    {liveStats?.daily_loss && !liveStats.daily_loss.hit && liveStats.daily_loss.limit !== null && (
                      <div className="rounded-xl bg-slate-900 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">Daily loss</span>
                          <span className="text-xs text-slate-400">${liveStats.daily_loss.today.toFixed(2)} / ${liveStats.daily_loss.limit?.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800">
                          <div
                            className={`h-1.5 rounded-full transition-all ${(liveStats.daily_loss.pct ?? 0) >= 80 ? "bg-rose-500" : (liveStats.daily_loss.pct ?? 0) >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, liveStats.daily_loss.pct ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {liveStats?.last_entry_block && !chartLivePosition && (
                      <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-200">
                        <span className="mt-0.5 text-base">!</span>
                        <div className="flex-1">
                          <div className="font-semibold">Entry blocked: {liveStats.last_entry_block.status ?? "safety_guard"}</div>
                          <div className="mt-0.5 text-xs text-amber-300/90">
                            {liveStats.last_entry_block.reason ?? "Robot skipped this entry because a safety guard failed."}
                          </div>
                          {(liveStats.last_entry_block.feed || liveStats.last_entry_block.drift_bps !== undefined) && (
                            <div className="mt-1 text-xs text-amber-400/80">
                              {liveStats.last_entry_block.feed?.age_seconds !== undefined && (
                                <span>Feed age {liveStats.last_entry_block.feed.age_seconds}s / {liveStats.last_entry_block.feed.max_age_seconds}s. </span>
                              )}
                              {liveStats.last_entry_block.drift_bps !== undefined && (
                                <span>Drift {liveStats.last_entry_block.drift_bps} bps / {liveStats.last_entry_block.max_drift_bps} bps.</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Volatility block banner */}
                    {liveStats?.volatility && !liveStats.volatility.tradeable && (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm text-slate-400">
                        <span className="text-base">ðŸ“‰</span>
                        <div className="flex-1">
                          <div className="font-medium text-slate-300">Market too flat â€” skipping entries</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {liveStats.volatility.reason} Â· ATR {liveStats.volatility.atr_pct.toFixed(3)}% Â· BB {liveStats.volatility.bb_width_pct.toFixed(3)}%
                          </div>
                        </div>
                      </div>
                    )}


                    {liveStats && (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-slate-900 p-3">
                          <div className="text-xs text-slate-500">Session PnL</div>
                          <div className={`font-semibold ${liveStats.performance.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {liveStats.performance.total_pnl >= 0 ? "+" : ""}
                            {liveStats.performance.total_pnl.toFixed(2)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-900 p-3">
                          <div className="text-xs text-slate-500">W / L</div>
                          <div className="font-semibold text-slate-200">
                            {liveStats.performance.win_count} / {liveStats.performance.loss_count}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-900 p-3">
                          <div className="text-xs text-slate-500">Win rate</div>
                          <div className="font-semibold text-slate-200">{liveStats.performance.win_rate.toFixed(0)}%</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Active sessions
                    <Badge className="bg-slate-900 text-slate-200">{sessions.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sessions.length === 0 && <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">No robot sessions yet.</div>}

                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`rounded-3xl border p-4 ${selectedSessionId === session.id ? "border-blue-500/50 bg-blue-500/5" : "border-slate-800 bg-slate-900/70"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <button type="button" className="text-left" onClick={() => setSelectedSessionId(session.id)}>
                            <div className="text-lg font-semibold">{session.name}</div>
                            <div className="text-sm text-slate-400">
                              {session.symbol.replaceAll("_", " ")} / {session.timeframe} / ${Number(session.base_stake).toFixed(2)}
                            </div>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={session.mode === "live" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-300"}>
                            {session.mode.toUpperCase()}
                          </Badge>
                          <Badge className={session.status === "RUNNING" ? "bg-emerald-500/10 text-emerald-300" : session.status === "PAUSED" ? "bg-amber-500/10 text-amber-300" : "bg-slate-500/10 text-slate-300"}>
                            {session.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={() => startSession.mutate(session.id)} disabled={actionDisabled || robotRuntimeRed}>
                          Start
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-100" onClick={() => pauseSession.mutate(session.id)}>
                          Pause
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-100" onClick={() => evaluateSession.mutate(session.id)} disabled={actionDisabled}>
                          Run cycle
                        </Button>
                        <Button size="sm" className="rounded-xl bg-rose-500 text-white hover:bg-rose-400" onClick={() => stopSession.mutate(session.id)}>
                          Stop
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-blue-500/40 bg-transparent text-blue-300 hover:bg-blue-500/10"
                          onClick={() => loadSessionIntoForm(session)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-rose-500/40 bg-transparent text-rose-300 hover:bg-rose-500/10"
                          disabled={deleteSession.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete "${session.name}"? Any open position will be closed first.`)) {
                              deleteSession.mutate(session.id, {
                                onSuccess: () => {
                                  if (selectedSessionId === session.id) setSelectedSessionId(undefined);
                                },
                              });
                            }
                          }}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-amber-500/40 bg-transparent text-amber-300 hover:bg-amber-500/10"
                          disabled={resetSession.isPending}
                          title="Clear loss-limit / errors and baseline stats so the bot can start again"
                          onClick={() => resetSession.mutate(session.id)}
                        >
                          Reset
                        </Button>
                      </div>
                      {session.last_error && (
                        <div className="mt-2 text-xs text-amber-300/90">
                          Warning: {session.last_error} - tap <span className="font-semibold">Reset</span> then Start.
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    Runtime
                    <Button
                      size="sm"
                      className="rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      disabled={repairRuntime.isPending}
                      onClick={() => {
                        setRepairOutputOpen(true);
                        repairRuntime.mutate();
                      }}
                    >
                      {repairRuntime.isPending ? "Repairing..." : "Check & repair"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <div className="text-sm text-slate-400">Open robot trades</div>
                    <div className="mt-2 text-lg font-semibold">{sessionStatus.data?.active_trades ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <div className="text-sm text-slate-400">Wins / Losses</div>
                    <div className="mt-2 text-lg font-semibold">
                      {(sessionStatus.data?.session.win_count ?? selectedSession?.win_count ?? 0)} / {(sessionStatus.data?.session.loss_count ?? selectedSession?.loss_count ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <div className="text-sm text-slate-400">Loss streak</div>
                    <div className="mt-2 text-lg font-semibold">{sessionStatus.data?.session.consecutive_losses ?? selectedSession?.consecutive_losses ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <div className="text-sm text-slate-400">Current PnL</div>
                    <div className="mt-2 text-lg font-semibold">
                      {sessionPnl >= 0 ? "+" : ""}
                      {sessionPnl.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4 md:col-span-2">
                    <div className="text-sm text-slate-400">Last note</div>
                    <div className="mt-2 text-sm text-slate-200">{sessionStatus.data?.session.last_error ?? selectedSession?.last_error ?? "No stop conditions hit."}</div>
                  </div>
                  {(repairRuntime.data || repairRuntime.error || repairOutputOpen) && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-200">Repair console</div>
                          <div className="text-xs text-slate-500">
                            Safe fixed commands only. No arbitrary root terminal is exposed.
                          </div>
                        </div>
                        {repairRuntime.data && (
                          <Badge className={repairRuntime.data.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}>
                            exit {repairRuntime.data.exit_code}
                          </Badge>
                        )}
                      </div>
                      <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-slate-300">
                        {repairRuntime.isPending
                          ? "Running runtime doctor..."
                          : repairRuntime.error
                            ? repairRuntime.error.message
                            : repairRuntime.data?.output || "No output yet."}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"
                    onClick={exportRobotDealsCsv}
                    disabled={recentTrades.length === 0}
                  >
                    Export CSV
                  </Button>
                </div>
                <TradeDealList title="Robot deals" trades={recentTrades} emptyMessage="Robot settlements will appear here after expiry." />
              </div>
            </div>
          </div>
        </div>

        <MobileTradeNav />
      </div>
    </AppShell>
  );
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function secondsSince(timestamp?: string | null): number | null {
  if (!timestamp) return null;
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 1000);
}
