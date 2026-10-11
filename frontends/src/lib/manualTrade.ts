/**
 * Types + pure helpers for Quick Trade "Manual SL/TP" mode.
 *
 * Shapes below are hand-written from the REAL Laravel responses
 * (App\Domain\QuickTradeManual\ManualPositionPresenter / ManualPreviewService), not from the legacy
 * Supabase types. Anything the backend does not return is not displayed.
 */

export type ManualDirection = "long" | "short";

export const MANUAL_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"] as const;
export const CHART_TIMEFRAMES = ["5m", "15m", "1h", "4h"] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export interface ManualStatus {
  server_enabled: boolean;
  workspace_enabled: boolean;
  enabled: boolean;
  allow_mainnet: boolean;
  can_manage: boolean;
  exchange_verification: string;
  sl_basis: "price_movement";
  limits: {
    symbols: string[];
    min_stake: number;
    max_stake: number;
    max_leverage: number;
    min_sl_pct: number;
    max_sl_pct: number;
    min_trailing_pct: number;
    max_trailing_pct: number;
    max_trailing_activation_pct: number;
    max_open_positions: number;
    price_tolerance_pct: number;
  };
}

export interface ManualPreview {
  ok: boolean;
  errors: { code: string; message: string }[];
  warnings: string[];
  symbol: string;
  direction: ManualDirection;
  reference_price: number;
  stake: number;
  leverage: number;
  quantity: number;
  notional: number;
  margin_required: number;
  sl_pct: number;
  sl_basis: "price_movement";
  sl_trigger_price: number;
  sl_distance_pct: number;
  margin_loss_pct_at_sl: number;
  estimated_loss_at_sl: number;
  gross_loss_at_sl: number;
  entry_fee_estimate: number;
  exit_fee_estimate_at_sl: number;
  slippage_risk_estimate: number;
  take_profit: null | { trigger_price: number; distance_pct: number; gross_profit: number; exit_fee: number; net_profit: number };
  estimated_liquidation_price: number | null;
  estimated_liquidation_distance_pct: number | null;
  position_mode: "one_way" | "hedge";
  margin_type: string | null;
  funding_rate: number | null;
  next_funding_ms: number | null;
  available_balance: number;
  environment: "testnet" | "live";
  integration_id: string;
  live_gate: string | null;
}

export type ManualStatusName =
  | "ENTRY_PENDING" | "ENTRY_FILLED" | "PARTIALLY_FILLED" | "ENTRY_FAILED" | "PROTECTION_PENDING" | "PROTECTION_FAILED"
  | "EMERGENCY_EXIT" | "OPEN_PROTECTED" | "CLOSING" | "RECONCILIATION" | "CLOSED" | "CLOSE_FAILED"
  | "EXCHANGE_STATE_UNKNOWN" | "LIQUIDATED";

export interface ManualLive {
  error: string | null;
  mark_price?: number;
  exchange_quantity?: number;
  unrealized_pnl?: number | null;
  estimated_net_pnl?: number | null;
  roe_pct?: number | null;
  liquidation_price?: number | null;
  funding_rate?: number | null;
  next_funding_ms?: number | null;
  exchange_margin_type?: string | null;
  exchange_leverage?: number | null;
  fetched_at?: string;
}

