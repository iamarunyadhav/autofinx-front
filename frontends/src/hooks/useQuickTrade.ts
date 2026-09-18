import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

const QUICK_TRADE_ACTIVE_REFRESH_MS = 8000;
const QUICK_TRADE_HISTORY_REFRESH_MS = 15000;
const QUICK_TRADE_CHART_REFRESH_MS = 6000;
import { useToast } from "@/hooks/use-toast";

export type TradeDirection = "buy" | "sell" | "neutral";

export interface TradeSymbolOption {
  symbol: string;
  display: string;
  asset_class: string;
  payout_rate: number;
}

export interface TimeframeOption {
  key: string;
  label: string;
  seconds: number;
}

export interface DurationOption {
  seconds: number;
  label: string;
}

export interface QuickTradeMetadata {
  symbols: TradeSymbolOption[];
  indicators: Array<{ key: string; label: string; description: string }>;
  chart_types: Array<{ key: string; label: string }>;
  timeframes: TimeframeOption[];
  durations: DurationOption[];
  quick_trade: {
    default_duration: number;
    default_timeframe: string;
    min_stake: number;
    max_stake: number;
    max_active_trades: number;
    payout_rate: number;
    paper_only: boolean;
    live_supported: boolean;
    default_provider: string;
    allowed_indicators: string[];
    active_mode: "paper" | "live";
    selected_provider: string;
  };
  robot_trade: {
    confidence_threshold: number;
    max_active_trades: number;
    cooldown_seconds: number;
    default_indicators?: string[];
    default_strategy_profile?: string;
    strategy_profiles: Array<{ key: string; label: string; max_active_trades: number; confidence_threshold: number }>;
  };
  trading_state: {
    mode: "paper" | "live";
    live_enabled: boolean;
    auto_trading_enabled?: boolean;
    bot_default_interval_seconds?: number;
    preferred_provider: string;
    preferred_integration_id?: string | null;
    preferred_integration_label?: string | null;
    venue_environment?: string | null;
    exchange_environment?: string | null;
    live_ready: boolean;
    live_ready_reason?: string | null;
    active_integrations: Array<{
      id: string;
      provider_key: string;
      display_name: string;
      status: string;
      last_health_status?: string | null;
      environment?: string | null;
      config_json?: Record<string, unknown>;
    }>;
    provider_catalog: Record<
      string,
      {
        key: string;
        label: string;
        asset_class?: "CRYPTO" | "FOREX" | string;
        live_supported: boolean;
        default_market_type?: string;
        supports_short?: boolean;
        requires_integration?: boolean;
        symbols: TradeSymbolOption[];
        timeframes: string[];
        durations: number[];
      }
    >;
    provider_profile?: {
      key: string;
      label: string;
      live_supported: boolean;
      default_market_type?: string;
      supports_short?: boolean;
      requires_integration?: boolean;
    };
  };
}

export interface SignalPreview {
  direction: TradeDirection;
  confidence: number;
  bullish_score: number;
  bearish_score: number;
  neutral_score: number;
  supporting_indicators: string[];
  conflicting_indicators: string[];
  reasons: string[];
  indicator_values: Record<string, unknown>;
  timeframe: string;
}

export interface ChartCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  opens_at: string;
}

export interface QuickTradeChartPayload {
  symbol: string;
  timeframe: string;
  chart_type: string;
  candles: ChartCandle[];
  quote: {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    volume: number;
    occurred_at: string;
  };
  signal_preview: SignalPreview;
}

export interface ForecastPayload {
  available: boolean;
  horizon_seconds?: number;
  horizon_candles?: number;
  bias?: "BUY" | "SELL" | "NEUTRAL";
  confidence?: number;
  current_price?: number;
  expected_mid_price?: number;
  expected_low?: number;
  expected_high?: number;
  atr_pct?: number;
  recent_bull_candles?: number;
  recent_bear_candles?: number;
  drift_pct?: number;
  summary?: string;
}

export interface NetEdgePayload {
  tradeable: boolean;
  stake: number;
  atr_pct: number;
  expected_move_pct: number;
  fee_rate: number;
  round_trip_fee_pct: number;
  slippage_buffer_pct: number;
  required_move_pct: number;
  expected_gross_usdt: number;
  required_cost_usdt: number;
  expected_net_usdt: number;
  min_expected_net_usdt: number;
  actual_cost_usdt: number;
  expected_net_usdt_actual: number;
  reason?: string;
}

export interface QuickTradeForecastPayload {
  forecast: ForecastPayload;
  net_edge: NetEdgePayload;
  unified?: UnifiedForecastPayload | null;
  comparison?: { direction_agreement: boolean | null; agreement: "AGREE" | "DISAGREE" | "UNAVAILABLE" };
}

export interface UnifiedForecastPayload {
  source: "unified";
  mode: "shadow";
  direction?: string | null;
  confidence?: number | null;
  status?: string | null;
  price_target_available: false;
  horizon_seconds?: number;
}

