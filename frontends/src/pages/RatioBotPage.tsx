import { useEffect, useState, type ReactNode } from "react";
import {
  ActivitySquare,
  AlertTriangle,
  Bot,
  Pause,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Square,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConnections } from "@/hooks/useConnections";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

const EMPTY_BOTS: RatioBotConfig[] = [];
const EMPTY_CANDLES: CandleRecord[] = [];
const EMPTY_INTEGRATIONS: IntegrationRecord[] = [];
const EMPTY_DECISIONS: RatioDecision[] = [];
const EMPTY_EVENTS: RatioEvent[] = [];

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface RatioBotState {
  position_state?: string | null;
  last_buy_price?: string | null;
  last_sell_price?: string | null;
  last_trade_side?: string | null;
  last_trade_time?: string | null;
  active_anchor_price?: string | null;
  active_anchor_type?: string | null;
  last_seen_price?: string | null;
  current_ratio?: string | null;
  last_price_source?: string | null;
  last_price_timestamp?: string | null;
  cooldown_until?: string | null;
  block_reason_code?: string | null;
  block_reason_detail?: string | null;
  consecutive_order_failures?: number | null;
  recovery_action_required?: boolean | null;
  sell_armed?: boolean | null;
  sell_peak_ratio?: string | null;
  sell_peak_price?: string | null;
  buy_armed?: boolean | null;
  buy_trough_ratio?: string | null;
  buy_trough_price?: string | null;
  pending_trigger_side?: string | null;
  pending_trigger_started_at?: string | null;
  pending_trigger_updates?: number | null;
  pending_trigger_ratio?: string | null;
  pending_trigger_price?: string | null;
  last_active_idempotency_key?: string | null;
  last_unresolved_order_id?: string | null;
  last_unresolved_client_order_id?: string | null;
  feed_status?: string | null;
  feed_status_updated_at?: string | null;
  last_signal?: string | null;
  last_signal_at?: string | null;
  last_order_status?: string | null;
  last_fill_price?: string | null;
  last_position_side?: string | null;
  last_position_qty?: string | null;
  entry_price?: string | null;
  unrealized_pnl?: string | null;
  last_runtime_error?: string | null;
}

interface RatioBotConfig {
  id: string;
  workspace_id?: string;
  name: string;
  symbol: string;
  exchange?: string | null;
  enabled?: boolean;
  market_type?: "spot" | "futures" | string | null;
  algorithm?: string | null;
  timeframe?: string | null;
  side_mode?: string | null;
  mode?: string | null;
  execution_mode?: string | null;
  evaluation_mode?: string | null;
  connection_id?: string | null;
  integration_id?: string | null;
  base_quote_amount?: string | number | null;
  base_asset_budget?: string | number | null;
  quote_asset_budget?: string | number | null;
  order_size_mode?: string | null;
  sell_threshold_ratio?: string | number | null;
  buy_threshold_ratio?: string | number | null;
  poll_interval_seconds?: number | null;
  min_seconds_between_evaluations?: number | null;
  cooldown_seconds_after_trade?: number | null;
  fee_bps?: string | number | null;
  max_slippage_bps?: string | number | null;
  max_allowed_slippage_bps?: string | number | null;
  min_net_profit_bps?: string | number | null;
  max_trades_per_hour?: number | null;
  max_trades_per_day?: number | null;
  stale_feed_max_age_seconds?: number | null;
  stale_feed_timeout_seconds?: number | null;
  pause_on_stale_feed?: boolean | null;
  pause_on_exchange_unhealthy?: boolean | null;
  pause_on_slippage_spike?: boolean | null;
  pause_on_order_failure_streak?: number | null;
  require_stop_loss?: boolean | null;
  stop_loss_pct?: string | number | null;
  require_take_profit?: boolean | null;
  take_profit_pct?: string | number | null;
  require_time_stop?: boolean | null;
  time_stop_minutes?: number | null;
  allow_partial_sell?: boolean | null;
  partial_sell_pct?: string | number | null;
  allow_partial_buy?: boolean | null;
  partial_buy_pct?: string | number | null;
  use_advisory_filter?: boolean | null;
  advisory_mode?: string | null;
  trigger_mode?: string | null;
  selling_loss_ratio?: string | number | null;
  buying_loss_ratio?: string | number | null;
  trigger_confirm_seconds?: number | null;
  trigger_confirm_updates?: number | null;
  use_candle_close_confirmation?: boolean | null;
  min_price_stability_seconds?: number | null;
  max_spike_deviation_bps?: string | number | null;
  daily_loss_limit_pct?: string | number | null;
  max_drawdown_pct?: string | number | null;
  max_open_orders?: number | null;
  max_position_pct?: string | number | null;
  kill_switch?: boolean | null;
  leverage?: string | number | null;
  margin_type?: string | null;
  position_mode?: string | null;
  reduce_only_exit_orders?: boolean | null;
  max_open_position_per_symbol?: string | number | null;
  allow_reverse_signal?: boolean | null;
  close_on_opposite_signal?: boolean | null;
  risk_per_trade?: string | number | null;
  max_daily_loss?: string | number | null;
  max_consecutive_losses?: number | null;
  strategy_params?: JsonRecord | null;
  state?: RatioBotState | null;
  snapshot?: RuntimeSnapshot | null;
}

interface RatioDisplay {
  current_price?: number;
  position_state?: string | null;
  active_anchor_price?: number | null;
  active_anchor_type?: string | null;
  sell_ratio?: number | null;
  buy_ratio?: number | null;
  effective_sell_ratio?: number | null;
  effective_buy_ratio?: number | null;
  cost_ratio?: number | null;
  sell_threshold?: string | null;
  buy_threshold?: string | null;
  sell_distance_pct?: number | null;
  buy_distance_pct?: number | null;
  unrealized_pnl?: number | null;
  sell_armed?: boolean | null;
  sell_peak_ratio?: string | null;
  buy_armed?: boolean | null;
  buy_trough_ratio?: string | null;
  pending_trigger_side?: string | null;
  pending_trigger_updates?: number | null;
  pending_trigger_ratio?: string | null;
}

interface RatioDecision {
  id: string;
  decision?: string | null;
  execution_status?: string | null;
  evaluated_price?: string | null;
  computed_ratio?: string | null;
  reason?: string | null;
  price_source?: string | null;
  decided_at?: string | null;
}

interface RatioEvent {
  id: string;
  event_type?: string | null;
  context?: JsonRecord | null;
  occurred_at?: string | null;
}

interface FeedHealth extends JsonRecord {
  status?: string | null;
  state?: string | null;
  health?: string | null;
  market_type?: string | null;
  symbol?: string | null;
  last_message_at?: string | null;
  last_trade_at?: string | null;
  lag_seconds?: number | null;
  state_feed_status?: string | null;
  state_feed_status_updated_at?: string | null;
}

interface RuntimeStatus {
  symbol?: string | null;
  market_type?: string | null;
  timeframe?: string | null;
  algorithm?: string | null;
  bot_status?: string | null;
  feed_status?: string | null;
  last_signal?: string | null;
  last_signal_at?: string | null;
  last_order_status?: string | null;
  last_fill_price?: string | number | null;
  current_position_side?: string | null;
  current_position_qty?: string | number | null;
  unrealized_pnl?: string | number | null;
  cooldown_until?: string | null;
  kill_switch?: boolean | null;
  error_state?: string | null;
}

interface OrderRecord extends JsonRecord {
  id?: string;
  status?: string | null;
  side?: string | null;
  type?: string | null;
  price?: string | number | null;
  avg_fill_price?: string | number | null;
  quantity?: string | number | null;
  qty?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  external_id?: string | null;
  client_order_id?: string | null;
}

interface PositionRecord extends JsonRecord {
  side?: string | null;
  position_side?: string | null;
  qty?: string | number | null;
  quantity?: string | number | null;
  entry_price?: string | number | null;
  unrealized_pnl?: string | number | null;
  mark_price?: string | number | null;
  liquidation_price?: string | number | null;
  updated_at?: string | null;
}

interface PnlSummary {
  today_realized_pnl?: number | null;
  unrealized_pnl?: number | null;
  current_position_qty?: number | null;
  current_position_side?: string | null;
}

interface RuntimeSnapshot {
  config?: RatioBotConfig | null;
  feed?: FeedHealth | null;
  last_signal?: RatioDecision | null;
  last_order?: OrderRecord | null;
  position?: PositionRecord | null;
  pnl?: PnlSummary | null;
}

interface CandleRecord {
  ts?: number | string | null;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  volume?: number | string | null;
}

interface IntegrationRecord {
  id: string;
  display_name?: string | null;
  provider_key?: string | null;
  type?: string | null;
  status?: string | null;
}

interface FuturesReadiness extends JsonRecord {
  state?: string | null;
  supports_manual_test_order?: boolean | null;
  supports_auto_execution?: boolean | null;
  futures_force_testnet?: boolean | null;
}