export interface ManualEvent {
  type: string;
  from_status: string | null;
  to_status: string | null;
  source: string;
  severity: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ManualPosition {
  id: string;
  mode: "manual_sl_tp";
  status: ManualStatusName;
  environment: "testnet" | "live";
  symbol: string;
  direction: ManualDirection;
  position_mode: string;
  margin_type: string | null;
  stake_amount: number;
  leverage: number;
  requested_quantity: number | null;
  executed_quantity: number | null;
  entry_reference_price: number | null;
  entry_price: number | null;
  entry_slippage_pct: number | null;
  sl_pct: number;
  sl_basis: "price_movement";
  sl_trigger_price: number | null;
  tp_pct: number | null;
  trailing_pct: number | null;
  trailing_activation_pct: number | null;
  trailing_activation_price: number | null;
  trailing_status: string;
  trailing_algo_id: string | null;
  tp_trigger_price: number | null;
  estimated_liquidation_price: number | null;
  exchange_liquidation_price: number | null;
  protection_status: "NONE" | "PENDING" | "PROTECTED" | "FAILED" | "LOST" | "UNKNOWN";
  sl_status: string;
  tp_status: string;
  sl_algo_id: string | null;
  tp_algo_id: string | null;
  sl_verified_at: string | null;
  entry_order_id: string | null;
  close_order_id: string | null;
  exit_reason: string | null;
  closed_by: string | null;
  exit_price: number | null;
  entry_fee: number | null;
  exit_fee: number | null;
  funding_fee: number | null;
  gross_pnl: number | null;
  net_pnl: number | null;
  pnl_source: string | null;
  critical_alert: boolean;
  emergency_close_confirmed: boolean;
  last_error: string | null;
  opened_at: string | null;
  protected_at: string | null;
  closed_at: string | null;
  last_reconciled_at: string | null;
  created_at: string | null;
  age_seconds: number | null;
  is_terminal: boolean;
  can_close: boolean;
  outcome: string;
  has_expiry: false;
  live: ManualLive | null;
  events?: ManualEvent[];
}

export interface ManualClosePreview {
  position_id: string;
  symbol: string;
  direction: ManualDirection;
  quantity: number;
  mark_price: number;
  entry_price: number;
  estimated_gross_pnl: number;
  estimated_entry_fee: number;
  estimated_exit_fee: number;
  estimated_net_pnl: number;
  funding_note: string;
  slippage_warning: string;
  already_flat_on_exchange: boolean;
}

export interface OrderForm {
  symbol: string;
  direction: ManualDirection;
  stake: number;
  leverage: number;
  slPct: number | null;
  tpPct: number | null;
  trailingPct: number | null;
  trailingActivationPct: number | null;
}

/**
 * LOCAL instant estimate for chart/form feedback BEFORE the exchange preview answers. Tick size and step are
 * unknown here, so numbers are unrounded; the exchange-backed preview is the only authority for the review screen.
 * SL % is PRICE movement (entry 80,000 and 1 % => 79,200 long / 80,800 short).
 */
export function localTrigger(direction: ManualDirection, entry: number, pct: number, kind: "sl" | "tp"): number {
  const adverse = kind === "sl";
  const up = (direction === "long") !== adverse;
  return entry * (1 + (up ? 1 : -1) * (pct / 100));
}

export function localEstimate(form: OrderForm, price: number | null) {
  if (!price || !(price > 0) || form.slPct == null || !(form.slPct > 0)) return null;
  const notional = form.stake * form.leverage;
  const quantity = notional / price;
  const sl = localTrigger(form.direction, price, form.slPct, "sl");
  const tp = form.tpPct != null && form.tpPct > 0 ? localTrigger(form.direction, price, form.tpPct, "tp") : null;
  const grossLoss = Math.abs(price - sl) * quantity;
  return { notional, quantity, slTrigger: sl, tpTrigger: tp, grossLossAtSl: grossLoss, marginLossPct: form.stake > 0 ? (grossLoss / form.stake) * 100 : 0 };
}

/**
 * Body for POST /quick-trade-manual/positions. Deliberately has NO timeframe, duration or expiry field: the chart timeframe
 * is a display setting and can never influence the trade. `idempotency_key` must be reused for retries of the SAME confirmation.
 */
export function buildOpenRequest(form: OrderForm, ctx: { idempotencyKey: string; referencePrice: number; integrationId?: string | null }) {
  return {
    symbol: form.symbol,
    direction: form.direction,
    stake_amount: form.stake,
    leverage: form.leverage,
    sl_pct: form.slPct,
    tp_pct: form.tpPct,
    trailing_pct: form.trailingPct,
    trailing_activation_pct: form.trailingActivationPct,
    reference_price: ctx.referencePrice,
    idempotency_key: ctx.idempotencyKey,
    integration_id: ctx.integrationId ?? undefined,
    confirm: true,
  };
}

export function buildPreviewRequest(form: OrderForm, integrationId?: string | null) {
  return {
    symbol: form.symbol,
    direction: form.direction,
    stake_amount: form.stake,
    leverage: form.leverage,
    sl_pct: form.slPct,
    tp_pct: form.tpPct,
    trailing_pct: form.trailingPct,
    trailing_activation_pct: form.trailingActivationPct,
    integration_id: integrationId ?? undefined,
  };
}

/** Backend errors look like "code: human message". */
export function parseApiError(message: string): { code: string; text: string } {
  const m = /^([a-z0-9_]+):\s*([\s\S]*)$/.exec(message ?? "");
  return m ? { code: m[1], text: m[2] } : { code: "error", text: message ?? "Request failed" };
}

export const STATUS_LABEL: Record<ManualStatusName, string> = {
  ENTRY_PENDING: "Entering...",
  ENTRY_FILLED: "Entry filled",
  PARTIALLY_FILLED: "Partially filled",
  ENTRY_FAILED: "Entry failed",
  PROTECTION_PENDING: "Placing exchange stop...",
  PROTECTION_FAILED: "Protection failed",
  EMERGENCY_EXIT: "Emergency close",
  OPEN_PROTECTED: "Open - protected",
  CLOSING: "Closing...",
  RECONCILIATION: "Reconciling",
  CLOSED: "Closed",
  CLOSE_FAILED: "Close failed",
  EXCHANGE_STATE_UNKNOWN: "Exchange state unknown",
  LIQUIDATED: "Liquidated",
};

/** Protection is only ever described as protected when the backend says so (verified on the exchange). */
export function protectionLabel(p: ManualPosition): { text: string; tone: "ok" | "warn" | "bad" } {
  if (p.protection_status === "PROTECTED" && p.status === "OPEN_PROTECTED") return { text: "Exchange stop-loss verified", tone: "ok" };
  if (p.protection_status === "UNKNOWN") return { text: "Protection state unreadable (not assumed lost)", tone: "warn" };
  if (p.protection_status === "LOST" || p.protection_status === "FAILED") return { text: "NOT protected", tone: "bad" };
  if (p.is_terminal) return { text: "Position ended", tone: "ok" };
  return { text: "Protection pending", tone: "warn" };
}

export function fmtPrice(v: number | null | undefined, digits = 2): string {
  return v == null || !Number.isFinite(v) ? "-" : v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
}

export function fmtPnl(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  const s = abs > 0 && abs < 0.01 ? abs.toFixed(6) : abs.toFixed(2);
  return `${v < 0 ? "-" : v > 0 ? "+" : ""}${s}`;
}

export function fmtAge(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}
