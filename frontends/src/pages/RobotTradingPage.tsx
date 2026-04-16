import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
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
import { useQuickTradeMetadata, useSettleQuickTrades } from "@/hooks/useQuickTrade";
import {
  useCreateRobotSession,
  useEvaluateRobotSession,
  usePauseRobotSession,
  useRobotSessions,
  useRobotSessionStatus,
  useStartRobotSession,
  useStopRobotSession,
} from "@/hooks/useRobotTrading";

export default function RobotTradingPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: balances = [] } = useBalances(workspaceId);
  const { data: riskProfiles = [] } = useRiskProfiles(workspaceId);
  const { data: metadata } = useQuickTradeMetadata(workspaceId);
  const updateTradingSettings = useUpdateTradingSettings(workspaceId);

  const sessionsQuery = useRobotSessions(workspaceId);
  const sessions = sessionsQuery.data ?? [];
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const sessionStatus = useRobotSessionStatus(selectedSessionId);

  const createSession = useCreateRobotSession(workspaceId);
  const startSession = useStartRobotSession();
  const pauseSession = usePauseRobotSession();
  const stopSession = useStopRobotSession();
  const evaluateSession = useEvaluateRobotSession();
  const settleTrades = useSettleQuickTrades();

  const [name, setName] = useState("Binance robot");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1m");
  const [expirySeconds, setExpirySeconds] = useState(60);
  const [baseStake, setBaseStake] = useState(10);
  const [strategyProfile, setStrategyProfile] = useState("balanced");
  const [confidenceThreshold, setConfidenceThreshold] = useState(60);
  const [maxActiveTrades, setMaxActiveTrades] = useState(2);
  const [profitTarget, setProfitTarget] = useState(20);
  const [lossLimit, setLossLimit] = useState(20);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(3);
  const [riskProfileId, setRiskProfileId] = useState<string>("none");
  const [indicatorSet, setIndicatorSet] = useState<string[]>(["RSI", "MACD"]);
  const [selectedProvider, setSelectedProvider] = useState("binance");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("auto");

  const tradingState = metadata?.trading_state;
  const activeMode = tradingState?.mode ?? "paper";
  const liveReady = Boolean(tradingState?.live_ready);
  const providerCatalog = Object.values(tradingState?.provider_catalog ?? {});
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      settleTrades.mutate(25);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [settleTrades]);

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
  const recentTrades = sessionStatus.data?.recent_trades ?? [];
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

  const createRobot = () => {
    if (!workspaceId) return;

    createSession.mutate({
      name,
      symbol,
      timeframe,
      expiry_seconds: expirySeconds,
      indicator_set: indicatorSet,
      strategy_profile: strategyProfile,
      base_stake: baseStake,
      profit_target: profitTarget,
      loss_limit: lossLimit,
      max_consecutive_losses: maxConsecutiveLosses,
      max_active_trades: maxActiveTrades,
      confidence_threshold: confidenceThreshold,
      risk_profile_id: riskProfileId === "none" ? undefined : riskProfileId,
      provider: selectedProvider,
      integration_id: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
    });
  };

  const toggleIndicator = (key: string, checked: boolean) => {
    setIndicatorSet((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((entry) => entry !== key)
    );
  };

  const actionDisabled = activeMode === "live" && !liveReady;

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_26%),linear-gradient(180deg,#020617_0%,#071120_100%)] text-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 md:px-6">
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Robot trading</div>
                <div className="mt-2 text-3xl font-semibold">
                  {activeMode === "live" ? "Live wallet" : "Paper balance"} {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {activeMode === "live"
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
                <Badge className={activeMode === "live" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-300"}>
                  {activeMode.toUpperCase()}
                </Badge>
                <Badge className="bg-blue-500/10 text-blue-300">{selectedProvider.toUpperCase()}</Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
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

            {activeMode === "live" && !liveReady && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                {tradingState?.live_ready_reason ?? "Connect an active Binance integration before starting live robots."}
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-slate-800 bg-slate-950 text-slate-50">
              <CardHeader>
                <CardTitle>New robot session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} className="border-slate-800 bg-slate-900 text-slate-100" />
                </div>

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
                  <div className="space-y-2">
                    <Label>Base stake</Label>
                    <Input type="number" min={1} value={baseStake} onChange={(event) => setBaseStake(Number(event.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
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

                <Button className="h-14 w-full rounded-3xl bg-blue-500 text-lg font-semibold hover:bg-blue-400" onClick={createRobot} disabled={createSession.isPending || updateTradingSettings.isPending || actionDisabled}>
                  {createSession.isPending ? "Saving..." : "Save robot session"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
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
                        <Button size="sm" className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400" onClick={() => startSession.mutate(session.id)} disabled={actionDisabled}>
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
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader>
                  <CardTitle>Runtime</CardTitle>
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
                </CardContent>
              </Card>

              <TradeDealList title="Robot deals" trades={recentTrades} emptyMessage="Robot settlements will appear here after expiry." />
            </div>
          </div>
        </div>

        <MobileTradeNav />
      </div>
    </AppShell>
  );
}
