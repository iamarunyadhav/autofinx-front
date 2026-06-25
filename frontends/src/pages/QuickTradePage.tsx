import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
import { RobotLiveChart } from "@/components/trading/RobotLiveChart";
import { SignalSummaryCard } from "@/components/trading/SignalSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownRight, ArrowUpRight, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
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
  type QuickTradeRecord,
} from "@/hooks/useQuickTrade";
import { useRobotCandleFeed } from "@/hooks/useRobotCandleFeed";
import type { ChartMarker } from "@/components/trading/RobotLiveChart";
import { cn } from "@/lib/utils";

function useCountdown(expiresAt: string | undefined) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!expiresAt) { setSecs(0); return; }
    const tick = () => setSecs(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);
  return secs;
}

function CountdownRing({ secs, totalSecs }: { secs: number; totalSecs: number }) {
  const pct = totalSecs > 0 ? (secs / totalSecs) * 100 : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = secs <= 10 ? "#f43f5e" : secs <= 30 ? "#f59e0b" : "#10b981";
  return (
    <svg width="52" height="52" className="-rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s linear, stroke 0.5s" }}
      />
      <text x="26" y="26" textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" style={{ fill: color, fontSize: 10, fontWeight: 700, transform: "rotate(90deg)", transformOrigin: "26px 26px" }}>
        {secs}s
      </text>
    </svg>
  );
}

interface LiveTradeCardProps {
  trade: QuickTradeRecord;
  currentPrice: number | undefined;
}

