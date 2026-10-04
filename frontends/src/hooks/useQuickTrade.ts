import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { useEffect, useState } from "react";

function usePredictionClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function currentPrediction<T>(data: T | undefined, now: number): T | undefined {
  const expiry = (data as { calculation?: ForecastCalculationMeta } | undefined)?.calculation?.valid_until;
  return expiry && now < expiry * 1000 ? data : undefined;
}

/**
 * Latency telemetry for the async forecast worker (see
 * `App\Jobs\CalculateTradeForecast::handle()`), additive alongside the
 * existing `forecast.generated_at` decision timestamp. `generated_at`/
 * `requested_at`/`valid_until` here are unix seconds (job's own `time()`),
 * distinct from `forecast.generated_at`'s ISO string (`now()` inside
 * `TradeForecastService::forecast()`) -- both describe "when was this
 * decision computed", just with different clocks/formats from two
 * different layers; neither is a measure of quote/input freshness (see
 * `ForecastPayload.live_feed` for that).
 */
export interface ForecastCalculationMeta {
  requested_at: number;
  generated_at: number;
  valid_until: number;
  queue_wait_ms: number;
  compute_ms: number;
  symbol?: string | null;
  exchange?: string | null;
  timeframe?: string;
  expiry_seconds?: number;
}

// HTTP returns immediately while a dedicated worker calculates. The query
// keeps its original selection/input snapshot throughout polling.
async function backgroundForecast<T>(path: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; attempt < 16; attempt++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const result = await authorizedFetch(path, "POST", { ...payload, async: true }, { signal }) as T & { status?: string };
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (result.status !== "calculating") return result;
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error("Prediction is still calculating. Waiting for current data.");
}

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