export interface ForecastComparisonPayload {
  current: ForecastPayload & { source: "current"; mode: "primary"; price_target_available: true };
  unified: UnifiedForecastPayload | null;
  comparison: { direction_agreement: boolean | null; agreement: "AGREE" | "DISAGREE" | "UNAVAILABLE" };
  execution_source: "unchanged_existing_engine";
}

export function useForecastComparison(params: {
  botType: "robot_trade" | "future_trade";
  symbol: string;
  timeframe: string;
  expirySeconds: number;
  candles: ForecastCandle[];
  signal?: { direction?: string | null; confidence?: number | null };
}) {
  const lastClose = params.candles.at(-1)?.close ?? null;
  return useQuery({
    queryKey: ["forecast-comparison", params.botType, params.symbol, params.timeframe, params.expirySeconds, lastClose, params.candles.length, params.signal?.direction],
    queryFn: () => authorizedFetch("/forecast/comparison", "POST", {
      bot_type: params.botType, symbol: params.symbol, timeframe: params.timeframe,
      expiry_seconds: params.expirySeconds, candles: params.candles, signal: params.signal,
      exchange: "binance",
    }) as Promise<ForecastComparisonPayload>,
    enabled: params.candles.length >= 10 && !!params.symbol,
    refetchInterval: QUICK_TRADE_HISTORY_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export interface QuickTradeRecord {
  id: string;
  workspace_id: string;
  order_id?: string | null;
  close_order_id?: string | null;
  integration_id?: string | null;
  robot_session_id?: string | null;
  wallet_account_id?: string | null;
  symbol: string;
  asset_class: string;
  side: "buy" | "sell";
  stake_amount: number;
  quantity?: number | null;
  timeframe: string;
  expiry_seconds: number;
  payout_ratio: number;
  mode: string;
  source: string;
  provider_key?: string | null;
  quote_currency?: string | null;
  entry_price: number;
  exit_price?: number | null;
  confidence?: number | null;
  status: string;
  profit_loss: number;
  payout_amount: number;
  fees_total?: number | null;
  gross_pnl?: number | string | null;
  entry_fee_actual?: number | string | null;
  exit_fee_actual?: number | string | null;
  funding_fee_actual?: number | string | null;
  fee_source?: string | null;
  entry_trade_id?: string | null;
  close_trade_id?: string | null;
  signal_payload?: (SignalPreview & {
    execution_cost?: {
      fee_model?: string;
      entry_fee?: number | string | null;
      exit_fee?: number | string | null;
      total_fees?: number | string | null;
      gross_pnl?: number | string | null;
      net_pnl?: number | string | null;
      entry_slippage_pct?: number | string | null;
      exit_slippage_pct?: number | string | null;
      entry_reference_price?: number | string | null;
      exit_reference_price?: number | string | null;
      entry_notional?: number | string | null;
      exit_notional?: number | string | null;
      fee_rate?: number | string | null;
    };
  }) | null;
  indicator_snapshot?: Record<string, unknown> | null;
  entry_at: string;
  expires_at: string;
  settled_at?: string | null;
  // Optional per-trade stop-loss, live mode only. Null = feature off.
  stop_loss_pct?: number | string | null;
  stop_loss_triggered_at?: string | null;
  // Optional per-trade take-profit, live mode only. Null = feature off.
  // POSITIVE value (opposite sign convention from stop_loss_pct).
  take_profit_pct?: number | string | null;
  take_profit_triggered_at?: string | null;
  // Optional per-trade leverage, live mode only. leverage is only meaningful
  // when leverage_enabled is true; null/false = feature off (1x, unchanged).
  leverage_enabled?: boolean | null;
  leverage?: number | string | null;
}

interface PlaceQuickTradePayload {
  workspace_id: string;
  wallet_account_id?: string;
  symbol: string;
  side: "buy" | "sell";
  stake_amount: number;
  timeframe: string;
  expiry_seconds: number;
  mode?: "paper" | "live";
  provider?: string;
  integration_id?: string;
  indicator_set?: string[];
  idempotency_key?: string;
  // Optional per-trade stop-loss — only meaningful (and only sent) for live
  // mode; a negative percentage of stake, e.g. -2 for a 2% stop.
  stop_loss_pct?: number;
  // Optional per-trade take-profit — only meaningful (and only sent) for live
  // mode; a POSITIVE percentage of stake, e.g. 5 for a 5% target.
  take_profit_pct?: number;
  // Optional per-trade leverage — only meaningful (and only sent) for live
  // mode. No app-layer upper bound; the real ceiling is whatever the
  // exchange actually supports for this symbol/notional (the backend
  // rejects, never silently clamps, an over-limit request).
  leverage_enabled?: boolean;
  leverage?: number;
}

export function useQuickTradeMetadata(workspaceId?: string) {
  return useQuery({
    queryKey: ["quick-trade-metadata", workspaceId],
    queryFn: async () =>
      authorizedFetch(`/quick-trade/metadata${workspaceId ? `?workspace_id=${workspaceId}` : ""}`) as Promise<QuickTradeMetadata>,
    staleTime: 60_000,
  });
}

export function useQuickTradeChart(params: {
  workspaceId?: string;
  symbol: string;
  timeframe: string;
  chartType: string;
  indicatorSet: string[];
  mode?: "paper" | "live";
  provider?: string;
  integrationId?: string;
  /**
   * Optional value that changes only when a new candle actually closes on
   * the live WS/SSE feed (e.g. the timestamp of the most recently closed
   * candle). Including it in the query key makes the Robot Signal refetch
   * promptly on a real candle close instead of waiting for the fallback
   * `refetchInterval` — mirrors how `useQuickTradeForecast` already re-keys
   * off `lastClose`/`candleCount`. Does not affect the request itself.
   */
  candleCloseSignal?: number | null;
}) {
  const search = new URLSearchParams();
  if (params.workspaceId) search.set("workspace_id", params.workspaceId);
  search.set("symbol", params.symbol);
  search.set("timeframe", params.timeframe);
  search.set("chart_type", params.chartType);
  if (params.mode) search.set("mode", params.mode);
  if (params.provider) search.set("provider", params.provider);
  if (params.integrationId) search.set("integration_id", params.integrationId);
  params.indicatorSet.forEach((indicator) => search.append("indicator_set[]", indicator));

  return useQuery({
    queryKey: [
      "quick-trade-chart",
      params.workspaceId,
      params.symbol,
      params.timeframe,
      params.chartType,
      params.mode,
      params.provider,
      params.integrationId,
      params.indicatorSet.join(","),
      params.candleCloseSignal ?? null,
    ],
    queryFn: async () => authorizedFetch(`/quick-trade/chart?${search.toString()}`) as Promise<QuickTradeChartPayload>,
    enabled: !!params.symbol,
    // Refetches immediately when candleCloseSignal changes (a live candle just
    // closed on the WS/SSE feed) — the interval below is only a fallback for
    // when that feed is disconnected/unavailable (non-crypto SSE fallback, WS
    // drop, etc.), so Robot Signal never stalls entirely.
    refetchInterval: QUICK_TRADE_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export interface ForecastCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useQuickTradeForecast(params: {
  candles: ForecastCandle[];
  signal?: SignalPreview;
  timeframe: string;
  expirySeconds: number;
  stakeAmount: number;
  symbol?: string;
}) {
  const candleCount = params.candles?.length ?? 0;
  const lastClose = candleCount > 0 ? params.candles[candleCount - 1]?.close : null;

  return useQuery({
    queryKey: [
      "quick-trade-forecast",
      lastClose,
      candleCount,
      params.timeframe,
      params.expirySeconds,
      params.stakeAmount,
      params.symbol,
      params.signal?.direction,
      params.signal?.confidence,
    ],
    queryFn: async () =>
      authorizedFetch("/quick-trade/forecast", "POST", {
        candles: params.candles,
        signal: params.signal
          ? { direction: params.signal.direction, confidence: params.signal.confidence }
          : undefined,
        timeframe: params.timeframe,
        expiry_seconds: params.expirySeconds,
        stake_amount: params.stakeAmount,
        symbol: params.symbol,
        exchange: "binance",
      }) as Promise<QuickTradeForecastPayload>,
    enabled: candleCount >= 10 && params.stakeAmount > 0,
    refetchInterval: QUICK_TRADE_HISTORY_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useQuickTradeActive(workspaceId?: string, source?: string, robotSessionId?: string) {
  const search = new URLSearchParams();
  if (source) search.set("source", source);
  if (robotSessionId) search.set("robot_session_id", robotSessionId);

  return useQuery({
    queryKey: ["quick-trade-active", workspaceId, source, robotSessionId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const suffix = search.toString() ? `?${search.toString()}` : "";
      return authorizedFetch(`/workspaces/${workspaceId}/quick-trades/active${suffix}`) as Promise<QuickTradeRecord[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: QUICK_TRADE_ACTIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useQuickTradeHistory(workspaceId?: string, source?: string, robotSessionId?: string, limit = 100) {
  const search = new URLSearchParams();
  if (source) search.set("source", source);
  if (robotSessionId) search.set("robot_session_id", robotSessionId);
  search.set("limit", String(limit));

  return useQuery({
    queryKey: ["quick-trade-history", workspaceId, source, robotSessionId, limit],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/quick-trades/history?${search.toString()}`) as Promise<QuickTradeRecord[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: QUICK_TRADE_HISTORY_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

export function usePlaceQuickTrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: PlaceQuickTradePayload) =>
      (authorizedFetch("/quick-trade/place", "POST", payload) as Promise<QuickTradeRecord>),
    onSuccess: (trade) => {
      queryClient.invalidateQueries({ queryKey: ["quick-trade-active", trade.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-history", trade.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ["balances", trade.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", trade.workspace_id] });
      toast({
        title: "Quick trade opened",
        description: `${trade.side.toUpperCase()} ${trade.symbol} for $${Number(trade.stake_amount).toFixed(2)}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Quick trade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSettleQuickTrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (limit: number = 100) =>
      authorizedFetch("/quick-trade/settle-due", "POST", { limit }) as Promise<{ settled: QuickTradeRecord[] }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-trade-active"] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-history"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
