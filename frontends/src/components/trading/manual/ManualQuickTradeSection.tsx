import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_OVERLAYS, ema, type OverlayToggles } from "@/lib/chartStructure";
import { CHART_TIMEFRAMES, MANUAL_SYMBOLS, localEstimate, parseApiError, type ChartTimeframe, type ManualPreview, type OrderForm } from "@/lib/manualTrade";
import { useManualChartCandles } from "@/hooks/useManualChartCandles";
import { useManualExchangeBalance, useManualPositions, useManualStatus, useSetManualEnabled } from "@/hooks/useQuickTradeManual";
import { ManualOrderForm, ManualProtectionPairEditor } from "./ManualOrderForm";
import { ManualPositionPanel } from "./ManualPositionPanel";
import { ManualTradeChart, type ChartLine } from "./ManualTradeChart";
import { MlAutopilotPanel } from "@/components/trading/MlAutopilotPanel";
import { MarketPressurePanel } from "@/components/trading/MarketPressurePanel";
import { MarketMoversPanel } from "@/components/trading/MarketMoversPanel";

export interface ManualIntegrationOption {
  id: string;
  provider_key: string;
  display_name: string;
  status: string;
  last_health_status?: string | null;
  environment?: string | null;
}

interface Props {
  workspaceId: string;
  symbols: { symbol: string; display?: string }[];
  integrations: ManualIntegrationOption[];
  feed: { connected: boolean; source?: string | null; latencyMs?: number | null };
  onDeposit: () => void;
}

const OVERLAY_LABELS: { key: keyof OverlayToggles; label: string }[] = [
  { key: "ema50", label: "EMA 50" },
  { key: "ema200", label: "EMA 200" },
  { key: "swings", label: "Swing highs/lows (confirmed)" },
  { key: "zones", label: "Support / resistance zones" },
  { key: "trendlines", label: "Trendlines (higher lows / lower highs)" },
  { key: "structure", label: "BOS / CHoCH" },
];

/**
 * The whole Manual SL/TP experience. Chart timeframe and overlays are DISPLAY settings: nothing in this component sends a
 * timeframe to the backend, so changing them cannot affect an order or an open position.
 */