export interface LiveExpiryPreset {
  timeframe: string;
  expiry_seconds: number;
  recommended: boolean;
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
    /** N4 -- live expiries at/above this show a "Stop Loss is off" warning. */
    require_stop_loss_min_expiry_seconds?: number;
    /** N4 -- when true the server also rejects such a trade without a stop. */
    enforce_stop_loss_min_expiry?: boolean;
    /** C1 -- live presets, already filtered to what the provider offers. */
    live_expiry_presets?: LiveExpiryPreset[];
    min_horizon_candles?: number;
  };
  robot_trade: {
    confidence_threshold: number;
    max_active_trades: number;
    cooldown_seconds: number;
    default_indicators?: string[];
    default_strategy_profile?: string;
    /** Defaults for NEW live robot sessions (config/robot_trade.php). */
    default_live_timeframe?: string;
    default_live_duration?: number;
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
  context_timeframe?: string;
  context_timeframe_seconds?: number;
  resolution_warning?: string | null;
  bias?: "BUY" | "SELL" | "NEUTRAL";
  current_trend?: "BUY" | "SELL" | "NEUTRAL";
  decision_trend?: "BUY" | "SELL" | "WAIT";
  confidence?: number;
  confidence_status?: string;
  generated_at?: string;
  expiry_at?: string;
  reference_price?: number;
  reference_price_source?: "fresh_canonical_quote" | "latest_candle_close";
  // Server-side canonical quote telemetry used by the forecast reference.
  // Null means this scope has no server WS snapshot yet; it is never filled
  // from the browser chart socket.
  live_feed?: {
    fresh: boolean;
    age_seconds?: number | null;
    event_lag_ms?: number | null;
    max_age_seconds?: number | null;
    max_event_lag_ms?: number | null;
    market_type?: string | null;
  } | null;
  current_price?: number;
  predicted_expiry_price?: number;
  predicted_low?: number;
  predicted_high?: number;
  predicted_move?: number;
  predicted_move_pct?: number;
  forecast_stability?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  forecast_stability_flips?: number;
  analysis_window?: { candles_used: number; micro: number; short: number };
  model_version?: string;
  evidence?: Record<string, number | boolean>;
  expected_mid_price?: number;
  expected_low?: number;
  expected_high?: number;
  atr_pct?: number;
  recent_bull_candles?: number;
  recent_bear_candles?: number;
  drift_pct?: number;
  summary?: string;
  // Additive market-context fields (backend TradeForecastService::contextFeatures()).
  // Descriptive evidence only, not an independent trade signal.
  market_context?: {
    volume_ratio?: number | null;
    volume_status?: "unknown" | "expanding" | "contracting" | "normal";
    support?: number | null;
    resistance?: number | null;
    support_distance_pct?: number | null;
    resistance_distance_pct?: number | null;
    local_range_pct?: number | null;
    regime?: "high_volatility" | "low_volatility" | "normal";
    liquidity_status?: string;
    liquidity_note?: string;
  };
  // Additive: which context safety gate (if any) forced decision_trend to WAIT.
  gate_reason?: "stale_data" | "low_volume" | "candle_gap" | null;
  // Additive: non-blocking caution flags surfaced alongside the decision.
  context_caution?: Array<"near_resistance" | "near_support" | string>;

  // ── Part A1: the two separate, honest answers ──────────────────────────
  // `direction` is what the model thinks price does by expiry, IGNORING
  // costs. `trade_decision` is whether that move is worth trading AFTER fees
  // and slippage. They come from one evaluation, not two engines, so they
  // always agree with the legacy `bias` / `decision_trend` fields above.
  direction?: {
    value: "BUY" | "SELL" | "NEUTRAL";
    source: string;
    expiry_score: number;
    expected_move_pct: number;
    fee_aware: false;
  };
  trade_decision?: {
    value: "BUY" | "SELL" | "WAIT";
    fee_aware: true;
    required_move_pct: number;
    max_achievable_move_pct: number;
    cost_pct: number;
    gate_reason: "stale_data" | "low_volume" | "candle_gap" | null;
    expected_move_pct: number;
    fee_model: "taker" | "maker_entry";
    fee_rate_source: "account" | "config";
    volatility_floor_pct: number;
  };

  // ── Part B: candle timing ──────────────────────────────────────────────
  // Null (never fabricated) when the caller did not supply candle timing.
  input_candles_include_forming_bar?: boolean | null;
  decision_candle_close_at?: string | null;
  seconds_since_last_close?: number | null;
  next_close_in_seconds?: number | null;
  candle_timing?: {
    timeframe_seconds: number;
    decision_candle_close_at: string | null;
    seconds_since_last_close: number | null;
    next_close_in_seconds: number | null;
    grace_ms: number;
    within_grace: boolean;
    candle_gap: boolean;
    forming_bar_dropped: boolean;
    timestamps_available: boolean;
    closed_candles_used: number;
    raw_candles_supplied: number;
  };
  decision_cache?: {
    status: "computed" | "reused" | "not_applicable";
    anchor_candle_close_ms?: number;
    next_decision_in_seconds?: number | null;
  };

  // ── Part C: fee economics ──────────────────────────────────────────────
  cost_model?: {
    fee_model: "taker" | "maker_entry";
    fee_rate_entry: number;
    fee_rate_exit: number;
    slippage_buffer_pct: number;
    cost_pct: number;
    cost_multiplier: number;
    required_move_pct: number;
    min_expected_net_usdt: number;
    fee_rate_source: "account" | "config";
  };
  duration_availability?: DurationAvailability[];
  shortest_viable_expiry_seconds?: number | null;
}