function LiveTradeCard({ trade, currentPrice }: LiveTradeCardProps) {
  const countdown = useCountdown(trade.expires_at);
  const totalSecs = trade.expiry_seconds ?? 60;

  const livePnl = useMemo(() => {
    if (!currentPrice || trade.symbol !== trade.symbol) return null;
    const entry = Number(trade.entry_price);
    if (!entry) return null;
    const pct = trade.side === "buy"
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;
    return { pct, value: (pct / 100) * Number(trade.stake_amount) };
  }, [currentPrice, trade]);

  const winning = (livePnl?.pct ?? 0) >= 0;
  const isBuy = trade.side === "buy";

  return (
    <div className={cn(
      "rounded-3xl border p-4 transition-all",
      winning ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/25 bg-rose-500/5"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CountdownRing secs={countdown} totalSecs={totalSecs} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-100">{trade.symbol.replaceAll("_", " ")}</span>
              <Badge className={cn("text-xs", isBuy ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>
                {isBuy ? "↑ BUY" : "↓ SELL"}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Entry ${Number(trade.entry_price).toFixed(Number(trade.entry_price) > 100 ? 2 : 4)} · Stake ${Number(trade.stake_amount).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="text-right">
          {livePnl ? (
            <>
              <div className={cn("text-lg font-bold", winning ? "text-emerald-300" : "text-rose-300")}>
                {winning ? "+" : ""}{livePnl.pct.toFixed(3)}%
              </div>
              <div className={cn("text-sm font-medium", winning ? "text-emerald-400" : "text-rose-400")}>
                {winning ? "+" : ""}{livePnl.value.toFixed(3)} USD
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Calculating...</div>
          )}
          <div className="mt-0.5 text-xs text-slate-600">
            {formatDistanceToNowStrict(new Date(trade.entry_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryTradeCard({ trade }: { trade: QuickTradeRecord }) {
  const pnl = Number(trade.profit_loss || 0);
  const won = pnl > 0;
  return (
    <div className={cn(
      "rounded-3xl border p-4",
      won ? "border-emerald-500/20 bg-emerald-500/5" : pnl < 0 ? "border-rose-500/20 bg-rose-500/5" : "border-slate-800 bg-slate-900/50"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-lg",
            won ? "bg-emerald-500/15 text-emerald-300" : pnl < 0 ? "bg-rose-500/15 text-rose-300" : "bg-slate-800 text-slate-400"
          )}>
            {trade.side === "buy" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-semibold text-slate-100">{trade.symbol.replaceAll("_", " ")}</div>
            <div className="text-xs text-slate-500">
              {trade.timeframe} · ${Number(trade.stake_amount).toFixed(2)} stake
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-base font-bold", won ? "text-emerald-300" : pnl < 0 ? "text-rose-300" : "text-slate-400")}>
            {won ? "+" : ""}{pnl.toFixed(2)}
          </div>
          <div className="text-xs text-slate-600">
            {formatDistanceToNowStrict(new Date(trade.settled_at ?? trade.entry_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [indicatorSet, setIndicatorSet] = useState<string[]>(["RSI", "MACD"]);
  const [selectedProvider, setSelectedProvider] = useState("binance");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("auto");

  const tradingState = metadata?.trading_state;
  const activeMode = tradingState?.mode ?? "paper";
  const providerCatalog = Object.values(tradingState?.provider_catalog ?? {});
  const providerIntegrations = (tradingState?.active_integrations ?? []).filter(
    (i) => i.provider_key === selectedProvider
  );

  useEffect(() => {
    if (!metadata) return;
    if (!metadata.symbols.some((o) => o.symbol === symbol)) setSymbol(metadata.symbols[0]?.symbol ?? "");
    if (!metadata.timeframes.some((o) => o.key === timeframe)) setTimeframe(metadata.timeframes[0]?.key ?? metadata.quick_trade.default_timeframe);
    if (!metadata.durations.some((o) => o.seconds === duration)) setDuration(metadata.durations[0]?.seconds ?? metadata.quick_trade.default_duration);
    const allowed = new Set(metadata.quick_trade.allowed_indicators);
    setIndicatorSet((cur) => {
      const f = cur.filter((i) => allowed.has(i));
      return f.length > 0 ? f : (metadata.quick_trade.allowed_indicators ?? []).slice(0, 2);
    });
    setSelectedProvider(tradingState?.preferred_provider ?? metadata.quick_trade.default_provider ?? "binance");
    setSelectedIntegrationId(tradingState?.preferred_integration_id ?? "auto");
  }, [duration, metadata, symbol, timeframe, tradingState]);

  // Robot Trade signal analysis — refreshes every 5 s
  const chartQuery = useQuickTradeChart({
    workspaceId,
    symbol,
    timeframe,
    chartType: "candles",
    indicatorSet,
    mode: activeMode,
    provider: selectedProvider,
    integrationId: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
  });

  // Live Binance WebSocket feed
  const feed = useRobotCandleFeed(symbol, timeframe, !!symbol);
  const currentPrice = feed.currentCandle?.close ?? chartQuery.data?.quote?.price;

  const activeTrades = useQuickTradeActive(workspaceId);
  const historyTrades = useQuickTradeHistory(workspaceId, undefined, undefined, 8);
  const placeQuickTrade = usePlaceQuickTrade();
  const settleTrades = useSettleQuickTrades();

  useEffect(() => {
    const t = window.setInterval(() => { settleTrades.mutate(25); }, 5000);
    return () => window.clearInterval(t);
  }, [settleTrades]);

  // Active trade for current symbol — drives chart lines + P&L overlay
  const activeTradeForSymbol = useMemo(
    () => (activeTrades.data ?? []).find((t) => t.symbol === symbol && t.status === "open"),
    [activeTrades.data, symbol]
  );

  // Live unrealized P&L — shown on chart and in signal card
  const livePnl = useMemo(() => {
    if (!activeTradeForSymbol || !currentPrice) return null;
    const entry = Number(activeTradeForSymbol.entry_price);
    if (!entry) return null;
    const pct = activeTradeForSymbol.side === "buy"
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;
    return {
      side: activeTradeForSymbol.side === "buy" ? "BUY" as const : "SELL" as const,
      pct,
      value: (pct / 100) * Number(activeTradeForSymbol.stake_amount),
    };
  }, [activeTradeForSymbol, currentPrice]);

  // Chart entry markers for all open trades of this symbol
  const chartMarkers = useMemo<ChartMarker[]>(
    () => (activeTrades.data ?? [])
      .filter((t) => t.symbol === symbol && t.status === "open" && t.entry_at)
      .map((t) => ({
        time: Math.floor(new Date(t.entry_at).getTime() / 1000),
        side: t.side === "buy" ? "BUY" : "SELL",
        text: `$${Number(t.stake_amount).toFixed(0)}`,
      })),
    [activeTrades.data, symbol]
  );

  const signal = chartQuery.data?.signal_preview;
  const signalDir = signal?.direction ?? "neutral";
  const confidence = signal?.confidence ?? 0;
  const isBuy = signalDir === "buy";
  const isSell = signalDir === "sell";

  const selectedSymbol = metadata?.symbols.find((o) => o.symbol === symbol);
  const selectedBalance = useMemo(() => {
    if (activeMode === "live") {
      return (
        balances.find((a: any) => {
          const prov = String(a?.metadata?.provider ?? "").toLowerCase();
          const intId = String(a?.metadata?.integration_id ?? "");
          return String(a?.type ?? "").toLowerCase() === "exchange" &&
            (prov === "" || prov === selectedProvider) &&
            (selectedIntegrationId === "auto" || intId === selectedIntegrationId);
        }) ??
        balances.find((a: any) => String(a?.type ?? "").toLowerCase() === "exchange") ??
        balances[0]
      );
    }
    return (
      balances.find((a: any) => String(a?.wallet_type ?? "").toLowerCase() === "paper") ??
      balances.find((a: any) => String(a?.type ?? "").toLowerCase() === "cash" && String(a?.currency ?? "").toUpperCase() === "USD") ??
      balances[0]
    );
  }, [activeMode, balances, selectedIntegrationId, selectedProvider]);

  const balance = Number(selectedBalance?.available ?? selectedBalance?.balance ?? 0);
  const amountStep = useMemo(() => Math.max(1, Math.round(stake >= 25 ? 5 : 1)), [stake]);
  const liveReady = Boolean(tradingState?.live_ready);
  const integrationLabel =
    providerIntegrations.find((i) => i.id === selectedIntegrationId)?.display_name ??
    tradingState?.preferred_integration_label ?? "Auto";

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

  const stepDuration = (dir: "prev" | "next") => {
    const opts = metadata?.durations ?? [];
    const idx = opts.findIndex((o) => o.seconds === duration);
    const safe = idx >= 0 ? idx : 0;
    setDuration(opts[dir === "next" ? Math.min(opts.length - 1, safe + 1) : Math.max(0, safe - 1)]?.seconds ?? duration);
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
    placeQuickTrade.isPending || updateTradingSettings.isPending || !workspaceId || !symbol ||
    (activeMode === "live" && !liveReady);

  const priceDisplay = currentPrice
    ? `$${currentPrice.toFixed(currentPrice > 100 ? 2 : 4)}`
    : "—";

  const allActiveTrades = activeTrades.data ?? [];
  const activeForSymbol = allActiveTrades.filter((t) => t.symbol === symbol && t.status === "open");
  const activeOther = allActiveTrades.filter((t) => t.symbol !== symbol && t.status === "open");

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,#020617_0%,#020617_35%,#071120_100%)] text-slate-50">
        <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 pt-4 md:px-6">

          {/* ── Top bar: balance + mode + provider ── */}
          <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  {activeMode === "live" ? "Live timed trade" : "Paper quick trade"}
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {activeMode === "live"
                    ? "Opens Binance futures position · auto-closes at expiry"
                    : "Paper wallet · no real funds at risk"}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Mode</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" size="sm" className={activeMode === "paper" ? "bg-slate-100 text-slate-950" : "bg-slate-950 text-slate-300"} disabled={updateTradingSettings.isPending} onClick={() => updateMode("paper")}>Paper</Button>
                    <Button variant="ghost" size="sm" className={activeMode === "live" ? "bg-emerald-500 text-slate-950" : "bg-slate-950 text-slate-300"} disabled={updateTradingSettings.isPending} onClick={() => updateMode("live")}>Live</Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
                  <Select value={selectedProvider} onValueChange={(v) => {
                    const next = (tradingState?.active_integrations ?? []).find((i) => i.provider_key === v)?.id;
                    setSelectedProvider(v);
                    setSelectedIntegrationId(next ?? "auto");
                    updateMode(activeMode, v, next ?? "auto");
                  }}>
                    <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(providerCatalog.length > 0 ? providerCatalog : [{ key: "binance", label: "Binance" }]).map((p: any) => (
                        <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Account</div>
                  <Select value={selectedIntegrationId} onValueChange={(v) => { setSelectedIntegrationId(v); updateMode(activeMode, selectedProvider, v); }}>
                    <SelectTrigger className="border-slate-800 bg-slate-950 text-slate-100 h-9"><SelectValue placeholder="Auto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      {providerIntegrations.map((i) => <SelectItem key={i.id} value={i.id}>{i.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={activeMode === "live" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}>{activeMode.toUpperCase()}</Badge>
              <Badge className="bg-blue-500/10 text-blue-300">{selectedProvider.toUpperCase()}</Badge>
              <Badge className="bg-slate-700/50 text-slate-300">{integrationLabel}</Badge>
              {activeMode === "live" && (
                <Badge className={liveReady ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}>
                  {liveReady ? "Live ready" : "Connection required"}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                {feed.connected
                  ? <><Wifi className="h-3.5 w-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Backend WS · {feed.latencyMs}ms</span></>
                  : <><WifiOff className="h-3.5 w-3.5 text-slate-600" /><span className="text-xs text-slate-600">Connecting...</span></>
                }
              </div>
              <Button size="sm" className="rounded-2xl bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400" onClick={() => navigate("/wallet")}>Deposit</Button>
            </div>
            {activeMode === "live" && !liveReady && (
              <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-200">
                {tradingState?.live_ready_reason ?? "Connect a Binance integration to open live trades."}
              </div>
            )}
          </div>

          {/* ── Signal Banner ── */}
          <div className={cn(
            "rounded-[24px] border p-5 transition-all duration-500",
            isBuy ? "border-emerald-500/30 bg-emerald-500/8" : isSell ? "border-rose-500/30 bg-rose-500/8" : "border-slate-800 bg-slate-950/60"
          )}>
            <div className="flex flex-wrap items-center gap-5">
              {/* Signal label */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  "text-5xl font-black",
                  isBuy ? "text-emerald-300" : isSell ? "text-rose-300" : "text-slate-500"
                )}>
                  {isBuy ? "↑ BUY" : isSell ? "↓ SELL" : "WAIT"}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">Robot Signal · {symbol || "—"} · {timeframe}</div>
                  <div className="mt-0.5 font-mono text-xl text-slate-200">{priceDisplay}</div>
                  {chartQuery.isFetching && <div className="mt-0.5 text-xs text-slate-600">Refreshing signal...</div>}
                </div>
              </div>

              {/* Confidence bar */}
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Confidence</span>
                  <span className={cn(isBuy ? "text-emerald-400" : isSell ? "text-rose-400" : "text-slate-400")}>{confidence}%</span>
                </div>
                <Progress value={confidence} className="h-2.5 bg-slate-800" />
                <div className="flex gap-3 text-xs text-slate-500">
                  <span className="text-emerald-400">▲ {signal?.bullish_score ?? 0}</span>
                  <span>{signal?.neutral_score ?? 0} neutral</span>
                  <span className="text-rose-400">▼ {signal?.bearish_score ?? 0}</span>
                </div>
                {(signal?.reasons ?? []).length > 0 && (
                  <div className="text-xs text-slate-500 line-clamp-1">{signal!.reasons.slice(0, 2).join(" · ")}</div>
                )}
              </div>

              {/* Live P&L when trade is open */}
              {livePnl && (
                <div className={cn(
                  "rounded-2xl border px-4 py-3 text-right",
                  livePnl.pct >= 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
                )}>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Unrealized P&L</div>
                  <div className={cn("text-2xl font-bold", livePnl.pct >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    {livePnl.pct >= 0 ? "+" : ""}{livePnl.pct.toFixed(3)}%
                  </div>
                  <div className={cn("text-sm", livePnl.pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {livePnl.value >= 0 ? "+" : ""}{livePnl.value.toFixed(3)} USD
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">

              {/* Controls: symbol + timeframe */}
              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-slate-500">Asset</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100"><SelectValue placeholder="Choose symbol" /></SelectTrigger>
                      <SelectContent>
                        {(metadata?.symbols ?? []).map((o) => <SelectItem key={o.symbol} value={o.symbol}>{o.display}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Timeframe</Label>
                    <Select value={timeframe} onValueChange={setTimeframe}>
                      <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(metadata?.timeframes ?? []).map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Live candlestick chart */}
              <Card className="overflow-hidden border-slate-800 bg-slate-950 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
                <CardHeader className="border-b border-slate-900 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] pb-3 pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-100">
                        {selectedSymbol?.display ?? symbol.replaceAll("_", " ")}
                      </div>
                      <div className="mt-0.5 font-mono text-sm text-slate-400">{priceDisplay}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn("h-2 w-2 rounded-full", feed.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                      <span className="text-slate-500">{feed.source === "backend" ? "Backend WS" : feed.source === "sse" ? "SSE" : "—"}</span>
                      {activeTradeForSymbol && (
                        <span className={cn(
                          "ml-2 rounded-lg px-2 py-0.5 font-mono font-semibold",
                          activeTradeForSymbol.side === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                        )}>
                          {activeTradeForSymbol.side.toUpperCase()} open
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {feed.candles.length === 0 ? (
                    <div className="flex h-[360px] items-center justify-center flex-col gap-2 text-slate-600">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
                      <span className="text-sm">{feed.connected ? "Loading candles..." : "Connecting to backend feed..."}</span>
                    </div>
                  ) : (
                    <RobotLiveChart
                      candles={feed.candles}
                      entryPrice={activeTradeForSymbol?.entry_price ?? null}
                      side={activeTradeForSymbol ? (activeTradeForSymbol.side === "buy" ? "BUY" : "SELL") : null}
                      markers={chartMarkers}
                      pnl={livePnl ?? undefined}
                      height={360}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Duration + Stake */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Duration</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-3">
                      <Button variant="ghost" className="h-10 w-10 rounded-full text-2xl text-slate-100" onClick={() => stepDuration("prev")}>-</Button>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{metadata?.durations.find((e) => e.seconds === duration)?.label ?? `${duration}s`}</div>
                        <div className="text-xs text-slate-500">{activeMode === "live" ? "Auto-close" : "Expiry"}</div>
                      </div>
                      <Button variant="ghost" className="h-10 w-10 rounded-full text-2xl text-slate-100" onClick={() => stepDuration("next")}>+</Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Stake</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-3">
                      <Button variant="ghost" className="h-10 w-10 rounded-full text-2xl text-slate-100" onClick={() => setStake((c) => Math.max(1, c - amountStep))}>-</Button>
                      <div className="text-center">
                        <div className="text-2xl font-bold">${stake.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">
                          Bal: {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                        </div>
                      </div>
                      <Button variant="ghost" className="h-10 w-10 rounded-full text-2xl text-slate-100" onClick={() => setStake((c) => c + amountStep)}>+</Button>
                    </div>
                    <Input type="number" min={metadata?.quick_trade.min_stake ?? 1} max={metadata?.quick_trade.max_stake ?? 500} value={stake} onChange={(e) => setStake(Number(e.target.value || 0))} className="border-slate-800 bg-slate-900 text-slate-100" />
                  </CardContent>
                </Card>
              </div>

              {/* BUY / SELL */}
              <div className="grid gap-4 md:grid-cols-2">
                <Button size="lg"
                  className={cn(
                    "h-16 rounded-3xl text-lg font-bold transition-all duration-200",
                    isSell
                      ? "bg-rose-500 text-white ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_30px_rgba(244,63,94,0.45)] hover:bg-rose-400"
                      : "bg-rose-500 text-white hover:bg-rose-400"
                  )}
                  disabled={tradeButtonsDisabled}
                  onClick={() => placeTrade("sell")}
                >
                  {isSell ? "↓ SELL / DOWN  ✦" : "Sell / Down"}
                </Button>
                <Button size="lg"
                  className={cn(
                    "h-16 rounded-3xl text-lg font-bold transition-all duration-200 text-slate-950",
                    isBuy
                      ? "bg-emerald-400 ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.45)] hover:bg-emerald-300"
                      : "bg-emerald-500 hover:bg-emerald-400"
                  )}
                  disabled={tradeButtonsDisabled}
                  onClick={() => placeTrade("buy")}
                >
                  {isBuy ? "↑ BUY / UP  ✦" : "Buy / Up"}
                </Button>
              </div>

              {/* Active trades for this symbol */}
              {activeForSymbol.length > 0 && (
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Active — {symbol.replaceAll("_", " ")}
                      <Badge className="bg-blue-500/10 text-blue-300">{activeForSymbol.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeForSymbol.map((t) => (
                      <LiveTradeCard key={t.id} trade={t} currentPrice={currentPrice} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Active trades on other symbols */}
              {activeOther.length > 0 && (
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Active — Other symbols
                      <Badge className="bg-slate-700 text-slate-300">{activeOther.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeOther.map((t) => (
                      <LiveTradeCard key={t.id} trade={t} currentPrice={undefined} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="space-y-5">
              <SignalSummaryCard signal={signal} />

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader className="pb-2"><CardTitle className="text-base">Indicators</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(metadata?.indicators ?? []).filter((item) => item.key !== "HEIKIN_ASHI").map((ind) => {
                    const checked = indicatorSet.includes(ind.key);
                    const bull = signal?.supporting_indicators?.includes(ind.key);
                    const bear = signal?.conflicting_indicators?.includes(ind.key);
                    return (
                      <label key={ind.key} className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                        bull ? "border-emerald-500/30 bg-emerald-500/5" : bear ? "border-rose-500/30 bg-rose-500/5" : "border-slate-800 bg-slate-900/70"
                      )}>
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setIndicatorSet((cur) => v ? Array.from(new Set([...cur, ind.key])) : cur.filter((e) => e !== ind.key));
                        }} />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            {ind.label}
                            {bull && <span className="text-xs text-emerald-400">▲</span>}
                            {bear && <span className="text-xs text-rose-400">▼</span>}
                          </div>
                          <div className="text-xs text-slate-500">{ind.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader className="pb-2"><CardTitle className="text-base">Trade context</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  {[
                    ["Execution", activeMode === "live" ? "Timed futures" : "Paper expiry"],
                    [activeMode === "live" ? "Venue" : "Payout", activeMode === "live" ? `${selectedProvider.toUpperCase()} / ${integrationLabel}` : `${((selectedSymbol?.payout_rate ?? 0.91) * 100).toFixed(0)}%`],
                    ["Balance", `${selectedBalance?.currency ?? "USD"} ${balance.toFixed(2)}`],
                    ["Mode", activeMode.toUpperCase()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2.5">
                      <span className="text-slate-500">{k}</span><span>{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent history */}
              <Card className="border-slate-800 bg-slate-950 text-slate-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    History
                    {(() => {
                      const hist = historyTrades.data ?? [];
                      const wins = hist.filter((t) => Number(t.profit_loss) > 0).length;
                      const total = hist.filter((t) => t.status === "settled").length;
                      if (!total) return null;
                      return (
                        <Badge className="bg-slate-800 text-slate-300">
                          {wins}/{total} won
                        </Badge>
                      );
                    })()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(historyTrades.data ?? []).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-4 text-center text-sm text-slate-600">No trades yet</div>
                  )}
                  {(historyTrades.data ?? []).map((t) => <HistoryTradeCard key={t.id} trade={t} />)}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <MobileTradeNav />
      </div>
    </AppShell>
  );
}