export function ManualQuickTradeSection({ workspaceId, symbols, integrations, feed, onDeposit }: Props) {
  const status = useManualStatus(workspaceId);
  const setEnabled = useSetManualEnabled(workspaceId);
  const availableSymbols = useMemo(() => symbols.length > 0 ? symbols : MANUAL_SYMBOLS.map((symbol) => ({ symbol })), [symbols]);
  const [symbol, setSymbol] = useState<string>(availableSymbols[0]?.symbol ?? MANUAL_SYMBOLS[0]);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [toggles, setToggles] = useState<OverlayToggles>(DEFAULT_OVERLAYS);
  const [form, setForm] = useState<OrderForm | null>(null);
  const [preview, setPreview] = useState<ManualPreview | null>(null);
  const [protectionPairs, setProtectionPairs] = useState<OrderForm["protectionPairs"]>([]);
  const binanceIntegrations = useMemo(() => integrations.filter((i) => i.provider_key.toLowerCase() === "binance"), [integrations]);
  const [environment, setEnvironment] = useState<"paper" | "testnet" | "live">(() =>
    binanceIntegrations.some((i) => i.environment === "testnet") ? "testnet" : "live"
  );
  const [integrationId, setIntegrationId] = useState("");
  const [selectionInitialized, setSelectionInitialized] = useState(false);

  useEffect(() => {
    if (!availableSymbols.some((s) => s.symbol === symbol)) setSymbol(availableSymbols[0]?.symbol ?? MANUAL_SYMBOLS[0]);
  }, [availableSymbols, symbol]);

  useEffect(() => {
    if (!selectionInitialized && binanceIntegrations.length > 0) {
      if (environment === "paper") return;
      const preferred = binanceIntegrations.find((i) => (i.environment === "testnet" ? "testnet" : "live") === environment);
      setIntegrationId(preferred?.id ?? binanceIntegrations[0]?.id ?? "");
      setEnvironment((preferred ?? binanceIntegrations[0]).environment === "testnet" ? "testnet" : "live");
      setSelectionInitialized(true);
    } else if (integrationId && !binanceIntegrations.some((i) => i.id === integrationId)) {
      setIntegrationId("");
    }
  }, [binanceIntegrations, environment, integrationId, selectionInitialized]);

  const candles = useManualChartCandles(symbol, timeframe);
  const active = useManualPositions(workspaceId, "active");
  const history = useManualPositions(workspaceId, "history");

  const onFormChange = useCallback((f: OrderForm, p: ManualPreview | null) => { setForm(f); setPreview(p); }, []);
  const selectedIntegration = binanceIntegrations.find((i) => i.id === integrationId) ?? null;
  const exchangeBalanceQuery = useManualExchangeBalance(workspaceId, integrationId || undefined);
  const exchangeBalance = exchangeBalanceQuery.data?.available ?? null;

  const selectEnvironment = (next: "paper" | "testnet" | "live") => {
    setEnvironment(next);
    if (next === "paper") {
      setIntegrationId("");
      setPreview(null);
      return;
    }
    const matching = binanceIntegrations.find((i) => (i.environment === "testnet" ? "testnet" : "live") === next);
    setIntegrationId(matching?.id ?? "");
    setPreview(null);
  };

  const selectIntegration = (id: string) => {
    const account = binanceIntegrations.find((i) => i.id === id);
    setIntegrationId(id);
    setEnvironment(account?.environment === "testnet" ? "testnet" : "live");
    setPreview(null);
  };

  const openForSymbol = active.data?.find((p) => p.symbol === symbol && !p.is_terminal) ?? null;
  // Keep the displayed plan anchored to the exchange-backed preview. Deriving
  // it from every live ticker update made a 1% stop line move while reviewing.
  // Submission still revalidates price freshness on the backend.
  const planned = useMemo(() => (form ? localEstimate(form, candles.lastPrice) : null), [form, candles.lastPrice]);
  const directionInsight = useMemo(() => {
    const closes = candles.bars.map((b) => b.close);
    if (closes.length < 55) return { direction: "NEUTRAL", confidence: null, strength: "Insufficient data", basis: "Waiting for closed candles" };
    const e20 = ema(closes, 20).at(-1) ?? null;
    const e50 = ema(closes, 50).at(-1) ?? null;
    const last = closes.at(-1) ?? 0;
    const lookback = closes[Math.max(0, closes.length - 11)] ?? last;
    const momentum = lookback > 0 ? ((last - lookback) / lookback) * 100 : 0;
    const votes = [(e20 != null && last > e20) ? 1 : -1, (e50 != null && last > e50) ? 1 : -1, momentum > 0 ? 1 : -1];
    const score = votes.reduce((a, b) => a + b, 0);
    const direction = score > 0 ? "BUY / LONG" : score < 0 ? "SELL / SHORT" : "NEUTRAL";
    const confidence = Math.round(Math.abs(score) / 3 * 100);
    return { direction, confidence, strength: confidence >= 75 ? "Strong" : confidence >= 50 ? "Moderate" : "Weak", basis: "EMA20/EMA50 + closed-candle momentum" };
  }, [candles.bars]);
  const market24h = useMemo(() => {
    const bars = candles.bars;
    const last = candles.lastPrice ?? bars.at(-1)?.close ?? null;
    if (last == null || bars.length === 0) return { changePct: null, quoteVolume: null, high: null, low: null };
    const cutoff = (bars.at(-1)?.time ?? Math.floor(Date.now() / 1000)) - 24 * 60 * 60;
    const recent = bars.filter((bar) => bar.time >= cutoff);
    const open = recent[0]?.open ?? null;
    const high = recent.length ? Math.max(...recent.map((bar) => bar.high)) : null;
    const low = recent.length ? Math.min(...recent.map((bar) => bar.low)) : null;
    const quoteVolume = recent.reduce((sum, bar) => sum + (bar.volume * bar.close), 0);
    return { changePct: open && open > 0 ? ((last - open) / open) * 100 : null, quoteVolume, high, low };
  }, [candles.bars, candles.lastPrice]);

  const lines = useMemo<ChartLine[]>(() => {
    if (openForSymbol) {
      const liq = openForSymbol.exchange_liquidation_price ?? openForSymbol.estimated_liquidation_price;
      return [
        { price: openForSymbol.entry_price, title: "Entry", color: "#3b82f6" },
        { price: openForSymbol.sl_trigger_price, title: "SL", color: "#ef4444" },
        { price: openForSymbol.tp_trigger_price, title: "TP", color: "#22c55e" },
        ...((openForSymbol.protection_pairs ?? []).flatMap((pair, index) => [
          { price: pair.tp_price, title: `TP${index + 1}`, color: "#22c55e", dashed: true, width: 1 as const },
          { price: pair.active_stop_price ?? pair.sl_price, title: `SL${index + 1}`, color: "#f97316", dashed: true, width: 1 as const },
        ])),
        { price: candles.lastPrice, title: "Price", color: "#e2e8f0", dashed: true, width: 1 },
        { price: liq, title: openForSymbol.exchange_liquidation_price != null ? "Liq" : "Liq (est)", color: "#f97316", dashed: true },
      ];
    }
    if (form && form.symbol === symbol && (preview || planned)) {
      const planEntry = preview?.reference_price ?? candles.lastPrice;
      const planSl = preview?.sl_trigger_price ?? planned?.slTrigger;
      const planTp = preview?.take_profit?.trigger_price ?? planned?.tpTrigger;
      return [
        { price: planEntry, title: "Plan entry", color: "#3b82f6", dashed: true, width: 1 },
        { price: planSl, title: "Plan SL", color: "#ef4444", dashed: true, width: 1 },
        { price: planTp, title: "Plan TP", color: "#22c55e", dashed: true, width: 1 },
        { price: preview?.estimated_liquidation_price, title: "Liq (est)", color: "#f97316", dashed: true, width: 1 },
        ...form.protectionPairs.flatMap((pair, index) => {
          const tp = pair.tpMode === "price" ? pair.tpValue : (form.direction === "short" ? planEntry * (1 - pair.tpValue / 100) : planEntry * (1 + pair.tpValue / 100));
          const sl = pair.slMode === "fixed" && pair.slInputMode === "price" ? pair.slValue : pair.slInputMode === "distance" ? (form.direction === "short" ? tp + pair.slValue : tp - pair.slValue) : (form.direction === "short" ? tp * (1 + pair.slValue / 100) : tp * (1 - pair.slValue / 100));
          return [{ price: tp, title: `TP${index + 1}`, color: "#22c55e", dashed: true, width: 1 as const }, { price: sl, title: `SL${index + 1}`, color: "#f97316", dashed: true, width: 1 as const }];
        }),
      ];
    }
    return [{ price: candles.lastPrice, title: "Price", color: "#e2e8f0", dashed: true, width: 1 }];
  }, [openForSymbol, form, planned, preview, candles.lastPrice, symbol]);

  if (status.isLoading) return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">Loading Manual SL/TP...</div>;
  if (status.isError || !status.data) {
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">Manual SL/TP status is unavailable: {parseApiError((status.error as Error | null)?.message ?? "").text}</div>;
  }
  const st = status.data;
  const availableCapabilities = Object.values(st.capabilities ?? {}).filter((item) => item.supported).length;
  const unavailableCapabilities = Object.values(st.capabilities ?? {}).filter((item) => !item.supported).length;

  if (!st.enabled) {
    return (
      <Card className="border-slate-800 bg-slate-950/80 text-slate-100">
        <CardHeader><CardTitle className="text-lg">Manual SL/TP is turned off</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div className="flex flex-wrap gap-2">
            <Badge className={st.server_enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}>Server flag: {st.server_enabled ? "on" : "off"}</Badge>
            <Badge className={st.workspace_enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/50 text-slate-300"}>Workspace flag: {st.workspace_enabled ? "on" : "off"}</Badge>
          </div>
          <p>This mode needs both flags. It has not been verified against the exchange yet ({st.exchange_verification.replace(/_/g, " ")}); it is limited to Binance TESTNET until the verification checklist is completed.</p>
          {!st.server_enabled && <p className="text-amber-300">The server flag is set by the operator on the server (QUICK_TRADE_MANUAL_ENABLED). It cannot be changed from this page.</p>}
          {st.server_enabled && !st.workspace_enabled && (
            st.can_manage
              ? <Button className="bg-blue-600 text-white hover:bg-blue-500" disabled={setEnabled.isPending} onClick={() => setEnabled.mutate(true)}>Enable for this workspace</Button>
              : <p className="text-amber-300">A workspace owner or admin must enable it.</p>
          )}
          {setEnabled.isError && <p className="text-rose-300">{parseApiError((setEnabled.error as Error).message).text}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Manual SL/TP trade</div>
            <div className="mt-1 text-3xl font-bold">
              {exchangeBalance == null ? "USDT balance unavailable" : `USDT ${exchangeBalance.toFixed(2)}`}
            </div>
            <div className="mt-1 text-sm text-slate-500">Opens a Binance futures position · exchange-native SL · no expiry</div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Environment</div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="ghost" size="sm" className={environment === "paper" ? "bg-sky-400 text-slate-950" : "bg-slate-950 text-slate-300"} onClick={() => selectEnvironment("paper")}>Paper</Button>
                <Button variant="ghost" size="sm" className={environment === "testnet" ? "bg-amber-500 text-slate-950" : "bg-slate-950 text-slate-300"} onClick={() => selectEnvironment("testnet")}>Testnet</Button>
                <Button variant="ghost" size="sm" className={environment === "live" ? "bg-emerald-500 text-slate-950" : "bg-slate-950 text-slate-300"} onClick={() => selectEnvironment("live")}>Live</Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Asset class</div>
              <div className="flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-cyan-300">Crypto</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
              <div className="flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm text-slate-100">Binance</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Account</div>
              <Select value={integrationId || undefined} onValueChange={selectIntegration} disabled={environment === "paper"}>
                <SelectTrigger className="h-9 border-slate-800 bg-slate-950 text-slate-100"><SelectValue placeholder="No account" /></SelectTrigger>
                <SelectContent>
                  {binanceIntegrations.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.display_name} — {i.environment === "testnet" ? "TESTNET" : "LIVE"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={environment === "paper" ? "bg-sky-500/10 text-sky-300" : environment === "testnet" ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}>{environment === "paper" ? "INTERNAL PAPER" : environment === "testnet" ? "SANDBOX TESTNET" : "LIVE MAINNET"}</Badge>
          <Badge className="bg-blue-500/10 text-blue-300">BINANCE</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-300">{availableCapabilities} supported controls</Badge>
          <Badge className="bg-slate-700/50 text-slate-300">{unavailableCapabilities} safely unavailable</Badge>
          <Badge className="bg-slate-700/50 text-slate-300">{selectedIntegration?.display_name ?? "No matching account"}</Badge>
          <Badge className={selectedIntegration?.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}>{selectedIntegration?.status === "active" ? "Account active" : "Connection required"}</Badge>
          <div className="ml-auto flex items-center gap-2">
            {feed.connected
              ? <><Wifi className="h-3.5 w-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">{feed.source === "ws" ? "Binance chart WS" : "Live feed"} · {feed.latencyMs ?? 0}ms</span></>
              : <><WifiOff className="h-3.5 w-3.5 text-slate-600" /><span className="text-xs text-slate-600">Connecting...</span></>}
          </div>
          <Button size="sm" className="rounded-2xl bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400" onClick={onDeposit}>Deposit</Button>
        </div>
        {environment === "paper" && <div className="mt-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">Paper mode is internal simulation only. No Binance account, exchange order, wallet, or live position is used.</div>}
        {environment !== "paper" && !selectedIntegration && <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-200">No active Binance {environment === "testnet" ? "Testnet" : "Live"} account is connected. The Account menu still lists every connected Binance account; add a separate Live connection with Testnet OFF before opening a Mainnet position.</div>}
        {selectedIntegration && exchangeBalanceQuery.data?.error && <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">Live balance could not be read from this account: {exchangeBalanceQuery.data.error}</div>}
        {environment === "live" && !st.allow_mainnet && <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">Live Mainnet is safety-blocked until the Binance exchange verification checklist is completed and the server explicitly enables it.</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-400">
        <Info className="h-4 w-4 text-blue-300" />
        <span>Manual SL/TP: you pick the side; the stop-loss is placed ON the exchange and survives closing this page or restarting the server. Not verified on the exchange yet - {st.allow_mainnet ? "mainnet allowed" : "TESTNET only"}.</span>
        {st.can_manage && <Button size="sm" variant="ghost" className="ml-auto h-7 text-slate-400" disabled={setEnabled.isPending} onClick={() => setEnabled.mutate(false)}>Disable for workspace</Button>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="text-sm font-bold text-slate-100">{symbol}</div>
              <div className="ml-2 flex gap-1">
                {CHART_TIMEFRAMES.map((tf) => (
                  <Button key={tf} size="sm" variant="ghost" className={cn("h-7 px-2", timeframe === tf ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-slate-300")} onClick={() => setTimeframe(tf)}>{tf}</Button>
                ))}
              </div>
              <span className="text-xs text-slate-500">Chart timeframe only - it never changes an order or a position.</span>
              <span className="ml-auto text-xs text-slate-500">{candles.connected ? "live" : "connecting..."}{candles.loadingHistory ? " - loading history" : ""}</span>
            </div>
            <ManualTradeChart candles={candles.bars} toggles={toggles} lines={lines} height={440} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {OVERLAY_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Checkbox checked={toggles[key]} onCheckedChange={(v) => setToggles((t) => ({ ...t, [key]: v === true }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Overlays are visual aids computed only from candles already closed; they never place or change a trade.</div>
            <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs sm:grid-cols-4">
              <div><div className="text-slate-500">24h move</div><div className={cn("mt-1 font-bold", (market24h.changePct ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>{market24h.changePct == null ? "—" : `${market24h.changePct >= 0 ? "+" : ""}${market24h.changePct.toFixed(2)}%`}</div></div>
              <div><div className="text-slate-500">24h quote volume (approx.)</div><div className="mt-1 font-bold text-slate-100">{market24h.quoteVolume == null ? "—" : `${(market24h.quoteVolume / 1_000_000).toFixed(2)}M USDT`}</div></div>
              <div><div className="text-slate-500">24h high / low</div><div className="mt-1 font-bold text-slate-100">{market24h.high == null ? "—" : `${market24h.high.toFixed(2)} / ${market24h.low?.toFixed(2)}`}</div></div>
              <div><div className="text-slate-500">Est. liquidation</div><div className="mt-1 font-bold text-amber-300">{preview?.estimated_liquidation_price == null ? "Set order details" : preview.estimated_liquidation_price.toFixed(2)}</div></div>
            </div>
            <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs md:grid-cols-4">
              <div><div className="text-slate-500">Direction advisory</div><div className="mt-1 font-bold text-slate-100">{directionInsight.direction}</div></div>
              <div><div className="text-slate-500">Signal strength</div><div className="mt-1 font-bold text-cyan-300">{directionInsight.strength}</div></div>
              <div><div className="text-slate-500">Confidence</div><div className="mt-1 font-bold text-violet-300">{directionInsight.confidence == null ? "—" : `${directionInsight.confidence}%`}</div></div>
              <div><div className="text-slate-500">Basis</div><div className="mt-1 text-slate-300">{directionInsight.basis}</div></div>
            </div>
            <ManualProtectionPairEditor pairs={protectionPairs} setPairs={(next) => { setProtectionPairs(next); setForm((current) => current ? { ...current, protectionPairs: typeof next === "function" ? next(current.protectionPairs) : next } : current); }} />
          </div>
          <MarketPressurePanel workspaceId={workspaceId} symbol={symbol} enabled={Boolean(workspaceId && symbol)} />
          <MarketMoversPanel />
        </div>
        {environment === "paper"
          ? <div className="space-y-3"><MlAutopilotPanel workspaceId={workspaceId} mode="paper" /><div className="rounded-[24px] border border-sky-500/25 bg-sky-500/5 p-4 text-xs text-sky-200">Manual exchange order fields are disabled in Paper mode. V5 paper autopilot runs on its own internal ledger; switching to Testnet or Live restores the exchange form.</div></div>
          : integrationId
          ? <ManualOrderForm workspaceId={workspaceId} status={st} integrationId={integrationId} symbols={availableSymbols} symbol={symbol} onSymbolChange={setSymbol} lastPrice={candles.lastPrice} onFormChange={onFormChange} protectionPairs={protectionPairs} setProtectionPairs={setProtectionPairs} />
          : <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-6 text-sm text-amber-200">Select or connect a Binance {environment === "testnet" ? "Testnet" : "Live"} account to preview and open an order.</div>}
      </div>

      <ManualPositionPanel workspaceId={workspaceId} positions={active.data ?? []} title="Open manual positions" empty="No open manual positions." />
      <ManualPositionPanel workspaceId={workspaceId} positions={(history.data ?? []).slice(0, 10)} title="Recent manual positions" empty="No finished manual positions yet." />
    </div>
  );
}