type BotForm = {
  name: string;
  symbol: string;
  market_type: "spot" | "futures";
  algorithm: "ratio_threshold" | "trailing_ratio" | "ma_crossover" | "rsi" | "breakout";
  timeframe: "1m" | "3m" | "5m" | "15m";
  side_mode: "buy_sell" | "long_only" | "short_only" | "both";
  mode: "advisor" | "manual_approval" | "restricted_auto";
  execution_mode: "sandbox" | "live";
  evaluation_mode: "hybrid" | "tick" | "candle_close" | "websocket" | "polling";
  connection_id: string;
  integration_id: string;
  base_quote_amount: string;
  base_asset_budget: string;
  quote_asset_budget: string;
  order_size_mode: "fixed_quote" | "fixed_base" | "percent_of_balance";
  sell_threshold_ratio: string;
  buy_threshold_ratio: string;
  poll_interval_seconds: string;
  min_seconds_between_evaluations: string;
  cooldown_seconds_after_trade: string;
  fee_bps: string;
  max_slippage_bps: string;
  max_allowed_slippage_bps: string;
  min_net_profit_bps: string;
  max_trades_per_hour: string;
  max_trades_per_day: string;
  stale_feed_max_age_seconds: string;
  stale_feed_timeout_seconds: string;
  pause_on_stale_feed: boolean;
  pause_on_exchange_unhealthy: boolean;
  pause_on_slippage_spike: boolean;
  pause_on_order_failure_streak: string;
  require_stop_loss: boolean;
  stop_loss_pct: string;
  require_take_profit: boolean;
  take_profit_pct: string;
  require_time_stop: boolean;
  time_stop_minutes: string;
  allow_partial_sell: boolean;
  partial_sell_pct: string;
  allow_partial_buy: boolean;
  partial_buy_pct: string;
  use_advisory_filter: boolean;
  advisory_mode: string;
  trigger_mode: "threshold" | "trailing_ratio";
  selling_loss_ratio: string;
  buying_loss_ratio: string;
  trigger_confirm_seconds: string;
  trigger_confirm_updates: string;
  use_candle_close_confirmation: boolean;
  min_price_stability_seconds: string;
  max_spike_deviation_bps: string;
  daily_loss_limit_pct: string;
  max_drawdown_pct: string;
  max_open_orders: string;
  max_position_pct: string;
  kill_switch: boolean;
  leverage: string;
  margin_type: "isolated" | "cross";
  position_mode: "one_way" | "hedge";
  reduce_only_exit_orders: boolean;
  max_open_position_per_symbol: string;
  allow_reverse_signal: boolean;
  close_on_opposite_signal: boolean;
  risk_per_trade: string;
  max_daily_loss: string;
  max_consecutive_losses: string;
  strategy_params_json: string;
};

const STRATEGY_DEFAULTS: Record<BotForm["algorithm"], JsonRecord> = {
  ratio_threshold: {
    buy_threshold_ratio: -0.015,
    sell_threshold_ratio: 0.015,
    confirm_ticks: 2,
  },
  trailing_ratio: {
    activation_ratio: 0.01,
    trailing_distance_ratio: 0.004,
    exit_on_retrace: true,
  },
  ma_crossover: {
    fast_period: 9,
    slow_period: 21,
    source: "close",
  },
  rsi: {
    period: 14,
    oversold: 30,
    overbought: 70,
    source: "close",
  },
  breakout: {
    lookback_candles: 20,
    breakout_buffer_pct: 0.15,
    use_volume_confirmation: false,
  },
};

const INITIAL_FORM: BotForm = {
  name: "BTC realtime engine",
  symbol: "BTCUSDT",
  market_type: "spot",
  algorithm: "ratio_threshold",
  timeframe: "1m",
  side_mode: "buy_sell",
  mode: "manual_approval",
  execution_mode: "sandbox",
  evaluation_mode: "hybrid",
  connection_id: "none",
  integration_id: "none",
  base_quote_amount: "25",
  base_asset_budget: "",
  quote_asset_budget: "250",
  order_size_mode: "fixed_quote",
  sell_threshold_ratio: "0.015",
  buy_threshold_ratio: "-0.015",
  poll_interval_seconds: "5",
  min_seconds_between_evaluations: "1",
  cooldown_seconds_after_trade: "60",
  fee_bps: "10",
  max_slippage_bps: "30",
  max_allowed_slippage_bps: "50",
  min_net_profit_bps: "10",
  max_trades_per_hour: "6",
  max_trades_per_day: "20",
  stale_feed_max_age_seconds: "30",
  stale_feed_timeout_seconds: "45",
  pause_on_stale_feed: true,
  pause_on_exchange_unhealthy: true,
  pause_on_slippage_spike: true,
  pause_on_order_failure_streak: "3",
  require_stop_loss: false,
  stop_loss_pct: "",
  require_take_profit: false,
  take_profit_pct: "",
  require_time_stop: false,
  time_stop_minutes: "",
  allow_partial_sell: false,
  partial_sell_pct: "",
  allow_partial_buy: false,
  partial_buy_pct: "",
  use_advisory_filter: false,
  advisory_mode: "off",
  trigger_mode: "threshold",
  selling_loss_ratio: "",
  buying_loss_ratio: "",
  trigger_confirm_seconds: "0",
  trigger_confirm_updates: "1",
  use_candle_close_confirmation: false,
  min_price_stability_seconds: "0",
  max_spike_deviation_bps: "",
  daily_loss_limit_pct: "",
  max_drawdown_pct: "",
  max_open_orders: "1",
  max_position_pct: "",
  kill_switch: false,
  leverage: "3",
  margin_type: "isolated",
  position_mode: "one_way",
  reduce_only_exit_orders: true,
  max_open_position_per_symbol: "1",
  allow_reverse_signal: false,
  close_on_opposite_signal: true,
  risk_per_trade: "1",
  max_daily_loss: "50",
  max_consecutive_losses: "3",
  strategy_params_json: JSON.stringify(STRATEGY_DEFAULTS.ratio_threshold, null, 2),
};

function formatDateTime(value?: string | number | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value?: string | number | null, maximumFractionDigits = 4) {
  const parsed = toNumber(value);
  if (parsed === null) return "None";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(parsed);
}

function formatRatioPercent(value?: string | number | null) {
  const parsed = toNumber(value);
  if (parsed === null) return "None";
  return `${(parsed * 100).toFixed(2)}%`;
}

function formatBoolean(value?: boolean | null) {
  return value ? "Yes" : "No";
}

function prettyLabel(value?: string | null) {
  if (!value) return "None";
  return value.replace(/_/g, " ");
}

function statusVariant(value?: string | null): BadgeVariant {
  const normalized = (value || "").toLowerCase();
  if (!normalized) return "outline";
  if (["healthy", "running", "holding", "flat", "filled", "buy", "sell", "long", "short", "active", "connected"].includes(normalized)) {
    return "default";
  }
  if (["degraded", "paused", "pending", "sandbox", "manual_approval"].includes(normalized)) {
    return "secondary";
  }
  if (["stale", "blocked", "error", "failed", "rejected", "canceled", "cancelled", "kill_switch"].includes(normalized)) {
    return "destructive";
  }
  return "outline";
}

function parseNullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function parseNullableInteger(value: string) {
  return value.trim() === "" ? null : parseInt(value, 10);
}

function parseNullableUuid(value: string) {
  return value === "none" ? null : value;
}

function safeParseStrategyParams(json: string) {
  if (!json.trim()) {
    return { data: {}, error: null as string | null };
  }

  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { data: parsed as JsonRecord, error: null as string | null };
    }

    return { data: null, error: "Strategy params must be a JSON object." };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function buildFormFromConfig(config: RatioBotConfig): BotForm {
  const algorithm = normalizeAlgorithm(config.algorithm);
  return {
    ...INITIAL_FORM,
    name: config.name || INITIAL_FORM.name,
    symbol: config.symbol || INITIAL_FORM.symbol,
    market_type: normalizeMarketType(config.market_type),
    algorithm,
    timeframe: normalizeTimeframe(config.timeframe),
    side_mode: normalizeSideMode(config.side_mode, config.market_type),
    mode: normalizeMode(config.mode),
    execution_mode: normalizeExecutionMode(config.execution_mode, config.market_type),
    evaluation_mode: normalizeEvaluationMode(config.evaluation_mode),
    connection_id: config.connection_id || "none",
    integration_id: config.integration_id || "none",
    base_quote_amount: stringifyValue(config.base_quote_amount),
    base_asset_budget: stringifyValue(config.base_asset_budget),
    quote_asset_budget: stringifyValue(config.quote_asset_budget),
    order_size_mode: normalizeOrderSizeMode(config.order_size_mode),
    sell_threshold_ratio: stringifyValue(config.sell_threshold_ratio),
    buy_threshold_ratio: stringifyValue(config.buy_threshold_ratio),
    poll_interval_seconds: stringifyValue(config.poll_interval_seconds),
    min_seconds_between_evaluations: stringifyValue(config.min_seconds_between_evaluations),
    cooldown_seconds_after_trade: stringifyValue(config.cooldown_seconds_after_trade),
    fee_bps: stringifyValue(config.fee_bps),
    max_slippage_bps: stringifyValue(config.max_slippage_bps),
    max_allowed_slippage_bps: stringifyValue(config.max_allowed_slippage_bps),
    min_net_profit_bps: stringifyValue(config.min_net_profit_bps),
    max_trades_per_hour: stringifyValue(config.max_trades_per_hour),
    max_trades_per_day: stringifyValue(config.max_trades_per_day),
    stale_feed_max_age_seconds: stringifyValue(config.stale_feed_max_age_seconds),
    stale_feed_timeout_seconds: stringifyValue(config.stale_feed_timeout_seconds),
    pause_on_stale_feed: !!config.pause_on_stale_feed,
    pause_on_exchange_unhealthy: !!config.pause_on_exchange_unhealthy,
    pause_on_slippage_spike: !!config.pause_on_slippage_spike,
    pause_on_order_failure_streak: stringifyValue(config.pause_on_order_failure_streak),
    require_stop_loss: !!config.require_stop_loss,
    stop_loss_pct: stringifyValue(config.stop_loss_pct),
    require_take_profit: !!config.require_take_profit,
    take_profit_pct: stringifyValue(config.take_profit_pct),
    require_time_stop: !!config.require_time_stop,
    time_stop_minutes: stringifyValue(config.time_stop_minutes),
    allow_partial_sell: !!config.allow_partial_sell,
    partial_sell_pct: stringifyValue(config.partial_sell_pct),
    allow_partial_buy: !!config.allow_partial_buy,
    partial_buy_pct: stringifyValue(config.partial_buy_pct),
    use_advisory_filter: !!config.use_advisory_filter,
    advisory_mode: config.advisory_mode || INITIAL_FORM.advisory_mode,
    trigger_mode: normalizeTriggerMode(config.trigger_mode, algorithm),
    selling_loss_ratio: stringifyValue(config.selling_loss_ratio),
    buying_loss_ratio: stringifyValue(config.buying_loss_ratio),
    trigger_confirm_seconds: stringifyValue(config.trigger_confirm_seconds),
    trigger_confirm_updates: stringifyValue(config.trigger_confirm_updates),
    use_candle_close_confirmation: !!config.use_candle_close_confirmation,
    min_price_stability_seconds: stringifyValue(config.min_price_stability_seconds),
    max_spike_deviation_bps: stringifyValue(config.max_spike_deviation_bps),
    daily_loss_limit_pct: stringifyValue(config.daily_loss_limit_pct),
    max_drawdown_pct: stringifyValue(config.max_drawdown_pct),
    max_open_orders: stringifyValue(config.max_open_orders),
    max_position_pct: stringifyValue(config.max_position_pct),
    kill_switch: !!config.kill_switch,
    leverage: stringifyValue(config.leverage),
    margin_type: normalizeMarginType(config.margin_type),
    position_mode: normalizePositionMode(config.position_mode),
    reduce_only_exit_orders: config.reduce_only_exit_orders ?? INITIAL_FORM.reduce_only_exit_orders,
    max_open_position_per_symbol: stringifyValue(config.max_open_position_per_symbol),
    allow_reverse_signal: !!config.allow_reverse_signal,
    close_on_opposite_signal: config.close_on_opposite_signal ?? INITIAL_FORM.close_on_opposite_signal,
    risk_per_trade: stringifyValue(config.risk_per_trade),
    max_daily_loss: stringifyValue(config.max_daily_loss),
    max_consecutive_losses: stringifyValue(config.max_consecutive_losses),
    strategy_params_json: formatJson(config.strategy_params ?? STRATEGY_DEFAULTS[algorithm]),
  };
}