/** C2 -- per-duration viability at the CURRENT volatility, computed server-side. */
export interface DurationAvailability {
  expiry_seconds: number;
  horizon_candles: number;
  max_achievable_move_pct: number;
  required_move_pct: number;
  available: boolean;
  reason: string | null;
  short_live_expiry: boolean;
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
  // Part C4 -- which constraint is ACTUALLY binding. Replaces the old
  // "try a longer duration or a bigger stake" text, which was misleading
  // because fees and PnL both scale with notional.
  max_achievable_move_pct?: number | null;
  binding_constraint?: "duration" | "signal" | "stake" | "none";
  binding_constraint_hint?: string;
  fee_model?: "taker" | "maker_entry";
  fee_rate_source?: "account" | "config";
  // Gap-checklist N3 -- the USDT figures above are computed on `notional`
  // (margin x leverage, after exchange qty-step rounding when known), and
  // restated against the margin so leverage's real cost is visible.
  stake_margin?: number;
  notional?: number;
  leverage?: number;
  notional_rounding?: PositionSizingPayload["rounding"];
  round_trip_fee_usdt?: number;
  round_trip_fee_pct_of_margin?: number | null;
  actual_cost_pct_of_margin?: number | null;
}

/** Gap-checklist N3 -- what the order would actually be (backend-computed). */
export interface PositionSizingPayload {
  mode: string;
  stake_margin: number;
  leverage: number;
  leverage_applied: boolean;
  notional_target: number;
  reference_price: number | null;
  rounding: "exchange_step" | "unavailable" | "not_requested" | "not_applicable_paper";
  rounding_source: string | null;
  step_size: number | null;
  min_qty: number | null;
  min_notional: number | null;
  quantity: number | null;
  notional: number;
  below_exchange_minimum: boolean | null;
  cost_basis_notional: number;
}

export interface QuickTradeForecastPayload {
  forecast: ForecastPayload;
  net_edge: NetEdgePayload;
  position_sizing?: PositionSizingPayload;
  // Present on the async worker path (the only path today's frontend
  // callers use -- see `backgroundForecast()` below). Absent, not
  // fabricated, when a caller ever hits the synchronous path instead.
  calculation?: ForecastCalculationMeta;
}

export interface UnifiedForecastPayload {
  source: "unified";
  mode: "shadow";
  direction?: string | null;
  confidence?: number | null;
  status?: string | null;
  price_target_available: false;
  horizon_seconds?: number;
  calibrated?: boolean;
  calibration_evidence?: { sample_size?: number; hit_rate_pct?: number | null; confidence_bucket?: string | null };
}

export interface ForecastComparisonPayload {
  helpers?: {
    analysis: {
      trendDirection: string;
      trendCompositeScore: number;
      minComposite: number;
      windowBreakdown: Array<{ key: string; direction: string; score: number; sample_size: number; weight: number }>;
    };
    confidence: { favoredDirection: string | null; trendContribution: number; forecastContribution: number; forecastWeight: number; hitRatePct: number | null; sampleSize: number | null };
    calibrated: boolean;
  } | null;
  current: ForecastPayload & { source: "current"; mode: "primary"; price_target_available: true };
  unified: UnifiedForecastPayload | null;
  comparison: { direction_agreement: boolean | null; agreement: "AGREE" | "DISAGREE" | "UNAVAILABLE" };
  execution_source: "unchanged_existing_engine";
  calculation?: ForecastCalculationMeta;
}

export function useForecastComparison(params: {
  exchange?: string;
  marketContext?: string;
  botType: "quick_trade" | "robot_trade" | "future_trade";
  symbol: string;
  timeframe: string;
  expirySeconds: number;
  candles: ForecastCandle[];
  signal?: { direction?: string | null; confidence?: number | null };
}) {
  const now = usePredictionClock();
  const query = useQuery({
    queryKey: ["forecast-comparison", params.botType, params.exchange, params.marketContext, params.symbol, params.timeframe, params.expirySeconds],
    queryFn: ({ signal }) => backgroundForecast<ForecastComparisonPayload>("/forecast/comparison", {
      bot_type: params.botType, symbol: params.symbol, timeframe: params.timeframe,
      expiry_seconds: params.expirySeconds, candles: params.candles, signal: params.signal,
      exchange: params.exchange ?? "binance",
      market_context: params.marketContext,
    }, signal),
    enabled: params.candles.length >= 10 && !!params.symbol,
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 30000,
    retry: false,
    refetchIntervalInBackground: false,
  });
  return { ...query, data: currentPrediction(query.data, now) };
}

