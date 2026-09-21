import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { ExecutionSafetyControls, type ExecutionSafetyValues } from "@/components/trading/ExecutionSafetyControls";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
import { NearTermForecastCard } from "@/components/trading/NearTermForecastCard";
import { ProfitCalculatorCard } from "@/components/trading/ProfitCalculatorCard";
import { RobotLiveChart } from "@/components/trading/RobotLiveChart";
import { useQuickTradeOlderCandles } from "@/hooks/useQuickTradeOlderCandles";
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
  useQuickTradeForecast,
  useForecastComparison,
  useQuickTradeHistory,
  useQuickTradeMetadata,
  useSettleQuickTrades,
  type QuickTradeRecord,
} from "@/hooks/useQuickTrade";
import { type CandleData } from "@/hooks/useRobotCandleFeed";
import { useQuickTradeCandleFeed } from "@/hooks/useQuickTradeCandleFeed";
import { useBinanceFuturesQuoteFeed } from "@/hooks/useBinanceFuturesQuoteFeed";
import { runtimeIsRed, useRuntimeHealth } from "@/hooks/useRuntimeHealth";
import { useRuntimeSafetySettings, useUpdateRuntimeSafetySettings } from "@/hooks/useRuntimeSafetySettings";
import type { ChartMarker } from "@/components/trading/RobotLiveChart";
import { AssetClassToggle } from "@/components/trading/AssetClassToggle";
import { ProviderSelect } from "@/components/trading/ProviderSelect";
import type { AssetClass, ProviderCatalogEntry } from "@/hooks/useProviderCatalog";
import { cn } from "@/lib/utils";
import { quickTradeCosts } from "@/lib/quickTradeCosts";
import { QuickTradeResearchPanel } from "@/components/trading/QuickTradeResearchPanel";
import { ForecastComparisonCard } from "@/components/trading/ForecastComparisonCard";

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