function stringifyValue(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeMarketType(value?: string | null): BotForm["market_type"] {
  return value === "futures" ? "futures" : "spot";
}

function normalizeAlgorithm(value?: string | null): BotForm["algorithm"] {
  if (value === "trailing_ratio" || value === "rsi" || value === "breakout") return value;
  if (value === "ma" || value === "ma_crossover") return "ma_crossover";
  return "ratio_threshold";
}

function normalizeTimeframe(value?: string | null): BotForm["timeframe"] {
  if (value === "3m" || value === "5m" || value === "15m") return value;
  return "1m";
}

function normalizeSideMode(value?: string | null, marketType?: string | null): BotForm["side_mode"] {
  if ((marketType || "").toLowerCase() !== "futures") return "buy_sell";
  if (value === "long_only" || value === "short_only" || value === "both") return value;
  return "both";
}

function normalizeMode(value?: string | null): BotForm["mode"] {
  if (value === "advisor" || value === "restricted_auto") return value;
  return "manual_approval";
}

function normalizeExecutionMode(value?: string | null, marketType?: string | null): BotForm["execution_mode"] {
  if ((marketType || "").toLowerCase() === "futures") return "sandbox";
  return value === "live" ? "live" : "sandbox";
}

function normalizeEvaluationMode(value?: string | null): BotForm["evaluation_mode"] {
  if (value === "tick" || value === "candle_close" || value === "websocket" || value === "polling") return value;
  return "hybrid";
}

function normalizeOrderSizeMode(value?: string | null): BotForm["order_size_mode"] {
  if (value === "fixed_base" || value === "percent_of_balance") return value;
  return "fixed_quote";
}

function normalizeTriggerMode(value?: string | null, algorithm?: BotForm["algorithm"]): BotForm["trigger_mode"] {
  if (algorithm === "trailing_ratio") return "trailing_ratio";
  return value === "trailing_ratio" ? "trailing_ratio" : "threshold";
}

function normalizeMarginType(value?: string | null): BotForm["margin_type"] {
  return value === "cross" ? "cross" : "isolated";
}

function normalizePositionMode(value?: string | null): BotForm["position_mode"] {
  return value === "hedge" ? "hedge" : "one_way";
}

function buildPayload(form: BotForm) {
  const strategy = safeParseStrategyParams(form.strategy_params_json);
  if (strategy.error) {
    throw new Error(strategy.error);
  }

  const isFutures = form.market_type === "futures";

  return {
    name: form.name.trim(),
    symbol: form.symbol.trim().toUpperCase(),
    market_type: form.market_type,
    algorithm: form.algorithm,
    timeframe: form.timeframe,
    side_mode: isFutures ? form.side_mode : "buy_sell",
    mode: form.mode,
    execution_mode: isFutures ? "sandbox" : form.execution_mode,
    evaluation_mode: form.evaluation_mode,
    connection_id: isFutures ? null : parseNullableUuid(form.connection_id),
    integration_id: isFutures ? parseNullableUuid(form.integration_id) : null,
    base_quote_amount: parseNullableNumber(form.base_quote_amount),
    base_asset_budget: parseNullableNumber(form.base_asset_budget),
    quote_asset_budget: parseNullableNumber(form.quote_asset_budget),
    order_size_mode: form.order_size_mode,
    sell_threshold_ratio: parseNullableNumber(form.sell_threshold_ratio),
    buy_threshold_ratio: parseNullableNumber(form.buy_threshold_ratio),
    poll_interval_seconds: parseNullableInteger(form.poll_interval_seconds),
    min_seconds_between_evaluations: parseNullableInteger(form.min_seconds_between_evaluations),
    cooldown_seconds_after_trade: parseNullableInteger(form.cooldown_seconds_after_trade),
    fee_bps: parseNullableNumber(form.fee_bps),
    max_slippage_bps: parseNullableNumber(form.max_slippage_bps),
    max_allowed_slippage_bps: parseNullableNumber(form.max_allowed_slippage_bps),
    min_net_profit_bps: parseNullableNumber(form.min_net_profit_bps),
    max_trades_per_hour: parseNullableInteger(form.max_trades_per_hour),
    max_trades_per_day: parseNullableInteger(form.max_trades_per_day),
    stale_feed_max_age_seconds: parseNullableInteger(form.stale_feed_max_age_seconds),
    stale_feed_timeout_seconds: parseNullableInteger(form.stale_feed_timeout_seconds),
    pause_on_stale_feed: form.pause_on_stale_feed,
    pause_on_exchange_unhealthy: form.pause_on_exchange_unhealthy,
    pause_on_slippage_spike: form.pause_on_slippage_spike,
    pause_on_order_failure_streak: parseNullableInteger(form.pause_on_order_failure_streak),
    require_stop_loss: form.require_stop_loss,
    stop_loss_pct: parseNullableNumber(form.stop_loss_pct),
    require_take_profit: form.require_take_profit,
    take_profit_pct: parseNullableNumber(form.take_profit_pct),
    require_time_stop: form.require_time_stop,
    time_stop_minutes: parseNullableInteger(form.time_stop_minutes),
    allow_partial_sell: form.allow_partial_sell,
    partial_sell_pct: parseNullableNumber(form.partial_sell_pct),
    allow_partial_buy: form.allow_partial_buy,
    partial_buy_pct: parseNullableNumber(form.partial_buy_pct),
    use_advisory_filter: form.use_advisory_filter,
    advisory_mode: form.advisory_mode.trim() || null,
    trigger_mode: form.algorithm === "trailing_ratio" ? "trailing_ratio" : form.trigger_mode,
    selling_loss_ratio: parseNullableNumber(form.selling_loss_ratio),
    buying_loss_ratio: parseNullableNumber(form.buying_loss_ratio),
    trigger_confirm_seconds: parseNullableInteger(form.trigger_confirm_seconds),
    trigger_confirm_updates: parseNullableInteger(form.trigger_confirm_updates),
    use_candle_close_confirmation: form.use_candle_close_confirmation,
    min_price_stability_seconds: parseNullableInteger(form.min_price_stability_seconds),
    max_spike_deviation_bps: parseNullableNumber(form.max_spike_deviation_bps),
    daily_loss_limit_pct: parseNullableNumber(form.daily_loss_limit_pct),
    max_drawdown_pct: parseNullableNumber(form.max_drawdown_pct),
    max_open_orders: parseNullableInteger(form.max_open_orders),
    max_position_pct: parseNullableNumber(form.max_position_pct),
    kill_switch: form.kill_switch,
    leverage: isFutures ? parseNullableNumber(form.leverage) : null,
    margin_type: isFutures ? form.margin_type : null,
    position_mode: isFutures ? form.position_mode : null,
    reduce_only_exit_orders: isFutures ? form.reduce_only_exit_orders : null,
    max_open_position_per_symbol: isFutures ? parseNullableNumber(form.max_open_position_per_symbol) : null,
    allow_reverse_signal: isFutures ? form.allow_reverse_signal : null,
    close_on_opposite_signal: isFutures ? form.close_on_opposite_signal : null,
    risk_per_trade: isFutures ? parseNullableNumber(form.risk_per_trade) : null,
    max_daily_loss: isFutures ? parseNullableNumber(form.max_daily_loss) : null,
    max_consecutive_losses: isFutures ? parseNullableInteger(form.max_consecutive_losses) : null,
    strategy_params: strategy.data,
  };
}

async function fetchBotResource<T>(botId: string, path: string) {
  const response = await api.get<T>(`/ratio-bots/${botId}/${path}`);
  return response.data;
}

async function invalidateBotQueries(queryClient: ReturnType<typeof useQueryClient>, workspaceId: string | undefined, botId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ratio-bots", workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-status", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-feed", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-last-signal", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-last-order", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-position", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-pnl", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-candles", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-snapshot", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-ratio", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-decisions", botId] }),
    queryClient.invalidateQueries({ queryKey: ["ratio-bot-events", botId] }),
  ]);
}

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-xl font-semibold">{value}</div>
          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const hasContent = value !== null && value !== undefined && (!(Array.isArray(value)) || value.length > 0);
  if (!hasContent || (typeof value === "object" && !Array.isArray(value) && Object.keys((value as JsonRecord) || {}).length === 0)) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-5 text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function BotCard({
  bot,
  selected,
  onClick,
}: {
  bot: RatioBotConfig;
  selected: boolean;
  onClick: () => void;
}) {
  const state = bot.state || {};
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30",
        selected ? "border-primary bg-primary/5" : "border-border/70 bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{bot.name}</div>
          <div className="text-xs text-muted-foreground">
            {bot.symbol} / {prettyLabel(bot.market_type || "spot")} / {prettyLabel(bot.algorithm || "ratio_threshold")}
          </div>
        </div>
        <Badge variant={statusVariant(state.position_state || (bot.enabled ? "running" : "idle"))}>
          {prettyLabel(state.position_state || (bot.enabled ? "running" : "idle"))}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{prettyLabel(bot.timeframe || "1m")}</Badge>
        <Badge variant="secondary">{prettyLabel(bot.side_mode || (bot.market_type === "futures" ? "both" : "buy_sell"))}</Badge>
        <Badge variant={statusVariant(state.feed_status)}>{prettyLabel(state.feed_status || "unknown feed")}</Badge>
        {bot.kill_switch ? <Badge variant="destructive">kill switch</Badge> : null}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Last signal {state.last_signal ? prettyLabel(state.last_signal) : "not available"}
      </div>
    </button>
  );
}