// ── VNext Dynamic Decision Engine, Phase A -- multi-window (short/medium/
// long) forecast comparison. Purely informational: nothing here places,
// blocks or alters a trade, and it never replaces/gates the single-window
// forecast above (`useQuickTradeForecast`) or the BUY/SELL flow. ──────────

export type MultiWindowLabel = "short" | "medium" | "long";

export interface MultiWindowEntry {
  window_label: MultiWindowLabel;
  timeframe: string;
  expiry_seconds: number;
  status: "calculating" | "ready" | "unavailable";
  retry_after_ms?: number;
  error?: string;
  forecast?: ForecastPayload;
  net_edge?: NetEdgePayload;
  position_sizing?: PositionSizingPayload;
}

export interface MultiWindowForecastPayload {
  schema_version: number;
  correlation_id: string;
  symbol: string;
  exchange: string;
  generated_at: string;
  windows: MultiWindowEntry[];
}

const MULTI_WINDOW_LABELS: MultiWindowLabel[] = ["short", "medium", "long"];

/**
 * Same "POST, then poll the same scope until it's no longer calculating"
 * contract as `backgroundForecast()` above, adapted for a response whose
 * status lives per-window rather than at the top level. The SAME candles
 * (captured once before the loop) and the server-issued `correlation_id`
 * are resent on every retry within one outer tick, so a retry is a genuine
 * AsyncTradeForecast cache hit once the background worker finishes -- not a
 * second computation.
 */
