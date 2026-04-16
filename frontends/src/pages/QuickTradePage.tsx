import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
import { QuickTradeChartCard } from "@/components/trading/QuickTradeChartCard";
import { SignalSummaryCard } from "@/components/trading/SignalSummaryCard";
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
import { useUpdateTradingSettings } from "@/hooks/useTradingMode";
import {
  usePlaceQuickTrade,
  useQuickTradeActive,
  useQuickTradeChart,
  useQuickTradeHistory,
  useQuickTradeMetadata,
  useSettleQuickTrades,
} from "@/hooks/useQuickTrade";

export default function QuickTradePage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: balances = [] } = useBalances(workspaceId);
  const { data: metadata } = useQuickTradeMetadata(workspaceId);
  const updateTradingSettings = useUpdateTradingSettings(workspaceId);

  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1m");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState(10);
  const [chartType, setChartType] = useState("area");
  const [indicatorSet, setIndicatorSet] = useState<string[]>(["RSI", "MACD"]);
  const [selectedProvider, setSelectedProvider] = useState("binance");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("auto");

  const tradingState = metadata?.trading_state;
  const activeMode = tradingState?.mode ?? "paper";
  const providerCatalog = Object.values(tradingState?.provider_catalog ?? {});
  const providerIntegrations = (tradingState?.active_integrations ?? []).filter(
    (integration) => integration.provider_key === selectedProvider
  );

  useEffect(() => {
    if (!metadata) return;

    if (!metadata.symbols.some((option) => option.symbol === symbol)) {
      setSymbol(metadata.symbols[0]?.symbol ?? "");
    }
    if (!metadata.timeframes.some((option) => option.key === timeframe)) {
      setTimeframe(metadata.timeframes[0]?.key ?? metadata.quick_trade.default_timeframe);
    }
    if (!metadata.durations.some((option) => option.seconds === duration)) {
      setDuration(metadata.durations[0]?.seconds ?? metadata.quick_trade.default_duration);
    }
    if (!metadata.chart_types.some((option) => option.key === chartType)) {
      setChartType(metadata.chart_types[0]?.key ?? "area");
    }

    const allowedIndicators = new Set(metadata.quick_trade.allowed_indicators);
    setIndicatorSet((current) => {
      const filtered = current.filter((indicator) => allowedIndicators.has(indicator));
      if (filtered.length > 0) return filtered;
      return (metadata.quick_trade.allowed_indicators ?? []).slice(0, 2);
    });

    const provider = tradingState?.preferred_provider ?? metadata.quick_trade.default_provider ?? "binance";
    setSelectedProvider(provider);
    setSelectedIntegrationId(tradingState?.preferred_integration_id ?? "auto");
  }, [chartType, duration, metadata, symbol, timeframe, tradingState]);

  const chartQuery = useQuickTradeChart({
    workspaceId,
    symbol,
    timeframe,
    chartType,
    indicatorSet,
    mode: activeMode,
    provider: selectedProvider,
    integrationId: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
  });
  const activeTrades = useQuickTradeActive(workspaceId);
  const historyTrades = useQuickTradeHistory(workspaceId, undefined, undefined, 6);
  const placeQuickTrade = usePlaceQuickTrade();
  const settleTrades = useSettleQuickTrades();

  useEffect(() => {
    const timer = window.setInterval(() => {
      settleTrades.mutate(25);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [settleTrades]);

  const selectedSymbol = metadata?.symbols.find((option) => option.symbol === symbol);
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
  const amountStep = useMemo(() => Math.max(1, Math.round(stake >= 25 ? 5 : 1)), [stake]);
  const liveReady = Boolean(tradingState?.live_ready);
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

  const toggleIndicator = (key: string, checked: boolean) => {
    setIndicatorSet((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((entry) => entry !== key)
    );
  };

  const stepDuration = (direction: "prev" | "next") => {
    const options = metadata?.durations ?? [];
    const currentIndex = options.findIndex((option) => option.seconds === duration);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = direction === "next" ? Math.min(options.length - 1, safeIndex + 1) : Math.max(0, safeIndex - 1);
    setDuration(options[nextIndex]?.seconds ?? duration);
  };

  const placeTrade = (side: "buy" | "sell") => {
    if (!workspaceId || !symbol) return;

    placeQuickTrade.mutate({
      workspace_id: workspaceId,
      symbol,
      side,
      stake_amount: stake,
      timeframe,
      expiry_seconds: duration,
      mode: activeMode,
      provider: selectedProvider,
      integration_id: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
      indicator_set: indicatorSet,
    });
  };

  const tradeButtonsDisabled =
    placeQuickTrade.isPending ||
    updateTradingSettings.isPending ||
    !workspaceId ||
    !symbol ||
    (activeMode === "live" && !liveReady);

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,#020617_0%,#020617_35%,#071120_100%)] text-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 md:px-6">
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/80 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.45)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.28em] text-slate-500">
                  {activeMode === "live" ? "Live timed trade" : "Paper quick trade"}
                </div>
                <div className="mt-2 text-3xl font-semibold">
                  {activeMode === "live" ? "Live wallet" : "Demo account"} {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {activeMode === "live"
                    ? "Live mode opens Binance timed futures positions and closes them automatically at expiry. No guaranteed returns."
                    : "Paper mode uses the shared wallet, ledger, and expiry settlement engine. No guaranteed returns."}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Mode</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      className={activeMode === "paper" ? "bg-slate-100 text-slate-950 hover:bg-slate-200" : "bg-slate-950 text-slate-300"}
                      disabled={updateTradingSettings.isPending}
                      onClick={() => updateMode("paper")}
                    >
                      Paper
                    </Button>
                    <Button
                      variant="ghost"
                      className={activeMode === "live" ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-slate-950 text-slate-300"}
                      disabled={updateTradingSettings.isPending}
                      onClick={() => updateMode("live")}
                    >
                      Live
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
                  <Select
                    value={selectedProvider}
                    onValueChange={(value) => {
                      const nextIntegration = (tradingState?.active_integrations ?? []).find(
                        (integration) => integration.provider_key === value
                      )?.id;
                      setSelectedProvider(value);
                      setSelectedIntegrationId(nextIntegration ?? "auto");
                      updateMode(activeMode, value, nextIntegration ?? "auto");
                    }}
                  >
                    <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(providerCatalog.length > 0 ? providerCatalog : [{ key: "binance", label: "Binance" }]).map((provider: any) => (
                        <SelectItem key={provider.key} value={provider.key}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge className={activeMode === "live" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-300"}>
                {activeMode.toUpperCase()}
              </Badge>
              <Badge className="bg-blue-500/10 text-blue-300">{selectedProvider.toUpperCase()}</Badge>
              <Badge className="bg-slate-500/10 text-slate-300">{selectedIntegrationLabel}</Badge>
              {activeMode === "live" && (
                <Badge className={liveReady ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}>
                  {liveReady ? "Live ready" : "Connection required"}
                </Badge>
              )}
              <Button
                className="rounded-2xl bg-emerald-500 px-6 text-slate-950 hover:bg-emerald-400"
                onClick={() => navigate("/wallet")}
              >
                Deposit / Wallet
              </Button>
            </div>

            {activeMode === "live" && !liveReady && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                {tradingState?.live_ready_reason ?? "Connect an active Binance integration before opening live trades."}
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardContent className="grid gap-3 p-4 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-400">Asset</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue placeholder="Choose symbol" />
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
                    <Label className="text-slate-400">Chart type</Label>
                    <Select value={chartType} onValueChange={setChartType}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(metadata?.chart_types ?? []).map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-400">Timeframe</Label>
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
                </CardContent>
              </Card>

              <QuickTradeChartCard
                symbolLabel={selectedSymbol?.display ?? symbol.replaceAll("_", " ")}
                chartType={chartType}
                chart={chartQuery.data}
                loading={chartQuery.isLoading}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Duration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-3">
                      <Button variant="ghost" className="rounded-2xl text-2xl text-slate-100" onClick={() => stepDuration("prev")}>
                        -
                      </Button>
                      <div className="text-center">
                        <div className="text-2xl font-semibold">
                          {metadata?.durations.find((entry) => entry.seconds === duration)?.label ?? `${duration}s`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {activeMode === "live" ? "Auto-close window" : "Expiry window"}
                        </div>
                      </div>
                      <Button variant="ghost" className="rounded-2xl text-2xl text-slate-100" onClick={() => stepDuration("next")}>
                        +
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Stake</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-3">
                      <Button
                        variant="ghost"
                        className="rounded-2xl text-2xl text-slate-100"
                        onClick={() => setStake((current) => Math.max(1, current - amountStep))}
                      >
                        -
                      </Button>
                      <div className="text-center">
                        <div className="text-2xl font-semibold">${stake.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">Managed exposure</div>
                      </div>
                      <Button
                        variant="ghost"
                        className="rounded-2xl text-2xl text-slate-100"
                        onClick={() => setStake((current) => current + amountStep)}
                      >
                        +
                      </Button>
                    </div>
                    <Input
                      type="number"
                      min={metadata?.quick_trade.min_stake ?? 1}
                      max={metadata?.quick_trade.max_stake ?? 500}
                      value={stake}
                      onChange={(event) => setStake(Number(event.target.value || 0))}
                      className="border-slate-800 bg-slate-900 text-slate-100"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  size="lg"
                  className="h-16 rounded-3xl bg-rose-500 text-lg font-semibold text-white hover:bg-rose-400"
                  disabled={tradeButtonsDisabled}
                  onClick={() => placeTrade("sell")}
                >
                  Sell / Down
                </Button>
                <Button
                  size="lg"
                  className="h-16 rounded-3xl bg-emerald-500 text-lg font-semibold text-slate-950 hover:bg-emerald-400"
                  disabled={tradeButtonsDisabled}
                  onClick={() => placeTrade("buy")}
                >
                  Buy / Up
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <SignalSummaryCard signal={chartQuery.data?.signal_preview} />

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-lg">Technical indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(metadata?.indicators ?? []).filter((item) => item.key !== "HEIKIN_ASHI").map((indicator) => {
                    const checked = indicatorSet.includes(indicator.key);
                    return (
                      <label
                        key={indicator.key}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3"
                      >
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleIndicator(indicator.key, Boolean(value))} />
                        <div>
                          <div className="font-medium text-slate-100">{indicator.label}</div>
                          <div className="text-sm text-slate-400">{indicator.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-lg">Trade context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
                    <span>Execution</span>
                    <Badge className="bg-blue-500/10 text-blue-300">
                      {activeMode === "live" ? "Timed futures" : "Paper expiry"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
                    <span>{activeMode === "live" ? "Venue" : "Payout"}</span>
                    <span>
                      {activeMode === "live"
                        ? `${selectedProvider.toUpperCase()} / ${selectedIntegrationLabel}`
                        : `${((selectedSymbol?.payout_rate ?? 0.91) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
                    <span>Available balance</span>
                    <span>
                      {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
                    <span>Mode</span>
                    <span>{activeMode.toUpperCase()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TradeDealList title="Active trades" trades={activeTrades.data ?? []} emptyMessage="No active quick trades on this account." />
            <TradeDealList title="Recent history" trades={historyTrades.data ?? []} emptyMessage="Settled quick trades will appear here." />
          </div>
        </div>

        <MobileTradeNav />
      </div>
    </AppShell>
  );
}