export default function RatioBotPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [hydratedBotId, setHydratedBotId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [form, setForm] = useState<BotForm>(INITIAL_FORM);
  const [anchorBuyPrice, setAnchorBuyPrice] = useState("");
  const [anchorBuyQty, setAnchorBuyQty] = useState("");
  const [anchorSellPrice, setAnchorSellPrice] = useState("");
  const [anchorSellQty, setAnchorSellQty] = useState("");

  const botsQuery = useQuery({
    queryKey: ["ratio-bots", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as RatioBotConfig[];
      const response = await api.get<RatioBotConfig[]>(`/workspaces/${workspaceId}/ratio-bots`);
      return response.data;
    },
    enabled: !!workspaceId,
    refetchInterval: 8000,
  });

  const { data: connections = [] } = useConnections(workspaceId);

  const integrationsQuery = useQuery({
    queryKey: ["integrations", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as IntegrationRecord[];
      const response = await api.get<IntegrationRecord[]>(`/integrations?workspace_id=${workspaceId}`);
      return response.data.filter((integration) => {
        const provider = (integration.provider_key || "").toLowerCase();
        const type = (integration.type || "").toLowerCase();
        return provider.includes("binance") || type.includes("exchange");
      });
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });

  const bots = botsQuery.data ?? EMPTY_BOTS;
  const selectedFromList = bots.find((bot) => bot.id === selectedBotId) || null;
  const selectedMarketType = isCreating ? form.market_type : normalizeMarketType(selectedFromList?.market_type);

  const futuresReadinessQuery = useQuery({
    queryKey: ["futures-readiness", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null as FuturesReadiness | null;
      const response = await api.get<FuturesReadiness>(`/workspaces/${workspaceId}/futures/readiness`);
      return response.data;
    },
    enabled: !!workspaceId && selectedMarketType === "futures",
    refetchInterval: 10000,
  });

  const selectedBotQuery = useQuery({
    queryKey: ["ratio-bot", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as RatioBotConfig | null;
      const response = await api.get<RatioBotConfig>(`/ratio-bots/${selectedBotId}`);
      return response.data;
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: 10000,
  });

  const runtimePollingMs = 5000;

  const statusQuery = useQuery({
    queryKey: ["ratio-bot-status", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as RuntimeStatus | null;
      return fetchBotResource<RuntimeStatus>(selectedBotId, "status");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const ratioQuery = useQuery({
    queryKey: ["ratio-bot-ratio", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as RatioDisplay | null;
      try {
        return await fetchBotResource<RatioDisplay>(selectedBotId, "ratio");
      } catch {
        return null;
      }
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const feedQuery = useQuery({
    queryKey: ["ratio-bot-feed", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as FeedHealth | null;
      return fetchBotResource<FeedHealth>(selectedBotId, "feed-health");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const lastSignalQuery = useQuery({
    queryKey: ["ratio-bot-last-signal", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as RatioDecision | null;
      return fetchBotResource<RatioDecision>(selectedBotId, "last-signal");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const lastOrderQuery = useQuery({
    queryKey: ["ratio-bot-last-order", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as OrderRecord | null;
      return fetchBotResource<OrderRecord>(selectedBotId, "last-order");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const positionQuery = useQuery({
    queryKey: ["ratio-bot-position", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as PositionRecord | null;
      return fetchBotResource<PositionRecord>(selectedBotId, "position");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const pnlQuery = useQuery({
    queryKey: ["ratio-bot-pnl", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as PnlSummary | null;
      return fetchBotResource<PnlSummary>(selectedBotId, "pnl-summary");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const candlesQuery = useQuery({
    queryKey: ["ratio-bot-candles", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as CandleRecord[];
      const response = await api.get<CandleRecord[]>(`/ratio-bots/${selectedBotId}/candles?limit=120`);
      return response.data;
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const snapshotQuery = useQuery({
    queryKey: ["ratio-bot-snapshot", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return null as RuntimeSnapshot | null;
      return fetchBotResource<RuntimeSnapshot>(selectedBotId, "snapshot");
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: runtimePollingMs,
  });

  const decisionsQuery = useQuery({
    queryKey: ["ratio-bot-decisions", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as RatioDecision[];
      const response = await api.get<RatioDecision[]>(`/ratio-bots/${selectedBotId}/decisions`);
      return response.data;
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: 12000,
  });

  const eventsQuery = useQuery({
    queryKey: ["ratio-bot-events", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as RatioEvent[];
      const response = await api.get<RatioEvent[]>(`/ratio-bots/${selectedBotId}/events`);
      return response.data;
    },
    enabled: !!selectedBotId && !isCreating,
    refetchInterval: 12000,
  });

  useEffect(() => {
    if (!workspaceId) {
      setSelectedBotId(null);
      setIsCreating(false);
      setHydratedBotId(null);
      return;
    }

    if (isCreating) {
      return;
    }

    if (!selectedBotId && bots.length > 0) {
      setSelectedBotId(bots[0].id);
      return;
    }

    if (selectedBotId && bots.length > 0 && !bots.some((bot) => bot.id === selectedBotId)) {
      setSelectedBotId(bots[0].id);
    }
  }, [workspaceId, bots, selectedBotId, isCreating]);

  const selectedBot = selectedBotQuery.data || selectedFromList;
  const strategyValidation = safeParseStrategyParams(form.strategy_params_json);

  useEffect(() => {
    if (!selectedBot || isCreating) return;
    if (hydratedBotId === selectedBot.id) return;

    setForm(buildFormFromConfig(selectedBot));
    setHydratedBotId(selectedBot.id);
  }, [selectedBot, isCreating, hydratedBotId]);

  useEffect(() => {
    setForm((current) => {
      let changed = false;
      const next = { ...current };

      if (current.market_type === "spot" && current.side_mode !== "buy_sell") {
        next.side_mode = "buy_sell";
        changed = true;
      }

      if (current.market_type === "futures" && current.side_mode === "buy_sell") {
        next.side_mode = "both";
        changed = true;
      }

      if (current.market_type === "futures" && current.execution_mode !== "sandbox") {
        next.execution_mode = "sandbox";
        changed = true;
      }

      const enforcedTrigger = current.algorithm === "trailing_ratio" ? "trailing_ratio" : "threshold";
      if (next.trigger_mode !== enforcedTrigger) {
        next.trigger_mode = enforcedTrigger;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [form.market_type, form.algorithm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Select a workspace first.");
      const payload = buildPayload(form);
      if (isCreating) {
        const response = await api.post<RatioBotConfig>(`/workspaces/${workspaceId}/ratio-bots`, payload);
        return response.data;
      }
      if (!selectedBotId) {
        throw new Error("Select a bot first.");
      }
      const response = await api.put<RatioBotConfig>(`/ratio-bots/${selectedBotId}`, payload);
      return response.data;
    },
    onSuccess: async (savedBot) => {
      toast({
        title: isCreating ? "Bot created" : "Bot updated",
        description: `${savedBot.symbol} configuration saved.`,
      });

      queryClient.setQueryData(["ratio-bot", savedBot.id], savedBot);
      setForm(buildFormFromConfig(savedBot));
      setHydratedBotId(savedBot.id);
      setSelectedBotId(savedBot.id);
      setIsCreating(false);
      setActiveTab("overview");
      await invalidateBotQueries(queryClient, workspaceId, savedBot.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({
      botId,
      action,
      body,
    }: {
      botId: string;
      action: "start" | "pause" | "resume" | "stop" | "evaluate";
      body?: JsonRecord;
    }) => {
      const response = await api.post<JsonRecord>(`/ratio-bots/${botId}/${action}`, body || {});
      return { data: response.data, action, botId };
    },
    onSuccess: async ({ data, action, botId }) => {
      toast({
        title: `${prettyLabel(action)} requested`,
        description: (data.message as string) || `${prettyLabel(action)} completed.`,
      });
      await invalidateBotQueries(queryClient, workspaceId, botId);
    },
    onError: (error: Error) => {
      toast({
        title: "Bot action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async ({ botId, nextValue }: { botId: string; nextValue: boolean }) => {
      const response = await api.post<JsonRecord>(`/ratio-bots/${botId}/kill-switch`, {
        kill_switch: nextValue,
        reason: nextValue ? "frontend_emergency_toggle" : "frontend_manual_resume",
      });
      return { data: response.data, botId, nextValue };
    },
    onSuccess: async ({ botId, nextValue }) => {
      setForm((current) => ({ ...current, kill_switch: nextValue }));
      toast({
        title: nextValue ? "Kill switch enabled" : "Kill switch cleared",
        description: nextValue ? "Fresh entries are blocked." : "Bot can trade again after normal checks.",
      });
      await invalidateBotQueries(queryClient, workspaceId, botId);
    },
    onError: (error: Error) => {
      toast({
        title: "Kill switch update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const anchorMutation = useMutation({
    mutationFn: async ({
      botId,
      side,
      price,
      quantity,
    }: {
      botId: string;
      side: "anchor-buy" | "anchor-sell";
      price: string;
      quantity: string;
    }) => {
      const body = side === "anchor-buy"
        ? { buy_price: Number(price), quantity: Number(quantity) }
        : { sell_price: Number(price), quantity: Number(quantity) };
      const response = await api.post<JsonRecord>(`/ratio-bots/${botId}/${side}`, body);
      return { data: response.data, botId, side };
    },
    onSuccess: async ({ botId, side }) => {
      toast({
        title: side === "anchor-buy" ? "Buy anchor saved" : "Sell anchor saved",
        description: "Bot state has been updated.",
      });
      if (side === "anchor-buy") {
        setAnchorBuyPrice("");
        setAnchorBuyQty("");
      } else {
        setAnchorSellPrice("");
        setAnchorSellQty("");
      }
      await invalidateBotQueries(queryClient, workspaceId, botId);
    },
    onError: (error: Error) => {
      toast({
        title: "Anchor update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentStatus = statusQuery.data || null;
  const currentFeed = (feedQuery.data && Object.keys(feedQuery.data).length > 0 ? feedQuery.data : snapshotQuery.data?.feed) || null;
  const currentSignal = (lastSignalQuery.data && Object.keys(lastSignalQuery.data).length > 0 ? lastSignalQuery.data : snapshotQuery.data?.last_signal) || null;
  const currentOrder = (lastOrderQuery.data && Object.keys(lastOrderQuery.data).length > 0 ? lastOrderQuery.data : snapshotQuery.data?.last_order) || null;
  const currentPosition = (positionQuery.data && Object.keys(positionQuery.data).length > 0 ? positionQuery.data : snapshotQuery.data?.position) || null;
  const currentPnl = pnlQuery.data || snapshotQuery.data?.pnl || null;
  const currentRatio = ratioQuery.data || null;
  const candles = (candlesQuery.data ?? EMPTY_CANDLES).map((candle) => ({
    ts: candle.ts,
    label: candle.ts ? new Date(Number(candle.ts)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--",
    open: toNumber(candle.open) || 0,
    high: toNumber(candle.high) || 0,
    low: toNumber(candle.low) || 0,
    close: toNumber(candle.close) || 0,
  }));

  const connectionOptions = connections as Array<{ id: string; name?: string; provider?: string; is_enabled?: boolean }>;
  const integrationOptions = integrationsQuery.data ?? EMPTY_INTEGRATIONS;

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedBotId(null);
    setHydratedBotId(null);
    setForm(INITIAL_FORM);
    setActiveTab("config");
  };

  const handleSelectBot = (botId: string) => {
    setSelectedBotId(botId);
    setHydratedBotId(null);
    setIsCreating(false);
    setActiveTab("overview");
  };

  const triggerLifecycle = (action: "start" | "pause" | "resume" | "stop" | "evaluate") => {
    if (!selectedBotId) return;
    lifecycleMutation.mutate({ botId: selectedBotId, action });
  };

  const refreshSelected = async () => {
    if (!selectedBotId) return;
    await invalidateBotQueries(queryClient, workspaceId, selectedBotId);
    toast({
      title: "Refresh requested",
      description: "Live state queries are reloading.",
    });
  };

  const isBusy = saveMutation.isPending || lifecycleMutation.isPending || killSwitchMutation.isPending || anchorMutation.isPending;

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Realtime Ratio Bot Console</h1>
                  <p className="text-sm text-muted-foreground">
                    Selected-symbol spot and Binance USD-M futures testnet controls with feed health, runtime state, and strategy wiring.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Realtime websocket-first flow</Badge>
                <Badge variant="secondary">1m default execution</Badge>
                <Badge variant="outline">One bot = one symbol</Badge>
                <Badge variant="destructive">Futures live blocked by design</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={refreshSelected} disabled={!selectedBotId || isBusy}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh runtime
              </Button>
              <Button type="button" onClick={handleCreateNew}>
                <Zap className="mr-2 h-4 w-4" />
                New selected-coin bot
              </Button>
            </div>
          </div>
        </div>

        {!workspaceId ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Select a workspace first.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Bot List</CardTitle>
                  <Badge variant="outline">{bots.length} bots</Badge>
                </div>
                <Button type="button" variant="secondary" onClick={handleCreateNew}>
                  Configure new bot
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {bots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    No ratio bots yet. Create a selected-symbol spot or futures bot from here.
                  </div>
                ) : null}

                <div className="max-h-[68vh] space-y-3 overflow-auto pr-1">
                  {bots.map((bot) => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      selected={!isCreating && selectedBotId === bot.id}
                      onClick={() => handleSelectBot(bot.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold">
                          {isCreating ? "Create bot" : selectedBot?.name || "Select a bot"}
                        </h2>
                        {!isCreating && selectedBot ? (
                          <>
                            <Badge variant="outline">{selectedBot.symbol}</Badge>
                            <Badge variant="secondary">{prettyLabel(selectedBot.market_type || "spot")}</Badge>
                            <Badge variant="outline">{prettyLabel(selectedBot.algorithm || "ratio_threshold")}</Badge>
                            <Badge variant={statusVariant(currentStatus?.feed_status || selectedBot.state?.feed_status)}>
                              {prettyLabel(currentStatus?.feed_status || selectedBot.state?.feed_status || "unknown feed")}
                            </Badge>
                          </>
                        ) : null}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {isCreating
                          ? "Set the market, strategy, risk, and live routing before saving."
                          : "Runtime health, live chart snapshot, full config controls, and manual overrides sit in one place."}
                      </p>

                      {selectedMarketType === "futures" ? (
                        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          Binance USD-M futures stays sandbox/testnet-oriented here. Production futures live execution remains intentionally blocked.
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setForm((current) => ({ ...current, strategy_params_json: formatJson(STRATEGY_DEFAULTS[current.algorithm]) }))}
                      >
                        Load strategy defaults
                      </Button>
                      <Button
                        type="button"
                        onClick={() => saveMutation.mutate()}
                        disabled={!workspaceId || (!isCreating && !selectedBotId) || !!strategyValidation.error || isBusy}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isCreating ? "Create bot" : "Save config"}
                      </Button>
                      {!isCreating && selectedBotId ? (
                        <>
                          <Button type="button" variant="secondary" onClick={() => triggerLifecycle("start")} disabled={isBusy}>
                            <Play className="mr-2 h-4 w-4" />
                            Start
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => triggerLifecycle("pause")} disabled={isBusy}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => triggerLifecycle("resume")} disabled={isBusy}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Resume
                          </Button>
                          <Button type="button" variant="outline" onClick={() => triggerLifecycle("evaluate")} disabled={isBusy}>
                            <ActivitySquare className="mr-2 h-4 w-4" />
                            Evaluate now
                          </Button>
                          <Button type="button" variant="outline" onClick={() => triggerLifecycle("stop")} disabled={isBusy}>
                            <Square className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                          <Button
                            type="button"
                            variant={form.kill_switch ? "destructive" : "outline"}
                            onClick={() => killSwitchMutation.mutate({ botId: selectedBotId, nextValue: !form.kill_switch })}
                            disabled={isBusy}
                          >
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {form.kill_switch ? "Clear kill switch" : "Emergency kill switch"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="runtime">Runtime</TabsTrigger>
                  <TabsTrigger value="config">Config</TabsTrigger>
                  <TabsTrigger value="anchors">Anchors</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      title="Bot Status"
                      value={<Badge variant={statusVariant(currentStatus?.bot_status || selectedBot?.state?.position_state)}>{prettyLabel(currentStatus?.bot_status || selectedBot?.state?.position_state || "idle")}</Badge>}
                      hint={selectedBot?.enabled ? "Config enabled" : "Config idle"}
                      icon={<Bot className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Feed Health"
                      value={<Badge variant={statusVariant(currentStatus?.feed_status || currentFeed?.status || currentFeed?.state_feed_status)}>{prettyLabel(currentStatus?.feed_status || currentFeed?.status || currentFeed?.state_feed_status || "unknown")}</Badge>}
                      hint={currentFeed?.last_message_at ? `Last update ${formatDateTime(currentFeed.last_message_at)}` : "Awaiting market stream"}
                      icon={<ActivitySquare className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Position"
                      value={prettyLabel(currentStatus?.current_position_side || selectedBot?.state?.last_position_side || "flat")}
                      hint={`Qty ${formatNumber(currentStatus?.current_position_qty || currentPosition?.qty || currentPosition?.quantity || selectedBot?.state?.last_position_qty, 6)}`}
                      icon={selectedMarketType === "futures" ? <TrendingUp className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Unrealized PnL"
                      value={formatNumber(currentStatus?.unrealized_pnl || currentPnl?.unrealized_pnl || selectedBot?.state?.unrealized_pnl, 6)}
                      hint={currentStatus?.last_order_status ? `Last order ${prettyLabel(currentStatus.last_order_status)}` : "No fill data yet"}
                      icon={<TrendingDown className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle>Live Candle Snapshot</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedBot?.symbol || form.symbol} · {selectedBot?.timeframe || form.timeframe} · websocket-first chart bootstrap
                          </p>
                        </div>
                        <Badge variant="outline">{candles.length} candles</Badge>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="h-[340px]">
                          {candles.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={candles}>
                                <defs>
                                  <linearGradient id="ratioBotChart" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="label" minTickGap={32} />
                                <YAxis domain={["auto", "auto"]} tickFormatter={(value) => formatNumber(value, 2)} />
                                <Tooltip
                                  formatter={(value: number) => [formatNumber(value, 4), "Close"]}
                                  labelFormatter={(value) => `Time ${value}`}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="close"
                                  stroke="hsl(var(--primary))"
                                  fillOpacity={1}
                                  fill="url(#ratioBotChart)"
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                              No candles cached yet. Start the feed worker and wait for market data ingestion.
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <DetailRow label="Latest close" value={formatNumber(candles[candles.length - 1]?.close, 6)} />
                          <DetailRow label="Last signal" value={prettyLabel(currentStatus?.last_signal || currentSignal?.decision)} />
                          <DetailRow label="Cooldown until" value={formatDateTime(currentStatus?.cooldown_until || selectedBot?.state?.cooldown_until)} />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Feed Health</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <DetailRow label="Market type" value={prettyLabel(currentFeed?.market_type || selectedMarketType)} />
                          <DetailRow label="Health" value={<Badge variant={statusVariant(currentFeed?.status || currentFeed?.state_feed_status)}>{prettyLabel(currentFeed?.status || currentFeed?.state_feed_status || currentFeed?.state || "unknown")}</Badge>} />
                          <DetailRow label="Lag seconds" value={formatNumber(currentFeed?.lag_seconds, 2)} />
                          <DetailRow label="Last message" value={formatDateTime(currentFeed?.last_message_at)} />
                          <DetailRow label="Last trade" value={formatDateTime(currentFeed?.last_trade_at)} />
                          <DetailRow label="State feed flag" value={prettyLabel(currentFeed?.state_feed_status)} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Ratio / Trigger Lens</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <DetailRow label="Current price" value={formatNumber(currentRatio?.current_price, 6)} />
                          <DetailRow label="Active anchor" value={formatNumber(currentRatio?.active_anchor_price, 6)} />
                          <DetailRow label="Sell ratio" value={formatRatioPercent(currentRatio?.sell_ratio)} />
                          <DetailRow label="Buy ratio" value={formatRatioPercent(currentRatio?.buy_ratio)} />
                          <DetailRow label="Pending trigger" value={prettyLabel(currentRatio?.pending_trigger_side)} />
                          <DetailRow label="Signal distance" value={currentRatio?.sell_distance_pct !== null && currentRatio?.sell_distance_pct !== undefined ? `${formatNumber(currentRatio.sell_distance_pct, 2)}% / ${formatNumber(currentRatio.buy_distance_pct, 2)}%` : "None"} />
                        </CardContent>
                      </Card>

                      {selectedMarketType === "futures" ? (
                        <Card>
                          <CardHeader>
                            <CardTitle>Futures Readiness</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <DetailRow label="State" value={<Badge variant={statusVariant(futuresReadinessQuery.data?.state)}>{prettyLabel(futuresReadinessQuery.data?.state || "unknown")}</Badge>} />
                            <DetailRow label="Manual test orders" value={formatBoolean(!!futuresReadinessQuery.data?.supports_manual_test_order)} />
                            <DetailRow label="Auto execution" value={formatBoolean(!!futuresReadinessQuery.data?.supports_auto_execution)} />
                            <DetailRow label="Force testnet" value={formatBoolean(!!futuresReadinessQuery.data?.futures_force_testnet)} />
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="runtime" className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Last Signal</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <DetailRow label="Decision" value={<Badge variant={statusVariant(currentSignal?.decision)}>{prettyLabel(currentSignal?.decision)}</Badge>} />
                        <DetailRow label="Execution status" value={prettyLabel(currentSignal?.execution_status)} />
                        <DetailRow label="Evaluated price" value={formatNumber(currentSignal?.evaluated_price, 6)} />
                        <DetailRow label="Computed ratio" value={formatRatioPercent(currentSignal?.computed_ratio)} />
                        <DetailRow label="Price source" value={prettyLabel(currentSignal?.price_source)} />
                        <DetailRow label="Time" value={formatDateTime(currentSignal?.decided_at || currentStatus?.last_signal_at)} />
                        <DetailRow label="Reason" value={currentSignal?.reason || "None"} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Last Order / Fill</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <DetailRow label="Status" value={<Badge variant={statusVariant(currentOrder?.status || currentStatus?.last_order_status)}>{prettyLabel(currentOrder?.status || currentStatus?.last_order_status)}</Badge>} />
                        <DetailRow label="Side" value={prettyLabel(currentOrder?.side)} />
                        <DetailRow label="Type" value={prettyLabel(currentOrder?.type)} />
                        <DetailRow label="Price" value={formatNumber(currentOrder?.avg_fill_price || currentOrder?.price || currentStatus?.last_fill_price, 6)} />
                        <DetailRow label="Quantity" value={formatNumber(currentOrder?.qty || currentOrder?.quantity || currentStatus?.current_position_qty, 6)} />
                        <DetailRow label="Client / exchange id" value={currentOrder?.client_order_id || currentOrder?.external_id || currentOrder?.id || "None"} />
                        <DetailRow label="Created" value={formatDateTime(currentOrder?.created_at)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Position State</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <DetailRow label="Side" value={<Badge variant={statusVariant(currentPosition?.position_side || currentPosition?.side || currentStatus?.current_position_side)}>{prettyLabel(currentPosition?.position_side || currentPosition?.side || currentStatus?.current_position_side || "flat")}</Badge>} />
                        <DetailRow label="Quantity" value={formatNumber(currentPosition?.qty || currentPosition?.quantity || currentPnl?.current_position_qty, 6)} />
                        <DetailRow label="Entry price" value={formatNumber(currentPosition?.entry_price || selectedBot?.state?.entry_price, 6)} />
                        <DetailRow label="Mark price" value={formatNumber(currentPosition?.mark_price, 6)} />
                        <DetailRow label="Liquidation" value={formatNumber(currentPosition?.liquidation_price, 6)} />
                        <DetailRow label="Updated" value={formatDateTime(currentPosition?.updated_at)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>PnL Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <DetailRow label="Today realized" value={formatNumber(currentPnl?.today_realized_pnl, 6)} />
                        <DetailRow label="Unrealized" value={formatNumber(currentPnl?.unrealized_pnl || currentStatus?.unrealized_pnl, 6)} />
                        <DetailRow label="Current side" value={prettyLabel(currentPnl?.current_position_side || currentStatus?.current_position_side)} />
                        <DetailRow label="Current qty" value={formatNumber(currentPnl?.current_position_qty || currentStatus?.current_position_qty, 6)} />
                        <DetailRow label="Kill switch" value={form.kill_switch ? "Enabled" : "Off"} />
                        <DetailRow label="Runtime error" value={currentStatus?.error_state || selectedBot?.state?.last_runtime_error || "None"} />
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Live Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <JsonBlock value={snapshotQuery.data} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="config" className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Identity & Routing</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Bot name">
                          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                        </Field>
                        <Field label="Symbol">
                          <Input value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                        </Field>
                        <Field label="Market type">
                          <Select value={form.market_type} onValueChange={(value: BotForm["market_type"]) => setForm((current) => ({ ...current, market_type: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spot">spot</SelectItem>
                              <SelectItem value="futures">futures</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Algorithm">
                          <Select value={form.algorithm} onValueChange={(value: BotForm["algorithm"]) => setForm((current) => ({ ...current, algorithm: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ratio_threshold">ratio_threshold</SelectItem>
                              <SelectItem value="trailing_ratio">trailing_ratio</SelectItem>
                              <SelectItem value="ma_crossover">ma_crossover</SelectItem>
                              <SelectItem value="rsi">rsi</SelectItem>
                              <SelectItem value="breakout">breakout</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Timeframe">
                          <Select value={form.timeframe} onValueChange={(value: BotForm["timeframe"]) => setForm((current) => ({ ...current, timeframe: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1m">1m</SelectItem>
                              <SelectItem value="3m">3m</SelectItem>
                              <SelectItem value="5m">5m</SelectItem>
                              <SelectItem value="15m">15m</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Side mode">
                          <Select value={form.side_mode} onValueChange={(value: BotForm["side_mode"]) => setForm((current) => ({ ...current, side_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {form.market_type === "spot" ? (
                                <SelectItem value="buy_sell">buy_sell</SelectItem>
                              ) : (
                                <>
                                  <SelectItem value="both">both</SelectItem>
                                  <SelectItem value="long_only">long_only</SelectItem>
                                  <SelectItem value="short_only">short_only</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Execution mode" hint={form.market_type === "futures" ? "Futures stays sandbox/testnet first." : "Spot can stay sandbox or go live."}>
                          <Select value={form.execution_mode} onValueChange={(value: BotForm["execution_mode"]) => setForm((current) => ({ ...current, execution_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sandbox">sandbox</SelectItem>
                              {form.market_type === "spot" ? <SelectItem value="live">live</SelectItem> : null}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Bot mode">
                          <Select value={form.mode} onValueChange={(value: BotForm["mode"]) => setForm((current) => ({ ...current, mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="advisor">advisor</SelectItem>
                              <SelectItem value="manual_approval">manual_approval</SelectItem>
                              <SelectItem value="restricted_auto">restricted_auto</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Evaluation mode">
                          <Select value={form.evaluation_mode} onValueChange={(value: BotForm["evaluation_mode"]) => setForm((current) => ({ ...current, evaluation_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hybrid">hybrid</SelectItem>
                              <SelectItem value="tick">tick</SelectItem>
                              <SelectItem value="candle_close">candle_close</SelectItem>
                              <SelectItem value="websocket">websocket</SelectItem>
                              <SelectItem value="polling">polling</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label={form.market_type === "spot" ? "Spot connection" : "Futures integration"}>
                          <Select
                            value={form.market_type === "spot" ? form.connection_id : form.integration_id}
                            onValueChange={(value) => setForm((current) => (
                              current.market_type === "spot"
                                ? { ...current, connection_id: value }
                                : { ...current, integration_id: value }
                            ))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a route" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {form.market_type === "spot"
                                ? connectionOptions.map((connection) => (
                                    <SelectItem key={connection.id} value={connection.id}>
                                      {connection.name || connection.provider || connection.id}
                                    </SelectItem>
                                  ))
                                : integrationOptions.map((integration) => (
                                    <SelectItem key={integration.id} value={integration.id}>
                                      {integration.display_name || integration.provider_key || integration.id}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Budget & Order Sizing</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Base quote amount">
                          <Input type="number" step="0.0001" value={form.base_quote_amount} onChange={(event) => setForm((current) => ({ ...current, base_quote_amount: event.target.value }))} />
                        </Field>
                        <Field label="Order size mode">
                          <Select value={form.order_size_mode} onValueChange={(value: BotForm["order_size_mode"]) => setForm((current) => ({ ...current, order_size_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_quote">fixed_quote</SelectItem>
                              <SelectItem value="fixed_base">fixed_base</SelectItem>
                              <SelectItem value="percent_of_balance">percent_of_balance</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Base asset budget">
                          <Input type="number" step="0.0001" value={form.base_asset_budget} onChange={(event) => setForm((current) => ({ ...current, base_asset_budget: event.target.value }))} />
                        </Field>
                        <Field label="Quote asset budget">
                          <Input type="number" step="0.0001" value={form.quote_asset_budget} onChange={(event) => setForm((current) => ({ ...current, quote_asset_budget: event.target.value }))} />
                        </Field>
                        <Field label="Max trades per hour">
                          <Input type="number" step="1" value={form.max_trades_per_hour} onChange={(event) => setForm((current) => ({ ...current, max_trades_per_hour: event.target.value }))} />
                        </Field>
                        <Field label="Max trades per day">
                          <Input type="number" step="1" value={form.max_trades_per_day} onChange={(event) => setForm((current) => ({ ...current, max_trades_per_day: event.target.value }))} />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Strategy & Timing</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Sell threshold ratio">
                          <Input type="number" step="0.0001" value={form.sell_threshold_ratio} onChange={(event) => setForm((current) => ({ ...current, sell_threshold_ratio: event.target.value }))} />
                        </Field>
                        <Field label="Buy threshold ratio">
                          <Input type="number" step="0.0001" value={form.buy_threshold_ratio} onChange={(event) => setForm((current) => ({ ...current, buy_threshold_ratio: event.target.value }))} />
                        </Field>
                        <Field label="Trigger mode">
                          <Select value={form.trigger_mode} onValueChange={(value: BotForm["trigger_mode"]) => setForm((current) => ({ ...current, trigger_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="threshold">threshold</SelectItem>
                              <SelectItem value="trailing_ratio">trailing_ratio</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Poll interval seconds">
                          <Input type="number" step="1" value={form.poll_interval_seconds} onChange={(event) => setForm((current) => ({ ...current, poll_interval_seconds: event.target.value }))} />
                        </Field>
                        <Field label="Min seconds between evaluations">
                          <Input type="number" step="1" value={form.min_seconds_between_evaluations} onChange={(event) => setForm((current) => ({ ...current, min_seconds_between_evaluations: event.target.value }))} />
                        </Field>
                        <Field label="Cooldown after trade">
                          <Input type="number" step="1" value={form.cooldown_seconds_after_trade} onChange={(event) => setForm((current) => ({ ...current, cooldown_seconds_after_trade: event.target.value }))} />
                        </Field>
                        <Field label="Trigger confirm seconds">
                          <Input type="number" step="1" value={form.trigger_confirm_seconds} onChange={(event) => setForm((current) => ({ ...current, trigger_confirm_seconds: event.target.value }))} />
                        </Field>
                        <Field label="Trigger confirm updates">
                          <Input type="number" step="1" value={form.trigger_confirm_updates} onChange={(event) => setForm((current) => ({ ...current, trigger_confirm_updates: event.target.value }))} />
                        </Field>
                        <Field label="Selling loss ratio">
                          <Input type="number" step="0.0001" value={form.selling_loss_ratio} onChange={(event) => setForm((current) => ({ ...current, selling_loss_ratio: event.target.value }))} />
                        </Field>
                        <Field label="Buying loss ratio">
                          <Input type="number" step="0.0001" value={form.buying_loss_ratio} onChange={(event) => setForm((current) => ({ ...current, buying_loss_ratio: event.target.value }))} />
                        </Field>
                        <Field label="Min price stability seconds">
                          <Input type="number" step="1" value={form.min_price_stability_seconds} onChange={(event) => setForm((current) => ({ ...current, min_price_stability_seconds: event.target.value }))} />
                        </Field>
                        <Field label="Max spike deviation bps">
                          <Input type="number" step="0.01" value={form.max_spike_deviation_bps} onChange={(event) => setForm((current) => ({ ...current, max_spike_deviation_bps: event.target.value }))} />
                        </Field>
                        <Field label="Use candle close confirmation">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Only trigger on candle close</span>
                            <Switch checked={form.use_candle_close_confirmation} onCheckedChange={(value) => setForm((current) => ({ ...current, use_candle_close_confirmation: value }))} />
                          </div>
                        </Field>
                        <Field label="Advisory filter">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Require advisory gate</span>
                            <Switch checked={form.use_advisory_filter} onCheckedChange={(value) => setForm((current) => ({ ...current, use_advisory_filter: value }))} />
                          </div>
                        </Field>
                        <Field label="Advisory mode">
                          <Input value={form.advisory_mode} onChange={(event) => setForm((current) => ({ ...current, advisory_mode: event.target.value }))} />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Risk, Fees & Guards</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Fee bps">
                          <Input type="number" step="0.01" value={form.fee_bps} onChange={(event) => setForm((current) => ({ ...current, fee_bps: event.target.value }))} />
                        </Field>
                        <Field label="Max slippage bps">
                          <Input type="number" step="0.01" value={form.max_slippage_bps} onChange={(event) => setForm((current) => ({ ...current, max_slippage_bps: event.target.value }))} />
                        </Field>
                        <Field label="Max allowed slippage bps">
                          <Input type="number" step="0.01" value={form.max_allowed_slippage_bps} onChange={(event) => setForm((current) => ({ ...current, max_allowed_slippage_bps: event.target.value }))} />
                        </Field>
                        <Field label="Min net profit bps">
                          <Input type="number" step="0.01" value={form.min_net_profit_bps} onChange={(event) => setForm((current) => ({ ...current, min_net_profit_bps: event.target.value }))} />
                        </Field>
                        <Field label="Stale feed max age seconds">
                          <Input type="number" step="1" value={form.stale_feed_max_age_seconds} onChange={(event) => setForm((current) => ({ ...current, stale_feed_max_age_seconds: event.target.value }))} />
                        </Field>
                        <Field label="Stale feed timeout seconds">
                          <Input type="number" step="1" value={form.stale_feed_timeout_seconds} onChange={(event) => setForm((current) => ({ ...current, stale_feed_timeout_seconds: event.target.value }))} />
                        </Field>
                        <Field label="Daily loss limit pct">
                          <Input type="number" step="0.0001" value={form.daily_loss_limit_pct} onChange={(event) => setForm((current) => ({ ...current, daily_loss_limit_pct: event.target.value }))} />
                        </Field>
                        <Field label="Max drawdown pct">
                          <Input type="number" step="0.0001" value={form.max_drawdown_pct} onChange={(event) => setForm((current) => ({ ...current, max_drawdown_pct: event.target.value }))} />
                        </Field>
                        <Field label="Max open orders">
                          <Input type="number" step="1" value={form.max_open_orders} onChange={(event) => setForm((current) => ({ ...current, max_open_orders: event.target.value }))} />
                        </Field>
                        <Field label="Max position pct">
                          <Input type="number" step="0.0001" value={form.max_position_pct} onChange={(event) => setForm((current) => ({ ...current, max_position_pct: event.target.value }))} />
                        </Field>
                        <Field label="Pause on failure streak">
                          <Input type="number" step="1" value={form.pause_on_order_failure_streak} onChange={(event) => setForm((current) => ({ ...current, pause_on_order_failure_streak: event.target.value }))} />
                        </Field>
                        <Field label="Pause on stale feed">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Block fresh entries</span>
                            <Switch checked={form.pause_on_stale_feed} onCheckedChange={(value) => setForm((current) => ({ ...current, pause_on_stale_feed: value }))} />
                          </div>
                        </Field>
                        <Field label="Pause on exchange unhealthy">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Use exchange health gate</span>
                            <Switch checked={form.pause_on_exchange_unhealthy} onCheckedChange={(value) => setForm((current) => ({ ...current, pause_on_exchange_unhealthy: value }))} />
                          </div>
                        </Field>
                        <Field label="Pause on slippage spike">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Guard extreme moves</span>
                            <Switch checked={form.pause_on_slippage_spike} onCheckedChange={(value) => setForm((current) => ({ ...current, pause_on_slippage_spike: value }))} />
                          </div>
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Exit, Profit & Partial Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Require stop loss">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Enable hard stop loss</span>
                            <Switch checked={form.require_stop_loss} onCheckedChange={(value) => setForm((current) => ({ ...current, require_stop_loss: value }))} />
                          </div>
                        </Field>
                        <Field label="Stop loss pct">
                          <Input type="number" step="0.0001" value={form.stop_loss_pct} onChange={(event) => setForm((current) => ({ ...current, stop_loss_pct: event.target.value }))} />
                        </Field>
                        <Field label="Require take profit">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Enable take profit</span>
                            <Switch checked={form.require_take_profit} onCheckedChange={(value) => setForm((current) => ({ ...current, require_take_profit: value }))} />
                          </div>
                        </Field>
                        <Field label="Take profit pct">
                          <Input type="number" step="0.0001" value={form.take_profit_pct} onChange={(event) => setForm((current) => ({ ...current, take_profit_pct: event.target.value }))} />
                        </Field>
                        <Field label="Require time stop">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Auto exit after elapsed time</span>
                            <Switch checked={form.require_time_stop} onCheckedChange={(value) => setForm((current) => ({ ...current, require_time_stop: value }))} />
                          </div>
                        </Field>
                        <Field label="Time stop minutes">
                          <Input type="number" step="1" value={form.time_stop_minutes} onChange={(event) => setForm((current) => ({ ...current, time_stop_minutes: event.target.value }))} />
                        </Field>
                        <Field label="Allow partial sell">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Sell a slice on trigger</span>
                            <Switch checked={form.allow_partial_sell} onCheckedChange={(value) => setForm((current) => ({ ...current, allow_partial_sell: value }))} />
                          </div>
                        </Field>
                        <Field label="Partial sell pct">
                          <Input type="number" step="0.0001" value={form.partial_sell_pct} onChange={(event) => setForm((current) => ({ ...current, partial_sell_pct: event.target.value }))} />
                        </Field>
                        <Field label="Allow partial buy">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Accumulate in slices</span>
                            <Switch checked={form.allow_partial_buy} onCheckedChange={(value) => setForm((current) => ({ ...current, allow_partial_buy: value }))} />
                          </div>
                        </Field>
                        <Field label="Partial buy pct">
                          <Input type="number" step="0.0001" value={form.partial_buy_pct} onChange={(event) => setForm((current) => ({ ...current, partial_buy_pct: event.target.value }))} />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card className={cn(form.market_type !== "futures" && "opacity-80")}>
                      <CardHeader>
                        <CardTitle>Futures Controls</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <Field label="Leverage" hint="Used only for futures testnet path.">
                          <Input type="number" step="0.1" value={form.leverage} onChange={(event) => setForm((current) => ({ ...current, leverage: event.target.value }))} />
                        </Field>
                        <Field label="Margin type">
                          <Select value={form.margin_type} onValueChange={(value: BotForm["margin_type"]) => setForm((current) => ({ ...current, margin_type: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="isolated">isolated</SelectItem>
                              <SelectItem value="cross">cross</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Position mode">
                          <Select value={form.position_mode} onValueChange={(value: BotForm["position_mode"]) => setForm((current) => ({ ...current, position_mode: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one_way">one_way</SelectItem>
                              <SelectItem value="hedge">hedge</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Reduce-only exit orders">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Protective exits only</span>
                            <Switch checked={form.reduce_only_exit_orders} onCheckedChange={(value) => setForm((current) => ({ ...current, reduce_only_exit_orders: value }))} />
                          </div>
                        </Field>
                        <Field label="Max open position per symbol">
                          <Input type="number" step="0.0001" value={form.max_open_position_per_symbol} onChange={(event) => setForm((current) => ({ ...current, max_open_position_per_symbol: event.target.value }))} />
                        </Field>
                        <Field label="Allow reverse signal">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Flip direction on signal</span>
                            <Switch checked={form.allow_reverse_signal} onCheckedChange={(value) => setForm((current) => ({ ...current, allow_reverse_signal: value }))} />
                          </div>
                        </Field>
                        <Field label="Close on opposite signal">
                          <div className="flex h-10 items-center justify-between rounded-md border px-3">
                            <span className="text-sm text-muted-foreground">Flatten first</span>
                            <Switch checked={form.close_on_opposite_signal} onCheckedChange={(value) => setForm((current) => ({ ...current, close_on_opposite_signal: value }))} />
                          </div>
                        </Field>
                        <Field label="Risk per trade">
                          <Input type="number" step="0.01" value={form.risk_per_trade} onChange={(event) => setForm((current) => ({ ...current, risk_per_trade: event.target.value }))} />
                        </Field>
                        <Field label="Max daily loss">
                          <Input type="number" step="0.01" value={form.max_daily_loss} onChange={(event) => setForm((current) => ({ ...current, max_daily_loss: event.target.value }))} />
                        </Field>
                        <Field label="Max consecutive losses">
                          <Input type="number" step="1" value={form.max_consecutive_losses} onChange={(event) => setForm((current) => ({ ...current, max_consecutive_losses: event.target.value }))} />
                        </Field>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Params JSON</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={form.strategy_params_json}
                        onChange={(event) => setForm((current) => ({ ...current, strategy_params_json: event.target.value }))}
                        className="min-h-[220px] font-mono text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setForm((current) => ({ ...current, strategy_params_json: formatJson(STRATEGY_DEFAULTS[current.algorithm]) }))}
                        >
                          Load defaults
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const parsed = safeParseStrategyParams(form.strategy_params_json);
                            if (parsed.error) {
                              toast({
                                title: "JSON invalid",
                                description: parsed.error,
                                variant: "destructive",
                              });
                              return;
                            }
                            setForm((current) => ({ ...current, strategy_params_json: formatJson(parsed.data) }));
                          }}
                        >
                          Pretty print JSON
                        </Button>
                        {strategyValidation.error ? (
                          <Badge variant="destructive">{strategyValidation.error}</Badge>
                        ) : (
                          <Badge variant="default">JSON valid</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="anchors" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Manual Overrides</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedMarketType === "spot" ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Anchor Manual Buy</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <Field label="Buy price">
                                <Input type="number" step="0.0001" value={anchorBuyPrice} onChange={(event) => setAnchorBuyPrice(event.target.value)} />
                              </Field>
                              <Field label="Quantity">
                                <Input type="number" step="0.00000001" value={anchorBuyQty} onChange={(event) => setAnchorBuyQty(event.target.value)} />
                              </Field>
                              <Button
                                type="button"
                                onClick={() => selectedBotId && anchorMutation.mutate({ botId: selectedBotId, side: "anchor-buy", price: anchorBuyPrice, quantity: anchorBuyQty })}
                                disabled={!selectedBotId || !anchorBuyPrice || !anchorBuyQty || isBusy}
                              >
                                Record manual buy
                              </Button>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Anchor Manual Sell</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <Field label="Sell price">
                                <Input type="number" step="0.0001" value={anchorSellPrice} onChange={(event) => setAnchorSellPrice(event.target.value)} />
                              </Field>
                              <Field label="Quantity">
                                <Input type="number" step="0.00000001" value={anchorSellQty} onChange={(event) => setAnchorSellQty(event.target.value)} />
                              </Field>
                              <Button
                                type="button"
                                onClick={() => selectedBotId && anchorMutation.mutate({ botId: selectedBotId, side: "anchor-sell", price: anchorSellPrice, quantity: anchorSellQty })}
                                disabled={!selectedBotId || !anchorSellPrice || !anchorSellQty || isBusy}
                              >
                                Record manual sell
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          Futures bots do not rely on manual buy/sell anchors. Runtime position, signal, and reduce-only exit logic become the source of truth instead.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Current Ratio Diagnostics</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <DetailRow label="Current price" value={formatNumber(currentRatio?.current_price, 6)} />
                      <DetailRow label="Position state" value={prettyLabel(currentRatio?.position_state || selectedBot?.state?.position_state)} />
                      <DetailRow label="Active anchor type" value={prettyLabel(currentRatio?.active_anchor_type || selectedBot?.state?.active_anchor_type)} />
                      <DetailRow label="Active anchor price" value={formatNumber(currentRatio?.active_anchor_price || selectedBot?.state?.active_anchor_price, 6)} />
                      <DetailRow label="Effective sell ratio" value={formatRatioPercent(currentRatio?.effective_sell_ratio)} />
                      <DetailRow label="Effective buy ratio" value={formatRatioPercent(currentRatio?.effective_buy_ratio)} />
                      <DetailRow label="Cost ratio" value={formatRatioPercent(currentRatio?.cost_ratio)} />
                      <DetailRow label="Sell armed" value={formatBoolean(!!currentRatio?.sell_armed || !!selectedBot?.state?.sell_armed)} />
                      <DetailRow label="Buy armed" value={formatBoolean(!!currentRatio?.buy_armed || !!selectedBot?.state?.buy_armed)} />
                      <DetailRow label="Pending trigger side" value={prettyLabel(currentRatio?.pending_trigger_side || selectedBot?.state?.pending_trigger_side)} />
                      <DetailRow label="Pending trigger ratio" value={formatRatioPercent(currentRatio?.pending_trigger_ratio || selectedBot?.state?.pending_trigger_ratio)} />
                      <DetailRow label="Pending trigger updates" value={formatNumber(currentRatio?.pending_trigger_updates || selectedBot?.state?.pending_trigger_updates, 0)} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="audit" className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Decisions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Decision</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Ratio</TableHead>
                              <TableHead>At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(decisionsQuery.data ?? EMPTY_DECISIONS).slice(0, 20).map((decision) => (
                              <TableRow key={decision.id}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Badge variant={statusVariant(decision.decision)}>{prettyLabel(decision.decision)}</Badge>
                                    <div className="text-xs text-muted-foreground">{decision.reason || "No reason"}</div>
                                  </div>
                                </TableCell>
                                <TableCell>{prettyLabel(decision.execution_status)}</TableCell>
                                <TableCell>{formatRatioPercent(decision.computed_ratio)}</TableCell>
                                <TableCell>{formatDateTime(decision.decided_at)}</TableCell>
                              </TableRow>
                            ))}
                            {(decisionsQuery.data ?? EMPTY_DECISIONS).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                  No decisions recorded yet.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Context</TableHead>
                              <TableHead>At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(eventsQuery.data ?? EMPTY_EVENTS).slice(0, 20).map((event) => (
                              <TableRow key={event.id}>
                                <TableCell>
                                  <Badge variant={statusVariant(event.event_type)}>{prettyLabel(event.event_type)}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[280px]">
                                  <div className="line-clamp-3 text-xs text-muted-foreground">
                                    {event.context ? JSON.stringify(event.context) : "No context"}
                                  </div>
                                </TableCell>
                                <TableCell>{formatDateTime(event.occurred_at)}</TableCell>
                              </TableRow>
                            ))}
                            {(eventsQuery.data ?? EMPTY_EVENTS).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                                  No events recorded yet.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Debug Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <JsonBlock
                        value={{
                          status: currentStatus,
                          feed: currentFeed,
                          ratio: currentRatio,
                          last_signal: currentSignal,
                          last_order: currentOrder,
                          position: currentPosition,
                          pnl: currentPnl,
                        }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