function formatUsdtPnl(value: number) {
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return value.toFixed(6);
  if (abs < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function numberFrom(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Quote-based projection; exit commission/slippage are estimates, not final settlement. */
function liveFuturesPnl(trade: QuickTradeRecord, currentPrice: number, slippagePct: number | null = null) {
  const entry = Number(trade.entry_price);
  if (!entry) return null;

  const quantity = Number(trade.quantity || 0);
  const priceDelta = trade.side === "buy" ? currentPrice - entry : entry - currentPrice;
  const value = quantity > 0
    ? priceDelta * quantity
    : ((priceDelta / entry) * Number(trade.stake_amount));
  const stake = Math.max(Number(trade.stake_amount), 0.00000001);
  const pct = (value / stake) * 100;

  const projection = quickTradeCosts(trade, currentPrice, slippagePct);
  const feeEstimate = projection?.totalCost ?? null;
  const netValue = projection?.net ?? null;
  const netPct = netValue != null ? (netValue / stake) * 100 : null;

  return { pct, value, netPct, netValue, feeEstimate, projection };
}

interface LiveTradeCardProps {
  trade: QuickTradeRecord;
  currentPrice: number | undefined;
  slippagePct: number | null;
  walletBalance?: number;
  walletCurrency?: string;
}

// Memoized: re-renders only when its own props actually change (currentPrice
// ticks for the active symbol's card), not when unrelated page state (stake
// input, indicators, safety guard settings, etc.) changes.
const LiveTradeCard = memo(function LiveTradeCard({ trade, currentPrice, slippagePct, walletBalance, walletCurrency }: LiveTradeCardProps) {
  const countdown = useCountdown(trade.expires_at);
  const totalSecs = trade.expiry_seconds ?? 60;

  const livePnl = useMemo(() => {
    if (!currentPrice) return null;
    return liveFuturesPnl(trade, currentPrice, slippagePct);
  }, [currentPrice, trade, slippagePct]);

  const winning = livePnl?.netValue != null && livePnl.netValue >= 0;
  const isBuy = trade.side === "buy";

  return (
    <div className={cn(
      "rounded-3xl border p-4 transition-all",
      winning ? "border-emerald-500/25 bg-emerald-500/5" : "border-rose-500/25 bg-rose-500/5"
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                {livePnl.netPct == null ? "Net unavailable" : `${winning ? "+" : ""}${livePnl.netPct.toFixed(3)}%`}
              </div>
              <div className={cn("text-sm font-medium", winning ? "text-emerald-400" : "text-rose-400")}>
                {livePnl.netValue == null ? "Costs not verified" : `${winning ? "+" : ""}${formatUsdtPnl(livePnl.netValue)} ${trade.quote_currency || "USDT"} est. net`}
              </div>
              {livePnl.netValue != null && livePnl.netPct != null && (
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Gross before costs: {formatUsdtPnl(livePnl.value)} {trade.quote_currency || "USDT"}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-500">Fresh quote / live cost data unavailable</div>
          )}
          <div className="mt-0.5 text-xs text-slate-600">
            {formatDistanceToNowStrict(new Date(trade.entry_at), { addSuffix: true })}
          </div>
        </div>
      </div>
      {livePnl?.projection && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-xs text-slate-300">
          <div>Entry fee ({livePnl.projection.entryFeeSource}): {livePnl.projection.entryFee == null ? "Unknown" : formatUsdtPnl(livePnl.projection.entryFee)}</div>
          <div>Exit fee (est.): {livePnl.projection.exitFee == null ? "Unknown" : formatUsdtPnl(livePnl.projection.exitFee)}</div>
          <div>Exit slippage buffer: {livePnl.projection.exitSlippage == null ? "Unknown" : formatUsdtPnl(livePnl.projection.exitSlippage)}</div>
          <div>Funding: {livePnl.projection.funding == null ? "Not reconciled" : formatUsdtPnl(livePnl.projection.funding)}</div>
          <div className="col-span-2 font-semibold">Stake + est. net: {livePnl.projection.stakeAfterCosts == null ? "Unknown" : formatUsdtPnl(livePnl.projection.stakeAfterCosts)} {trade.quote_currency || "USDT"} — not wallet balance</div>
          <div className="col-span-2 font-semibold text-cyan-300">Available wallet balance: {walletBalance == null ? "Unavailable" : `${walletCurrency || trade.quote_currency || "USDT"} ${walletBalance.toFixed(2)}`}</div>
          <p className="col-span-2 text-slate-400">Entry slippage is already in the fill price. Exit costs are estimates; {livePnl.projection.fundingUnknown ? "unknown funding / other charges are excluded. " : ""}Final exchange settlement may differ.</p>
        </div>
      )}
    </div>
  );
});

// Memoized: history rows never depend on the live tick, so once rendered a
// row should never re-render just because the page's WS feed ticked.
const HistoryTradeCard = memo(function HistoryTradeCard({ trade }: { trade: QuickTradeRecord }) {
  const pnl = Number(trade.profit_loss || 0);
  const won = pnl > 0;
  return (
    <div className={cn(
      "rounded-3xl border p-4",
      won ? "border-emerald-500/20 bg-emerald-500/5" : pnl < 0 ? "border-rose-500/20 bg-rose-500/5" : "border-slate-800 bg-slate-900/50"
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            {won ? "+" : ""}{formatUsdtPnl(pnl)}
          </div>
          <div className="text-xs text-slate-600">
            {formatDistanceToNowStrict(new Date(trade.settled_at ?? trade.entry_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
});

interface IndicatorsCardProps {
  indicators: Array<{ key: string; label: string; description: string }>;
  indicatorSet: string[];
  supportingIndicators?: string[];
  conflictingIndicators?: string[];
  onToggle: (key: string, checked: boolean) => void;
}

// Memoized: the indicator checklist only depends on metadata + the current
// signal preview (which updates once per closed candle, not per WS tick) —
// it must not re-render on every live-price tick.
const IndicatorsCard = memo(function IndicatorsCard({
  indicators,
  indicatorSet,
  supportingIndicators,
  conflictingIndicators,
  onToggle,
}: IndicatorsCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="pb-2"><CardTitle className="text-base">Indicators</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {indicators.filter((item) => item.key !== "HEIKIN_ASHI").map((ind) => {
          const checked = indicatorSet.includes(ind.key);
          const bull = supportingIndicators?.includes(ind.key);
          const bear = conflictingIndicators?.includes(ind.key);
          return (
            <label key={ind.key} className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
              bull ? "border-emerald-500/30 bg-emerald-500/5" : bear ? "border-rose-500/30 bg-rose-500/5" : "border-slate-800 bg-slate-900/70"
            )}>
              <Checkbox checked={checked} onCheckedChange={(v) => onToggle(ind.key, Boolean(v))} />
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
  );
});

interface TradeContextCardProps {
  activeMode: "paper" | "live";
  selectedProvider: string;
  integrationLabel: string;
  payoutRate?: number;
  balanceCurrency: string;
  balance: number;
}

// Memoized: static reference/context data — never touched by the live tick.
const TradeContextCard = memo(function TradeContextCard({
  activeMode,
  selectedProvider,
  integrationLabel,
  payoutRate,
  balanceCurrency,
  balance,
}: TradeContextCardProps) {
  const rows: Array<[string, string]> = [
    ["Execution", activeMode === "live" ? "Timed futures" : "Paper expiry"],
    [activeMode === "live" ? "Venue" : "Payout", activeMode === "live" ? `${selectedProvider.toUpperCase()} / ${integrationLabel}` : `${((payoutRate ?? 0.91) * 100).toFixed(0)}%`],
    ["Balance", `${balanceCurrency} ${balance.toFixed(2)}`],
    ["Mode", activeMode.toUpperCase()],
  ];
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="pb-2"><CardTitle className="text-base">Trade context</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-300">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2.5">
            <span className="text-slate-500">{k}</span><span>{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

interface HistoryCardProps {
  trades: QuickTradeRecord[];
}

// Memoized: settled trade history never depends on the live tick.
const HistoryCard = memo(function HistoryCard({ trades }: HistoryCardProps) {
  const wins = trades.filter((t) => Number(t.profit_loss) > 0).length;
  const total = trades.filter((t) => t.settled_at != null && t.status !== "open").length;
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          History
          <a href="#quick-trade-research" className="ml-auto text-xs text-cyan-300 underline">Export / analyze trades</a>
          {total > 0 && (
            <Badge className="bg-slate-800 text-slate-300">
              {wins}/{total} won
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trades.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 p-4 text-center text-sm text-slate-600">No trades yet</div>
        )}
        {trades.map((t) => <HistoryTradeCard key={t.id} trade={t} />)}
      </CardContent>
    </Card>
  );
});

export default function QuickTradePage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: balances = [] } = useBalances(workspaceId);
  const { data: metadata } = useQuickTradeMetadata(workspaceId);
  const runtimeSafety = useRuntimeSafetySettings(workspaceId);
  const updateRuntimeSafety = useUpdateRuntimeSafetySettings(workspaceId);
  const updateTradingSettings = useUpdateTradingSettings(workspaceId);

  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1m");
  const [predictionSource, setPredictionSource] = useState<"current" | "unified">("current");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState(10);
  // Optional per-trade stop-loss — live mode only. Empty string = feature
  // off (nothing submitted); a positive number here means "close early if
  // unrealized loss reaches this % of stake" (sent to the API as a negative
  // stop_loss_pct).
  const [stopLossPctInput, setStopLossPctInput] = useState("");
  // Optional per-trade take-profit — live mode only, mirrors stop-loss above
  // exactly. Empty string = feature off; a positive number here means
  // "close early once unrealized profit reaches this % of stake" (sent to
  // the API as-is — POSITIVE take_profit_pct, opposite sign to stop-loss).
  const [takeProfitPctInput, setTakeProfitPctInput] = useState("");
  // Optional per-trade leverage — live mode only, defaults OFF (1x). No
  // app-layer upper bound; the backend's LeverageValidationService is the
  // real, exchange-verified ceiling and rejects (never silently clamps) an
  // over-limit request.
  const [leverageEnabled, setLeverageEnabled] = useState(false);
  const [leverageInput, setLeverageInput] = useState("1");
  const [indicatorSet, setIndicatorSet] = useState<string[]>(["RSI", "MACD"]);
  const [selectedProvider, setSelectedProvider] = useState("binance");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("auto");
  const [assetClass, setAssetClass] = useState<AssetClass>("CRYPTO");
  const [safetyValues, setSafetyValues] = useState<ExecutionSafetyValues>({
    liveFeedMaxAgeSeconds: 3,
    webhookMaxSignalLatencyMs: 4000,
  });

  const tradingState = metadata?.trading_state;
  const activeMode = tradingState?.mode ?? "paper";
  const runtimeHealth = useRuntimeHealth(workspaceId, selectedProvider === "binance" ? symbol : undefined);
  const providerCatalogAll = Object.values(tradingState?.provider_catalog ?? {});
  const providerCatalog = providerCatalogAll
    .filter((p) => (p.asset_class ?? "CRYPTO") === assetClass)
    .map((p) => ({ ...p, asset_class: assetClass })) as ProviderCatalogEntry[];
  const providerIntegrations = (tradingState?.active_integrations ?? []).filter(
    (i) => i.provider_key === selectedProvider
  );
  const symbolsForClass = (metadata?.symbols ?? []).filter((o) =>
    assetClass === "CRYPTO" ? o.asset_class === "CRYPTO" : o.asset_class !== "CRYPTO"
  );

  useEffect(() => {
    if (!metadata) return;
    if (!symbolsForClass.some((o) => o.symbol === symbol)) setSymbol(symbolsForClass[0]?.symbol ?? "");
    if (!metadata.timeframes.some((o) => o.key === timeframe)) setTimeframe(metadata.timeframes[0]?.key ?? metadata.quick_trade.default_timeframe);
    if (!metadata.durations.some((o) => o.seconds === duration)) setDuration(metadata.durations[0]?.seconds ?? metadata.quick_trade.default_duration);
    const allowed = new Set(metadata.quick_trade.allowed_indicators);
    setIndicatorSet((cur) => {
      const f = cur.filter((i) => allowed.has(i));
      return f.length > 0 ? f : (metadata.quick_trade.allowed_indicators ?? []).slice(0, 2);
    });
    const preferredForClass = providerCatalog.find((p) => p.key === tradingState?.preferred_provider)?.key;
    const nextProvider = preferredForClass ?? providerCatalog[0]?.key ?? (assetClass === "CRYPTO" ? "binance" : "metal_broker");
    setSelectedProvider(nextProvider);
    setSelectedIntegrationId(
      nextProvider === tradingState?.preferred_provider ? (tradingState?.preferred_integration_id ?? "auto") : "auto"
    );
  }, [assetClass, duration, metadata, symbol, timeframe, tradingState]);

  // Backend SSE → Binance WebSocket (server-side) → no direct browser→Binance needed
  const feed = useQuickTradeCandleFeed(symbol, timeframe, !!symbol);
  const liveQuote = useBinanceFuturesQuoteFeed(symbol, !!symbol);

  // Timestamp of the most recently *closed* candle on the live feed. Only
  // changes when a candle actually closes (not on every intra-candle price
  // tick), since `feed.candles` entries are upserted in place by `time`
  // until `isClosed` flips true — see useQuickTradeCandleFeed.ts.
  const lastClosedCandleTime = useMemo(() => {
    for (let i = feed.candles.length - 1; i >= 0; i -= 1) {
      const c = feed.candles[i];
      if (c.isClosed) return c.time;
    }
    return null;
  }, [feed.candles]);

  // Robot Trade signal analysis — refetches on interval as a fallback, and
  // immediately whenever a new candle closes on the live feed above.
  const chartQuery = useQuickTradeChart({
    workspaceId,
    symbol,
    timeframe,
    chartType: "candles",
    indicatorSet,
    mode: activeMode,
    provider: selectedProvider,
    integrationId: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
    candleCloseSignal: lastClosedCandleTime,
  });
  // Fallback candles from backend REST when Binance WebSocket isn't reachable from browser
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

  // A WebSocket starts with one candle, not history. Preserve the REST context
  // needed by indicators/forecast and overlay live candles by opening timestamp.
  const chartCandles = useMemo(() => {
    const merged = new Map(fallbackCandles.map((c) => [c.time, c]));
    for (const candle of feed.candles) merged.set(candle.time, candle);
    return [...merged.values()].sort((a, b) => a.time - b.time).slice(-500);
  }, [fallbackCandles, feed.candles]);
  // The candle stream drives the chart. A separate direct bookTicker stream
  // drives the displayed quote so a forming 1m candle never makes the UI look
  // like it only refreshes once per second. This is visual/P&L data only;
  // backend execution independently validates its own fresh Redis WS quote.
  const quoteIsFresh = liveQuote.receivedAt != null && Date.now() - liveQuote.receivedAt <= 2_000;
  const currentPrice = quoteIsFresh
    ? liveQuote.price
    : feed.currentCandle?.close ?? chartQuery.data?.quote?.price;
  const olderHistory = useQuickTradeOlderCandles(symbol, timeframe, `${workspaceId}:${selectedProvider}:${activeMode}:${selectedIntegrationId}`);
  const displayCandles = useMemo(() => {
    const merged = new Map(olderHistory.candles.map((c) => [c.time, c]));
    for (const candle of chartCandles) merged.set(candle.time, candle);
    return [...merged.values()].sort((a, b) => a.time - b.time);
  }, [olderHistory.candles, chartCandles]);
  const [priceClock, setPriceClock] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setPriceClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const restQuoteAt = Date.parse(chartQuery.data?.quote?.occurred_at ?? "");
  const freshPrice = quoteIsFresh
    ? liveQuote.price
    : feed.currentCandle?.symbol === symbol && feed.lastPriceAt && priceClock - feed.lastPriceAt <= 5000
      ? feed.currentCandle?.close
    : chartQuery.data?.symbol === symbol && Number.isFinite(restQuoteAt) && priceClock - restQuoteAt >= -1000 && priceClock - restQuoteAt <= 10000
      ? chartQuery.data?.quote?.price : undefined;

  const activeTrades = useQuickTradeActive(workspaceId);
  const historyTrades = useQuickTradeHistory(workspaceId, undefined, undefined, 8);
  const placeQuickTrade = usePlaceQuickTrade();
  const settleTrades = useSettleQuickTrades();

  useEffect(() => {
    const t = window.setInterval(() => { settleTrades.mutate(25); }, 5000);
    return () => window.clearInterval(t);
  }, [settleTrades]);

  useEffect(() => {
    if (!runtimeSafety.data) return;
    setSafetyValues({
      liveFeedMaxAgeSeconds: Number(runtimeSafety.data.live_feed_max_age_seconds ?? 3),
      webhookMaxSignalLatencyMs: Number(runtimeSafety.data.webhook_max_signal_latency_ms ?? 4000),
    });
  }, [runtimeSafety.data]);

  // Active trade for current symbol — drives chart lines + P&L overlay
  const activeTradeForSymbol = useMemo(
    () => (activeTrades.data ?? []).find((t) => t.symbol === symbol && t.status === "open"),
    [activeTrades.data, symbol]
  );

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
  const minStake = Number(metadata?.quick_trade.min_stake ?? 10);
  const maxStake = Number(metadata?.quick_trade.max_stake ?? 500);
  const amountStep = useMemo(() => Math.max(1, Math.round(stake >= 25 ? 5 : 1)), [stake]);
  const liveReady = Boolean(tradingState?.live_ready);
  const liveRuntimeRed = activeMode === "live" && runtimeIsRed(runtimeHealth.data);
  const quickSettlerUnhealthy =
    activeMode === "live" &&
    (runtimeHealth.isSuccess ? runtimeHealth.data?.quick_trade?.settler !== "green" : true);
  const liveFeedDetail = (runtimeHealth.data?.future_trade?.live_feed_detail ?? {}) as Record<string, unknown>;
  const liveFeedSource = String(liveFeedDetail.truth_source ?? liveFeedDetail.source ?? "runtime");
  const liveFeedAge = Number(liveFeedDetail.age_seconds ?? runtimeHealth.data?.future_trade?.live_feed_age_seconds ?? NaN);
  const liveFeedLabel = Number.isFinite(liveFeedAge)
    ? `${liveFeedSource} age ${Math.round(liveFeedAge)}s`
    : liveFeedSource;
  const quickSettlerDetail = (runtimeHealth.data?.quick_trade?.settler_detail ?? {}) as Record<string, unknown>;

  const saveRuntimeSafety = () => {
    updateRuntimeSafety.mutate({
      live_feed_max_age_seconds: safetyValues.liveFeedMaxAgeSeconds,
      webhook_max_signal_latency_ms: safetyValues.webhookMaxSignalLatencyMs,
    });
  };

  useEffect(() => {
    setStake((current) => Math.min(maxStake, Math.max(minStake, Number(current || 0))));
  }, [maxStake, minStake]);

  // Debounce the free-typed stake before it drives a forecast request.
  const [debouncedStake, setDebouncedStake] = useState(stake);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedStake(stake), 350);
    return () => window.clearTimeout(t);
  }, [stake]);
  const effectiveStake = Math.min(maxStake, Math.max(minStake, debouncedStake));

  const forecastQuery = useQuickTradeForecast({
    exchange: selectedProvider === "binance" ? "binance_futures" : selectedProvider,
    marketContext: `${workspaceId}:${activeMode}:${selectedIntegrationId}`,
    candles: chartCandles,
    signal,
    timeframe,
    expirySeconds: duration,
    stakeAmount: effectiveStake,
    symbol,
  });
  const forecastComparison = useForecastComparison({
    exchange: selectedProvider === "binance" ? "binance_futures" : selectedProvider,
    marketContext: `${workspaceId}:${activeMode}:${selectedIntegrationId}`,
    botType: "quick_trade", symbol, timeframe, expirySeconds: duration,
    candles: chartCandles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close })),
    signal: signal ? { direction: signal.direction, confidence: signal.confidence } : undefined,
  });
  const slippageBufferPct = forecastQuery.data?.net_edge?.slippage_buffer_pct ?? null;
  const livePnl = useMemo(() => {
    if (!activeTradeForSymbol || !freshPrice) return null;
    const pnl = liveFuturesPnl(activeTradeForSymbol, freshPrice, slippageBufferPct);
    if (pnl?.netValue == null || pnl.netPct == null) return null;
    return { side: activeTradeForSymbol.side === "buy" ? "BUY" as const : "SELL" as const,
      pct: pnl.netPct, value: pnl.netValue, netPct: pnl.netPct, netValue: pnl.netValue };
  }, [activeTradeForSymbol, freshPrice, slippageBufferPct]);

  const integrationLabel =
    providerIntegrations.find((i) => i.id === selectedIntegrationId)?.display_name ??
    tradingState?.preferred_integration_label ?? "Auto";
  const selectedIntegration = providerIntegrations.find((i) => i.id === selectedIntegrationId);
  const executionEnvironment =
    activeMode !== "live"
      ? "paper"
      : (selectedIntegration?.environment ?? tradingState?.exchange_environment ?? tradingState?.venue_environment ?? "live") === "testnet"
        ? "testnet"
        : "live";
  const executionBadge =
    executionEnvironment === "live"
      ? "LIVE MAINNET"
      : executionEnvironment === "testnet"
        ? "SANDBOX TESTNET"
        : "SANDBOX PAPER";

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
    const stopLossInputValue = Number(stopLossPctInput);
    // Live mode only — paper mode has no real position to protect. Sent as a
    // negative percentage of stake (the API rejects zero/positive values).
    const stopLossPct =
      activeMode === "live" && stopLossPctInput.trim() !== "" && Number.isFinite(stopLossInputValue) && stopLossInputValue > 0
        ? -Math.abs(stopLossInputValue)
        : undefined;

    const takeProfitInputValue = Number(takeProfitPctInput);
    // Live mode only — paper mode has no real position to lock in profit on.
    // Sent as a positive percentage of stake (the API rejects zero/negative
    // values) — opposite sign convention from stop_loss_pct.
    const takeProfitPct =
      activeMode === "live" && takeProfitPctInput.trim() !== "" && Number.isFinite(takeProfitInputValue) && takeProfitInputValue > 0
        ? Math.abs(takeProfitInputValue)
        : undefined;

    // Live mode only — paper mode has no real exchange position, so
    // leverage is never sent for a paper trade even if the toggle is on.
    const leverageValue = Number(leverageInput);
    const leverageActive = activeMode === "live" && leverageEnabled && Number.isFinite(leverageValue) && leverageValue >= 1;

    placeQuickTrade.mutate({
      workspace_id: workspaceId,
      symbol,
      side,
      stake_amount: Math.min(maxStake, Math.max(minStake, stake)),
      timeframe,
      expiry_seconds: duration,
      mode: activeMode,
      provider: selectedProvider,
      integration_id: selectedIntegrationId === "auto" ? undefined : selectedIntegrationId,
      indicator_set: indicatorSet,
      idempotency_key: `qt-${workspaceId}-${symbol}-${side}-${timeframe}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...(stopLossPct !== undefined ? { stop_loss_pct: stopLossPct } : {}),
      ...(takeProfitPct !== undefined ? { take_profit_pct: takeProfitPct } : {}),
      ...(leverageActive ? { leverage_enabled: true, leverage: leverageValue } : {}),
    });
  };

  const tradeButtonsDisabled =
    placeQuickTrade.isPending || updateTradingSettings.isPending || !workspaceId || !symbol ||
    (activeMode === "live" && (!liveReady || liveRuntimeRed || quickSettlerUnhealthy || Boolean(activeTradeForSymbol)));

  const priceDisplay = currentPrice
    ? `$${currentPrice.toFixed(currentPrice > 100 ? 2 : 4)}`
    : "—";

  // Memoized so these arrays keep a stable reference across ticks (the WS
  // feed/price re-render doesn't touch activeTrades.data), letting the
  // memoized LiveTradeCard list below skip re-rendering when nothing about
  // the active trades actually changed.
  const allActiveTrades = useMemo(() => activeTrades.data ?? [], [activeTrades.data]);
  const activeForSymbol = useMemo(
    () => allActiveTrades.filter((t) => t.symbol === symbol && t.status === "open"),
    [allActiveTrades, symbol]
  );
  const activeOther = useMemo(
    () => allActiveTrades.filter((t) => t.symbol !== symbol && t.status === "open"),
    [allActiveTrades, symbol]
  );
  const estimatedQuantity = currentPrice ? Math.max(minStake, stake) / currentPrice : null;

  // Stable callback for the memoized IndicatorsCard — a new inline arrow
  // function every render would defeat React.memo on that component.
  const handleIndicatorToggle = useCallback((key: string, checked: boolean) => {
    setIndicatorSet((cur) => (checked ? Array.from(new Set([...cur, key])) : cur.filter((e) => e !== key)));
  }, []);

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
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Mode</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" size="sm" className={activeMode === "paper" ? "bg-slate-100 text-slate-950" : "bg-slate-950 text-slate-300"} disabled={updateTradingSettings.isPending} onClick={() => updateMode("paper")}>Paper</Button>
                    <Button variant="ghost" size="sm" className={activeMode === "live" ? "bg-emerald-500 text-slate-950" : "bg-slate-950 text-slate-300"} disabled={updateTradingSettings.isPending} onClick={() => updateMode("live")}>Live</Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Asset class</div>
                  <AssetClassToggle value={assetClass} onChange={setAssetClass} />
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
                  <ProviderSelect
                    providers={providerCatalog}
                    value={selectedProvider}
                    onChange={(v) => {
                      const next = (tradingState?.active_integrations ?? []).find((i) => i.provider_key === v)?.id;
                      setSelectedProvider(v);
                      setSelectedIntegrationId(next ?? "auto");
                      updateMode(activeMode, v, next ?? "auto");
                    }}
                    className="border-slate-800 bg-slate-950 text-slate-100 h-9"
                  />
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
              <Badge className={executionEnvironment === "live" ? "bg-emerald-500/10 text-emerald-300" : executionEnvironment === "testnet" ? "bg-amber-500/10 text-amber-300" : "bg-slate-700/50 text-slate-300"}>
                {executionBadge}
              </Badge>
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
            {activeMode === "live" && liveRuntimeRed && (
              <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
                Live actions are blocked because runtime health is red: {(runtimeHealth.data?.reasons ?? []).slice(0, 3).join(", ") || "required workers/feed are unhealthy"}. Feed source: {liveFeedLabel}.
              </div>
            )}
            {activeMode === "live" && quickSettlerUnhealthy && (
              <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
                Quick Trade settler is not running. Timed live trades may not close reliably.
              </div>
            )}
            {activeMode === "live" && activeTradeForSymbol && (
              <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-200">
                Same-symbol live position is already open. Close or settle the active {symbol} trade before opening another one.
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
                  "text-4xl font-black sm:text-5xl",
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
                  <div className="text-xs uppercase tracking-wider text-slate-500">Estimated net P&L after known costs</div>
                  <div className={cn("text-2xl font-bold", livePnl.pct >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    {livePnl.pct >= 0 ? "+" : ""}{livePnl.pct.toFixed(3)}%
                  </div>
                  <div className={cn("text-sm", livePnl.pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {livePnl.value >= 0 ? "+" : ""}{formatUsdtPnl(livePnl.value)} USDT
                  </div>
                  {livePnl.netValue != null && livePnl.netPct != null && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Includes estimated exit fee/slippage. Unreconciled funding and other charges excluded.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Near-term forecast + profit calculator (shared with Robot Trade) ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <NearTermForecastCard forecast={forecastQuery.data?.forecast} symbol={symbol} />
            <ProfitCalculatorCard netEdge={forecastQuery.data?.net_edge} />
          </div>
          <ForecastComparisonCard current={forecastComparison.data?.current ?? forecastQuery.data?.forecast} unified={forecastComparison.data?.unified} agreement={forecastComparison.data?.comparison?.agreement} selected={predictionSource} onSelect={setPredictionSource} />

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
                        {symbolsForClass.map((o) => <SelectItem key={o.symbol} value={o.symbol}>{o.display}</SelectItem>)}
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
                  {selectedProvider === "binance" && displayCandles.length > 0 && (
                    <div className="mb-2 flex items-center gap-3 text-xs text-slate-400">
                      <button type="button" className="rounded border border-slate-700 px-2 py-1 disabled:opacity-50"
                        disabled={olderHistory.loading || olderHistory.exhausted || olderHistory.atCapacity}
                        onClick={() => void olderHistory.loadOlder(displayCandles[0].time)}>
                        {olderHistory.loading ? "Loading history..." : olderHistory.atCapacity ? "History limit reached" : olderHistory.exhausted ? "No older candles" : "Load older candles"}
                      </button>
                      {olderHistory.error && <span role="alert">History unavailable. Retry shortly.</span>}
                    </div>
                  )}
                  {chartCandles.length === 0 ? (
                    <div className="flex h-[360px] items-center justify-center flex-col gap-2 text-slate-600">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
                      <span className="text-sm">{chartQuery.isLoading ? "Loading chart..." : "Connecting..."}</span>
                    </div>
                  ) : (
                    <RobotLiveChart
                      preserveHistoryViewport
                      key={`${symbol}-${timeframe}`}
                      candles={displayCandles}
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
                      <Button variant="ghost" className="h-11 w-11 rounded-full text-2xl text-slate-100 lg:h-10 lg:w-10" onClick={() => stepDuration("prev")}>-</Button>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{metadata?.durations.find((e) => e.seconds === duration)?.label ?? `${duration}s`}</div>
                        <div className="text-xs text-slate-500">{activeMode === "live" ? "Auto-close" : "Expiry"}</div>
                      </div>
                      <Button variant="ghost" className="h-11 w-11 rounded-full text-2xl text-slate-100 lg:h-10 lg:w-10" onClick={() => stepDuration("next")}>+</Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Stake</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900 p-3">
                      <Button variant="ghost" className="h-11 w-11 rounded-full text-2xl text-slate-100 lg:h-10 lg:w-10" onClick={() => setStake((c) => Math.max(minStake, c - amountStep))}>-</Button>
                      <div className="text-center">
                        <div className="text-2xl font-bold">${stake.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">
                          Bal: {selectedBalance?.currency ?? "USD"} {balance.toFixed(2)}
                        </div>
                      </div>
                      <Button variant="ghost" className="h-11 w-11 rounded-full text-2xl text-slate-100 lg:h-10 lg:w-10" onClick={() => setStake((c) => c + amountStep)}>+</Button>
                    </div>
                    <Input
                      type="number"
                      min={minStake}
                      max={maxStake}
                      value={stake}
                      onBlur={() => setStake((current) => Math.min(maxStake, Math.max(minStake, Number(current || 0))))}
                      onChange={(e) => setStake(Number(e.target.value || 0))}
                      className="border-slate-800 bg-slate-900 text-slate-100"
                    />
                    {activeMode === "live" && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div className="rounded-xl bg-slate-900 px-3 py-2">Notional ${Math.max(minStake, stake).toFixed(2)}</div>
                        <div className="rounded-xl bg-slate-900 px-3 py-2">
                          Qty {estimatedQuantity ? estimatedQuantity.toFixed(6) : "waiting"}
                        </div>
                        <div className="rounded-xl bg-slate-900 px-3 py-2 col-span-2">
                          Fee estimate ~{(forecastQuery.data?.net_edge?.actual_cost_usdt ?? 0).toFixed(4)} USDT round trip
                          (~{(forecastQuery.data?.net_edge?.round_trip_fee_pct ?? 0).toFixed(4)}% fee + {(forecastQuery.data?.net_edge?.slippage_buffer_pct ?? 0).toFixed(4)}% slippage buffer).
                          Final PnL uses exchange fills when available.
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor="quick-trade-stop-loss" className="text-xs text-slate-400">
                            Stop Loss % (optional)
                          </Label>
                          <Input
                            id="quick-trade-stop-loss"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="Off"
                            value={stopLossPctInput}
                            onChange={(e) => setStopLossPctInput(e.target.value)}
                            className="border-slate-800 bg-slate-900 text-slate-100"
                          />
                          <div className="text-[11px] text-slate-500">
                            Closes this position early if unrealized loss reaches this % of stake. Leave blank to disable.
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor="quick-trade-take-profit" className="text-xs text-slate-400">
                            Take Profit % (optional)
                          </Label>
                          <Input
                            id="quick-trade-take-profit"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="Off"
                            value={takeProfitPctInput}
                            onChange={(e) => setTakeProfitPctInput(e.target.value)}
                            className="border-slate-800 bg-slate-900 text-slate-100"
                          />
                          <div className="text-[11px] text-slate-500">
                            Closes this position early once unrealized profit reaches this % of stake. Leave blank to disable.
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="quick-trade-leverage" className="text-xs text-slate-400">
                              Leverage (optional, off = 1x)
                            </Label>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={leverageEnabled}
                              onClick={() => setLeverageEnabled((c) => !c)}
                              className={cn(
                                "h-5 w-9 rounded-full transition-colors",
                                leverageEnabled ? "bg-emerald-500" : "bg-slate-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform",
                                  leverageEnabled && "translate-x-4"
                                )}
                              />
                            </button>
                          </div>
                          {leverageEnabled && (
                            <>
                              <Input
                                id="quick-trade-leverage"
                                type="number"
                                min={1}
                                step="0.1"
                                placeholder="1"
                                value={leverageInput}
                                onChange={(e) => setLeverageInput(e.target.value)}
                                className="border-slate-800 bg-slate-900 text-slate-100"
                              />
                              <div className="text-[11px] text-slate-500">
                                Real leverage change on your Binance account before entry. There is no app-side
                                maximum here — the exchange&apos;s own real max for this symbol/position size is
                                checked at order time, and the trade is rejected (never silently reduced) if it
                                doesn&apos;t support the requested leverage. Leverage above {"20"}x requires a
                                stop-loss % above to also be set.
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
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
                      <LiveTradeCard key={t.id} trade={t} currentPrice={freshPrice} slippagePct={slippageBufferPct} walletBalance={balance} walletCurrency={selectedBalance?.currency} />
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
                      <LiveTradeCard key={t.id} trade={t} currentPrice={undefined} slippagePct={slippageBufferPct} walletBalance={balance} walletCurrency={selectedBalance?.currency} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="space-y-5">
              <SignalSummaryCard signal={signal} />

              <ExecutionSafetyControls
                title="Global Execution Safety"
                moduleLabel="Quick Trade"
                values={safetyValues}
                telemetry={{
                  feedAgeSeconds: numberFrom(liveFeedDetail.age_seconds ?? runtimeHealth.data?.future_trade?.live_feed_age_seconds),
                  feedState: runtimeHealth.data?.future_trade?.live_feed,
                  feedReason: String(liveFeedDetail.reason ?? liveFeedDetail.state ?? ""),
                  truthSource: String(liveFeedDetail.truth_source ?? liveFeedDetail.source ?? feed.source ?? "binance_futures_ws"),
                  lastTickAt: String(liveFeedDetail.last_tick_at ?? liveFeedDetail.last_message_at ?? ""),
                  evaluatorAgeSeconds: numberFrom(runtimeHealth.data?.quick_trade?.settler_age_seconds),
                  evaluatorState: runtimeHealth.data?.quick_trade?.settler,
                  latestDecisionAgeSeconds: numberFrom(quickSettlerDetail.age_seconds),
                  chartLatencyMs: feed.latencyMs,
                  serverNow: runtimeHealth.data?.generated_at,
                }}
                onChange={setSafetyValues}
                onSave={saveRuntimeSafety}
                busy={updateRuntimeSafety.isPending}
              />

              <IndicatorsCard
                indicators={metadata?.indicators ?? []}
                indicatorSet={indicatorSet}
                supportingIndicators={signal?.supporting_indicators}
                conflictingIndicators={signal?.conflicting_indicators}
                onToggle={handleIndicatorToggle}
              />

              <TradeContextCard
                activeMode={activeMode}
                selectedProvider={selectedProvider}
                integrationLabel={integrationLabel}
                payoutRate={selectedSymbol?.payout_rate}
                balanceCurrency={selectedBalance?.currency ?? "USD"}
                balance={balance}
              />

              {/* Recent history */}
              <HistoryCard trades={historyTrades.data ?? []} />
            </div>
          </div>
        </div>
        <div id="quick-trade-research" className="mx-auto w-full max-w-[1600px] px-4 pb-20">
          <QuickTradeResearchPanel key={`${workspaceId}:${symbol}:${timeframe}:${duration}`} workspaceId={workspaceId} symbol={symbol} timeframe={timeframe} expirySeconds={duration} />
        </div>
        <MobileTradeNav />
      </div>
    </AppShell>
  );
}