async function backgroundMultiWindowForecast(
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<MultiWindowForecastPayload> {
  let body = payload;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const result = (await authorizedFetch(
      "/quick-trade/forecast/multi-window",
      "POST",
      body,
      { signal },
    )) as MultiWindowForecastPayload;
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (result.windows.every((w) => w.status !== "calculating")) return result;
    body = { ...payload, correlation_id: result.correlation_id };
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error("Multi-window forecast is still calculating. Waiting for current data.");
}

/**
 * Computes the short/medium/long forecast comparison. `windowCandles` must
 * carry each window's OWN candles at that window's own chart timeframe
 * (fetched via `useQuickTradeChart` at 15m/1h/4h -- see
 * `MultiWindowForecastPanel`), not the primary ticket's chart candles.
 * Disabled (no request sent) until all 3 windows have at least 10 candles,
 * and further gated by the caller's own `enabled` (the panel is
 * collapsed/opt-in by default, so this never fires just from visiting the
 * page).
 */
export function useMultiWindowForecast(params: {
  symbol?: string;
  exchange?: string;
  stakeAmount: number;
  mode?: "paper" | "live";
  workspaceId?: string;
  integrationId?: string;
  windowCandles: Partial<Record<MultiWindowLabel, ForecastCandle[]>>;
  enabled?: boolean;
}) {
  const candleCounts = MULTI_WINDOW_LABELS.map((label) => params.windowCandles[label]?.length ?? 0);
  const lastCandleTimestamps = MULTI_WINDOW_LABELS.map((label) => {
    const candles = params.windowCandles[label];
    return candles && candles.length > 0 ? candles[candles.length - 1]?.timestamp ?? null : null;
  });
  const allWindowsHaveEnoughCandles = candleCounts.every((count) => count >= 10);

  return useQuery({
    queryKey: [
      "multi-window-forecast",
      params.symbol,
      params.exchange,
      params.stakeAmount,
      params.mode,
      params.workspaceId,
      ...candleCounts,
      ...lastCandleTimestamps,
    ],
    queryFn: ({ signal }) =>
      backgroundMultiWindowForecast(
        {
          symbol: params.symbol,
          exchange: params.exchange ?? "binance",
          stake_amount: params.stakeAmount,
          mode: params.mode,
          workspace_id: params.mode === "live" ? params.workspaceId : undefined,
          integration_id: params.mode === "live" ? params.integrationId : undefined,
          windows: {
            short: { candles: params.windowCandles.short ?? [] },
            medium: { candles: params.windowCandles.medium ?? [] },
            long: { candles: params.windowCandles.long ?? [] },
          },
        },
        signal,
      ),
    enabled: params.enabled !== false && allWindowsHaveEnoughCandles && !!params.symbol && params.stakeAmount > 0,
    // Deliberately slower than the primary single-window forecast (5000ms):
    // this computes 3 forecasts per tick and is purely informational, not
    // shown beside a live order button.
    refetchInterval: 15000,
    staleTime: 0,
    gcTime: 30000,
    retry: false,
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
  /** Candle OPEN time in ms. Required for the backend's "closed candles
   * only" decision rule (Part B) — without it the server honestly reports
   * that it cannot tell the forming bar apart, instead of guessing. */
  timestamp?: number;
  volume?: number;
}

export function useQuickTradeForecast(params: {
  exchange?: string;
  marketContext?: string;
  candles: ForecastCandle[];
  signal?: SignalPreview;
  timeframe: string;
  expirySeconds: number;
  stakeAmount: number;
  symbol?: string;
  /** Part C2: lets the backend mark each duration option available or not at
   * the current volatility, and (in live mode) hide the ones that cannot
   * clear fees. */
  mode?: "paper" | "live";
  durations?: number[];
  /** Gap-checklist N3 -- the order form's effective leverage (live only), so
   * net_edge/position_sizing are computed on the leveraged notional. */
  leverage?: number;
  /** Live only: lets the backend price the preview off the selected
   * integration's real Binance fee when `quick_trade.use_account_fee_rate`
   * is on, so the preview matches the placement-time guard. */
  workspaceId?: string;
  integrationId?: string;
}) {
  const candleCount = params.candles?.length ?? 0;
  const now = usePredictionClock();

  const query = useQuery({
    queryKey: [
      "quick-trade-forecast",
      params.exchange,
      params.marketContext,
      params.timeframe,
      params.expirySeconds,
      params.stakeAmount,
      params.symbol,
      params.mode,
      (params.durations ?? []).join(","),
      params.leverage,
    ],
    queryFn: ({ signal }) =>
      backgroundForecast<QuickTradeForecastPayload>("/quick-trade/forecast", {
        candles: params.candles,
        mode: params.mode,
        durations: params.durations,
        signal: params.signal
          ? { direction: params.signal.direction, confidence: params.signal.confidence }
          : undefined,
        timeframe: params.timeframe,
        expiry_seconds: params.expirySeconds,
        stake_amount: params.stakeAmount,
        leverage: params.leverage,
        symbol: params.symbol,
        exchange: params.exchange ?? "binance",
        market_context: params.marketContext,
        workspace_id: params.mode === "live" ? params.workspaceId : undefined,
        integration_id: params.mode === "live" ? params.integrationId : undefined,
      }, signal),
    enabled: candleCount >= 10 && params.stakeAmount > 0,
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 30000,
    retry: false,
    refetchIntervalInBackground: false,
  });
  return { ...query, data: currentPrediction(query.data, now) };
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

export function useQuickTradeHistory(workspaceId?: string, source?: string, robotSessionId?: string, limit = 100, mode?: "paper" | "live") {
  const search = new URLSearchParams();
  if (source) search.set("source", source);
  if (mode) search.set("mode", mode);
  if (robotSessionId) search.set("robot_session_id", robotSessionId);
  search.set("limit", String(limit));

  return useQuery({
    queryKey: ["quick-trade-history", workspaceId, source, robotSessionId, limit, mode],
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
