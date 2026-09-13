import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Gem,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnections } from "@/hooks/useConnections";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types -- mirror PepperstoneBotController exactly (app/Http/Controllers/Api/
// PepperstoneBotController.php). Brand-new domain: never existed in the
// legacy Supabase schema, so nothing is imported from there.
// ---------------------------------------------------------------------------

type BotStatus = "idle" | "running" | "paused" | "blocked" | "stopped";
type BasketDirection = "buy" | "sell";
type BasketStatus = "idle" | "watching" | "ready" | "active" | "paused" | "exiting" | "closed" | "risk_blocked";
type SlotStatus = "pending" | "filled" | "closed" | "cancelled";
type MarketType = "metal" | "energy";

interface PepperstoneBotState {
  status: BotStatus;
  block_reason_code: string | null;
  block_reason_detail: string | null;
  active_levels_count: number;
  total_exposure_lots: string;
  basket_avg_price: string | null;
  last_evaluated_at: string | null;
}

interface Instrument {
  id: string;
  canonical_symbol: string;
  market_type: MarketType;
  name: string;
  quote_currency: string;
  enabled: boolean;
}

interface PepperstoneBotConfig {
  id: string;
  workspace_id: string;
  instrument_id: string;
  connection_id: string | null;
  enabled: boolean;
  lot_per_level: string;
  max_basket_levels: number | null;
  max_total_exposure_lots: string;
  max_position_lots: string;
  portfolio_exposure_cap_lots: string | null;
  spread_limit_pips: string | null;
  slippage_limit_pips: string | null;
  maximum_allowed_slippage: string | null;
  v3_confidence_threshold: string | null;
  min_mtf_confidence: string | null;
  daily_loss_limit_pct: string | null;
  margin_safety_reserve_floor: string | null;
  basket_take_profit_pct: string | null;
  basket_stop_loss_pct: string;
  created_at: string;
  updated_at: string;
  state: PepperstoneBotState | null;
  instrument: Instrument | null;
}

interface PepperstoneBasketSlot {
  id: string;
  pepperstone_basket_id: string;
  level_index: number;
  entry_price: string;
  lot_size: string;
  order_id: string | null;
  status: SlotStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_pnl: string | null;
}

interface PepperstoneBasket {
  id: string;
  pepperstone_bot_config_id: string;
  direction: BasketDirection;
  status: BasketStatus;
  max_levels: number;
  opened_levels: number;
  lot_per_level: string;
  average_entry: string | null;
  floating_pnl: string | null;
  take_profit_target: string | null;
  maximum_allowed_loss: string;
  v3_direction: string;
  v3_confidence: string;
  mtf_confidence: string;
  mtf_agreement_score: string;
  opened_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  slots: PepperstoneBasketSlot[];
}

interface PepperstoneBotEvent {
  id: string;
  event_type: string;
  context_json: Record<string, unknown> | null;
  created_at: string;
}

const EMPTY_BOTS: PepperstoneBotConfig[] = [];
const EMPTY_BASKETS: PepperstoneBasket[] = [];
const EMPTY_EVENTS: PepperstoneBotEvent[] = [];
const EMPTY_INSTRUMENTS: Instrument[] = [];

// ---------------------------------------------------------------------------
// Fixed dataviz palette -- identical status-palette convention/values used
// on ForexGridBotPage.tsx. Do not invent new colors here.
// ---------------------------------------------------------------------------

const STATUS_META: Record<BotStatus, { label: string; color: string; Icon: typeof Play }> = {
  running: { label: "Running", color: "#0ca30c", Icon: Play },
  paused: { label: "Paused", color: "#fab219", Icon: Pause },
  blocked: { label: "Blocked", color: "#ec835a", Icon: ShieldAlert },
  stopped: { label: "Stopped", color: "#d03b3b", Icon: Square },
  idle: { label: "Idle", color: "#94a3b8", Icon: Activity },
};

// Basket's own 8-state machine -- distinct badge per state, reusing the
// same good/neutral/warning/critical/muted convention as STATUS_META above
// rather than inventing a second palette.
const BASKET_STATUS_META: Record<BasketStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "#0ca30c" },
  watching: { label: "Watching", color: "#3987e5" },
  ready: { label: "Ready", color: "#3987e5" },
  paused: { label: "Paused", color: "#fab219" },
  exiting: { label: "Exiting", color: "#fab219" },
  closed: { label: "Closed", color: "#94a3b8" },
  risk_blocked: { label: "Risk blocked", color: "#d03b3b" },
  idle: { label: "Idle", color: "#94a3b8" },
};

const BUY_TEXT = "text-[#2a78d6] dark:text-[#3987e5]";
const BUY_BG = "bg-[#2a78d6] dark:bg-[#3987e5]";
const SELL_TEXT = "text-[#e34948] dark:text-[#e66767]";
const SELL_BG = "bg-[#e34948] dark:bg-[#e66767]";
const DELTA_UP_TEXT = "text-[#006300] dark:text-[#0ca30c]";
const DELTA_DOWN_TEXT = "text-[#d03b3b]";

function StatusBadge({ status }: { status: BotStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ color: meta.color, borderColor: meta.color }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
      {meta.label}
    </span>
  );
}

function BasketStatusBadge({ status }: { status: BasketStatus }) {
  const meta = BASKET_STATUS_META[status] ?? BASKET_STATUS_META.idle;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ color: meta.color, borderColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function SlotStatusBadge({ status }: { status: SlotStatus }) {
  const map: Record<SlotStatus, { label: string; color: string }> = {
    filled: { label: "Filled", color: "#0ca30c" },
    pending: { label: "Pending", color: "#3987e5" },
    closed: { label: "Closed", color: "#94a3b8" },
    cancelled: { label: "Cancelled", color: "#d03b3b" },
  };
  const meta = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: meta.color, borderColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function toNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value?: string | number | null, maximumFractionDigits = 4): string {
  const parsed = toNumber(value);
  if (parsed === null) return "None";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(parsed);
}

function formatPercent(value?: string | number | null): string {
  const parsed = toNumber(value);
  if (parsed === null) return "None";
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(parsed * 100)}%`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function relativeTime(value?: string | null): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(-diffSec, "second");
  if (abs < 3600) return rtf.format(-Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(diffSec / 3600), "hour");
  return rtf.format(-Math.round(diffSec / 86400), "day");
}

function prettyLabel(value?: string | null): string {
  if (!value) return "None";
  return value.replace(/_/g, " ");
}

function humanizeEventType(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function summarizeEventContext(event: PepperstoneBotEvent): string {
  const ctx = event.context_json || {};
  switch (event.event_type) {
    case "level_opened":
      return `Level ${ctx.level_index ?? "?"} opened (${String(ctx.side ?? "").toUpperCase()} @ ${formatNumber(ctx.entry_price as string, 5)})`;
    case "basket_closed":
      return `Basket closed${ctx.reason ? ` (${prettyLabel(String(ctx.reason))})` : ""}${ctx.realized_pnl != null ? `, P&L ${formatNumber(ctx.realized_pnl as string, 2)}` : ""}`;
    case "blocked":
      return String(ctx.reason_detail || ctx.reason_code || "Bot blocked.");
    case "feed_error":
      return String(ctx.detail || "Market data feed error.");
    case "kill_switch_activated":
      return String(ctx.reason || "Kill switch activated.");
    case "started":
      return "Bot started.";
    case "paused":
      return "Bot paused.";
    case "stopped":
      return "Bot stopped.";
    default:
      return Object.keys(ctx).length > 0 ? JSON.stringify(ctx) : "No additional detail.";
  }
}

// ---------------------------------------------------------------------------
// Form -- every validated field except the excluded martingale/sizing-mode
// fields (position_sizing_mode / martingale_multiplier /
// martingale_max_lot_size / hybrid_martingale_level_count / base_lot_size).
// A basket bot is equal-lot only via lot_per_level -- see
// PepperstoneBotController::validatedPayload()'s docblock.
// ---------------------------------------------------------------------------

type BotForm = {
  instrument_id: string;
  connection_id: string;
  lot_per_level: string;
  max_basket_levels: string;
  max_total_exposure_lots: string;
  max_position_lots: string;
  portfolio_exposure_cap_lots: string;
  spread_limit_pips: string;
  slippage_limit_pips: string;
  maximum_allowed_slippage: string;
  v3_confidence_threshold: string;
  min_mtf_confidence: string;
  daily_loss_limit_pct: string;
  margin_safety_reserve_floor: string;
  basket_take_profit_pct: string;
  basket_stop_loss_pct: string;
};

function initialForm(defaultInstrumentId: string): BotForm {
  return {
    instrument_id: defaultInstrumentId,
    connection_id: "none",
    lot_per_level: "0.01",
    max_basket_levels: "8",
    max_total_exposure_lots: "1",
    max_position_lots: "1",
    portfolio_exposure_cap_lots: "",
    spread_limit_pips: "",
    slippage_limit_pips: "",
    maximum_allowed_slippage: "",
    v3_confidence_threshold: "0.6",
    min_mtf_confidence: "0.6",
    daily_loss_limit_pct: "",
    margin_safety_reserve_floor: "",
    basket_take_profit_pct: "",
    basket_stop_loss_pct: "5",
  };
}

function buildFormFromConfig(config: PepperstoneBotConfig): BotForm {
  return {
    instrument_id: config.instrument_id,
    connection_id: config.connection_id || "none",
    lot_per_level: String(config.lot_per_level ?? ""),
    max_basket_levels: config.max_basket_levels != null ? String(config.max_basket_levels) : "",
    max_total_exposure_lots: String(config.max_total_exposure_lots ?? ""),
    max_position_lots: String(config.max_position_lots ?? ""),
    portfolio_exposure_cap_lots: config.portfolio_exposure_cap_lots != null ? String(config.portfolio_exposure_cap_lots) : "",
    spread_limit_pips: config.spread_limit_pips != null ? String(config.spread_limit_pips) : "",
    slippage_limit_pips: config.slippage_limit_pips != null ? String(config.slippage_limit_pips) : "",
    maximum_allowed_slippage: config.maximum_allowed_slippage != null ? String(config.maximum_allowed_slippage) : "",
    v3_confidence_threshold: config.v3_confidence_threshold != null ? String(config.v3_confidence_threshold) : "",
    min_mtf_confidence: config.min_mtf_confidence != null ? String(config.min_mtf_confidence) : "",
    daily_loss_limit_pct: config.daily_loss_limit_pct != null ? String(config.daily_loss_limit_pct) : "",
    margin_safety_reserve_floor: config.margin_safety_reserve_floor != null ? String(config.margin_safety_reserve_floor) : "",
    basket_take_profit_pct: config.basket_take_profit_pct != null ? String(config.basket_take_profit_pct) : "",
    basket_stop_loss_pct: String(config.basket_stop_loss_pct ?? ""),
  };
}

function validateForm(form: BotForm): string | null {
  if (!form.instrument_id || form.instrument_id === "none") return "Select an instrument.";
  if (!form.lot_per_level.trim()) return "Lot per level is required.";
  if (!form.max_total_exposure_lots.trim()) return "Max total exposure (lots) is required.";
  if (!form.max_position_lots.trim()) return "Max position (lots) is required.";
  if (!form.basket_stop_loss_pct.trim()) return "Basket stop loss % is required.";

  const confidenceFields: Array<[keyof BotForm, string]> = [
    ["v3_confidence_threshold", "Min V3 confidence"],
    ["min_mtf_confidence", "Min MTF confidence"],
  ];
  for (const [key, label] of confidenceFields) {
    const raw = form[key];
    if (raw.trim() === "") continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return `${label} must be between 0 and 1.`;
    }
  }

  return null;
}

function buildPayload(form: BotForm) {
  const optionalOrNull = (value: string) => (value.trim() === "" ? null : value);
  return {
    instrument_id: form.instrument_id,
    connection_id: form.connection_id === "none" ? null : form.connection_id,
    lot_per_level: form.lot_per_level,
    max_basket_levels: form.max_basket_levels.trim() === "" ? null : Number(form.max_basket_levels),
    max_total_exposure_lots: form.max_total_exposure_lots,
    max_position_lots: form.max_position_lots,
    portfolio_exposure_cap_lots: optionalOrNull(form.portfolio_exposure_cap_lots),
    spread_limit_pips: optionalOrNull(form.spread_limit_pips),
    slippage_limit_pips: optionalOrNull(form.slippage_limit_pips),
    maximum_allowed_slippage: optionalOrNull(form.maximum_allowed_slippage),
    v3_confidence_threshold: optionalOrNull(form.v3_confidence_threshold),
    min_mtf_confidence: optionalOrNull(form.min_mtf_confidence),
    daily_loss_limit_pct: optionalOrNull(form.daily_loss_limit_pct),
    margin_safety_reserve_floor: optionalOrNull(form.margin_safety_reserve_floor),
    basket_take_profit_pct: optionalOrNull(form.basket_take_profit_pct),
    basket_stop_loss_pct: form.basket_stop_loss_pct,
  };
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
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

// ---------------------------------------------------------------------------
// Exposure gauges -- identical sequential-blue-ramp-with-threshold-color-
// swap convention as ForexGridBotPage's ExposureGauge. Two gauges here: one
// per-bot cap (max_total_exposure_lots), one portfolio-wide cap
// (portfolio_exposure_cap_lots), both measured against the same
// state.total_exposure_lots figure.
// ---------------------------------------------------------------------------

function interpolateHex(from: string, to: string, t: number): string {
  const clampT = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clampT);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

function exposureRampColor(fraction: number): string {
  if (fraction <= 0.5) return interpolateHex("#cde2fb", "#3987e5", fraction / 0.5);
  return interpolateHex("#3987e5", "#184f95", (fraction - 0.5) / 0.5);
}

function ExposureGauge({ label, total, max }: { label: string; total: number | null; max: number | null }) {
  const fraction = total !== null && max !== null && max > 0 ? Math.min(1, total / max) : 0;
  let barColor = exposureRampColor(fraction);
  let stateLabel = "Within cap";
  if (max === null) {
    barColor = "#cde2fb";
    stateLabel = "No cap set";
  } else if (fraction >= 0.95) {
    barColor = STATUS_META.stopped.color;
    stateLabel = "At cap";
  } else if (fraction >= 0.8) {
    barColor = STATUS_META.paused.color;
    stateLabel = "Approaching cap";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">
          {total !== null ? formatNumber(total, 2) : "None"} / {max !== null ? formatNumber(max, 2) : "None"} lots ({(fraction * 100).toFixed(0)}%, {stateLabel})
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${fraction * 100}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence bar -- small horizontal bar for a 0-1 confidence value.
// ---------------------------------------------------------------------------

function ConfidenceBar({ label, value }: { label: string; value: number | null }) {
  const fraction = value !== null ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">{value !== null ? formatPercent(value) : "None"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basket panel -- centerpiece: direction, 8-state badge, opened/max levels
// progress, avg entry, floating P&L (text color only), slots table with a
// slot-status stacked bar legend.
// ---------------------------------------------------------------------------

function SlotStackedBar({ slots }: { slots: PepperstoneBasketSlot[] }) {
  if (slots.length === 0) return null;
  const colorFor = (status: SlotStatus) =>
    status === "filled" ? "#0ca30c" : status === "pending" ? "#3987e5" : status === "closed" ? "#94a3b8" : "#d03b3b";
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border/50">
      {[...slots]
        .sort((a, b) => a.level_index - b.level_index)
        .map((slot) => (
          <Tooltip key={slot.id}>
            <TooltipTrigger asChild>
              <div
                className="h-full flex-1"
                style={{ backgroundColor: colorFor(slot.status) }}
              />
            </TooltipTrigger>
            <TooltipContent>
              Level {slot.level_index} &middot; {prettyLabel(slot.status)}
            </TooltipContent>
          </Tooltip>
        ))}
    </div>
  );
}

function BasketPanel({ basket }: { basket: PepperstoneBasket | null }) {
  if (!basket) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current basket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            No basket open for this instrument yet. A basket is created once the bot's evaluation loop finds
            conditions that clear its configured MTF/V3 thresholds.
          </div>
        </CardContent>
      </Card>
    );
  }

  const floatingPnl = toNumber(basket.floating_pnl);
  const isPositive = floatingPnl !== null && floatingPnl >= 0;
  const dirText = basket.direction === "buy" ? BUY_TEXT : SELL_TEXT;
  const DirIcon = basket.direction === "buy" ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Current basket</CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1 text-sm font-semibold", dirText)}>
              <DirIcon className="h-4 w-4" />
              {basket.direction.toUpperCase()}
            </span>
            <BasketStatusBadge status={basket.status} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Levels opened</div>
            <div className="text-lg font-semibold">{basket.opened_levels} / {basket.max_levels}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Average entry</div>
            <div className="text-lg font-semibold">{formatNumber(basket.average_entry, 5)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Floating P&amp;L</div>
            <div className={cn("text-lg font-semibold", floatingPnl === null ? "text-foreground" : isPositive ? DELTA_UP_TEXT : DELTA_DOWN_TEXT)}>
              {floatingPnl === null ? "None" : formatNumber(floatingPnl, 2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Take profit target</div>
            <div className="text-lg font-semibold">{formatNumber(basket.take_profit_target, 5)}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Slot fill progress</span>
            <span>{basket.opened_levels} / {basket.max_levels} levels</span>
          </div>
          <SlotStackedBar slots={basket.slots} />
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#0ca30c" }} /> Filled</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#3987e5" }} /> Pending</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#94a3b8" }} /> Closed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#d03b3b" }} /> Cancelled</span>
          </div>
        </div>

        {basket.status === "closed" && basket.closed_reason ? (
          <p className="text-xs text-muted-foreground">
            Closed {formatDateTime(basket.closed_at)} &middot; reason: {prettyLabel(basket.closed_reason)}
          </p>
        ) : null}

        <div className="max-h-[320px] overflow-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Entry price</TableHead>
                <TableHead>Lot size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Realized P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...basket.slots]
                .sort((a, b) => a.level_index - b.level_index)
                .map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>{slot.level_index}</TableCell>
                    <TableCell>{formatNumber(slot.entry_price, 5)}</TableCell>
                    <TableCell>{formatNumber(slot.lot_size, 4)}</TableCell>
                    <TableCell><SlotStatusBadge status={slot.status} /></TableCell>
                    <TableCell>{formatDateTime(slot.opened_at)}</TableCell>
                    <TableCell>{slot.realized_pnl != null ? formatNumber(slot.realized_pnl, 2) : "None"}</TableCell>
                  </TableRow>
                ))}
              {basket.slots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No slots yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MTF/V3 "why" explainer -- basket's own recorded snapshot when a basket
// exists; otherwise the bot's config thresholds as "waiting for conditions"
// context. Never fabricates a live pre-basket reading -- no endpoint exposes
// one today.
// ---------------------------------------------------------------------------

function ConfirmationPanel({ basket, config }: { basket: PepperstoneBasket | null; config: PepperstoneBotConfig }) {
  if (basket) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MTF / V3 confirmation (basket snapshot)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">V3 direction</span>
            <span className="font-medium">{prettyLabel(basket.v3_direction)}</span>
          </div>
          <ConfidenceBar label="V3 confidence" value={toNumber(basket.v3_confidence)} />
          <ConfidenceBar label="MTF confidence" value={toNumber(basket.mtf_confidence)} />
          <ConfidenceBar label="MTF agreement score" value={toNumber(basket.mtf_agreement_score)} />
          <p className="text-xs text-muted-foreground">
            These are the values recorded when this basket was opened -- a fixed snapshot, not a live-updating
            reading.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">MTF / V3 confirmation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No basket is currently open, so there is no recorded confirmation snapshot to show. The bot only opens a
          basket once its evaluation loop finds conditions that clear these configured thresholds:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Min V3 confidence required</div>
            <div className="text-lg font-semibold">{config.v3_confidence_threshold != null ? formatPercent(config.v3_confidence_threshold) : "Not set"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Min MTF confidence required</div>
            <div className="text-lg font-semibold">{config.min_mtf_confidence != null ? formatPercent(config.min_mtf_confidence) : "Not set"}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          No API exposes a live pre-basket MTF/V3 reading today -- only baskets carry a recorded snapshot, so no
          live number is shown here.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bot list card -- mirrors ForexGridBotPage's BotListCard pattern.
// ---------------------------------------------------------------------------

function BotListCard({ bot, selected, onClick }: { bot: PepperstoneBotConfig; selected: boolean; onClick: () => void }) {
  const status = bot.state?.status ?? "idle";
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
          <div className="font-semibold">{bot.instrument?.name ?? "Unknown instrument"}</div>
          <div className="text-xs text-muted-foreground">
            {bot.instrument?.canonical_symbol ?? "?"} &middot; Pepperstone &middot; {prettyLabel(bot.instrument?.market_type)}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{bot.state?.active_levels_count ?? 0} active levels</span>
        <span>&middot;</span>
        <span>{formatNumber(bot.state?.total_exposure_lots, 2)} / {formatNumber(bot.max_total_exposure_lots, 2)} lots</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Events feed -- mirrors ForexGridBotPage's EventsFeed exactly.
// ---------------------------------------------------------------------------

function EventsFeed({ events }: { events: PepperstoneBotEvent[] }) {
  if (events.length === 0) {
    return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No events yet.</div>;
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-auto">
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-border/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">{humanizeEventType(event.event_type)}</Badge>
            <span className="text-xs text-muted-foreground">{relativeTime(event.created_at)}</span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{summarizeEventContext(event)}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

async function invalidateBotQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string | undefined,
  botId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pepperstone-bots", workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ["pepperstone-bot-baskets", botId] }),
    queryClient.invalidateQueries({ queryKey: ["pepperstone-bot-events", botId] }),
  ]);
}

export default function PepperstoneBotPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [] } = useConnections(workspaceId);
  const pepperstoneConnections = useMemo(
    () => connections.filter((connection) => connection.provider === "pepperstone"),
    [connections],
  );

  const { data: instruments = EMPTY_INSTRUMENTS } = useQuery({
    queryKey: ["pepperstone-instruments"],
    queryFn: async () => {
      const response = await api.get<Instrument[]>("/instruments", { params: { provider: "pepperstone" } });
      return response.data ?? [];
    },
  });

  const { data: bots = EMPTY_BOTS, isLoading: botsLoading } = useQuery({
    queryKey: ["pepperstone-bots", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as PepperstoneBotConfig[];
      const response = await api.get<PepperstoneBotConfig[]>(`/workspaces/${workspaceId}/pepperstone-bots`);
      return response.data ?? [];
    },
    enabled: !!workspaceId,
  });

  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<BotForm>(initialForm(""));

  useEffect(() => {
    if (!selectedBotId && !isCreating && bots.length > 0) {
      setSelectedBotId(bots[0].id);
      setForm(buildFormFromConfig(bots[0]));
    }
  }, [bots, isCreating, selectedBotId]);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) || null, [bots, selectedBotId]);

  const basketsQuery = useQuery({
    queryKey: ["pepperstone-bot-baskets", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as PepperstoneBasket[];
      const response = await api.get<PepperstoneBasket[]>(`/pepperstone-bots/${selectedBotId}/baskets`);
      return response.data ?? [];
    },
    enabled: !!selectedBotId,
  });
  const baskets = basketsQuery.data ?? EMPTY_BASKETS;
  const currentBasket = useMemo(() => baskets.find((basket) => basket.status !== "closed") ?? baskets[0] ?? null, [baskets]);

  const eventsQuery = useQuery({
    queryKey: ["pepperstone-bot-events", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as PepperstoneBotEvent[];
      const response = await api.get<PepperstoneBotEvent[]>(`/pepperstone-bots/${selectedBotId}/events`);
      return response.data ?? [];
    },
    enabled: !!selectedBotId,
  });
  const events = eventsQuery.data ?? EMPTY_EVENTS;

  const formError = validateForm(form);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Select a workspace first.");
      const payload = buildPayload(form);
      if (isCreating) {
        const response = await api.post<PepperstoneBotConfig>(`/workspaces/${workspaceId}/pepperstone-bots`, payload);
        return response.data;
      }
      if (!selectedBotId) throw new Error("Select a bot first.");
      const response = await api.put<PepperstoneBotConfig>(`/pepperstone-bots/${selectedBotId}`, payload);
      return response.data;
    },
    onSuccess: async (savedBot) => {
      toast({ title: isCreating ? "Bot created" : "Bot updated", description: `${savedBot.instrument?.name ?? "Bot"} configuration saved.` });
      setForm(buildFormFromConfig(savedBot));
      setSelectedBotId(savedBot.id);
      setIsCreating(false);
      await invalidateBotQueries(queryClient, workspaceId, savedBot.id);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({ botId, action }: { botId: string; action: "start" | "pause" | "stop" }) => {
      const response = await api.post<{ message?: string }>(`/pepperstone-bots/${botId}/${action}`, {});
      return { data: response.data, action, botId };
    },
    onSuccess: async ({ data, action, botId }) => {
      toast({ title: `${prettyLabel(action)} requested`, description: data.message || `${prettyLabel(action)} completed.` });
      await invalidateBotQueries(queryClient, workspaceId, botId);
    },
    onError: (error: Error) => {
      toast({ title: "Bot action failed", description: error.message, variant: "destructive" });
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (botId: string) => {
      const response = await api.post<{ message?: string }>(`/pepperstone-bots/${botId}/kill-switch`, {
        reason: "frontend_emergency_kill_switch",
      });
      return { data: response.data, botId };
    },
    onSuccess: async ({ data, botId }) => {
      toast({ title: "Kill switch activated", description: data.message || "Bot blocked and disabled." });
      await invalidateBotQueries(queryClient, workspaceId, botId);
    },
    onError: (error: Error) => {
      toast({ title: "Kill switch failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (botId: string) => {
      await api.delete(`/pepperstone-bots/${botId}`);
      return { botId };
    },
    onSuccess: async ({ botId }) => {
      toast({ title: "Bot deleted", description: "Config, baskets, events, and state were all removed." });
      setSelectedBotId(null);
      setIsCreating(false);
      queryClient.removeQueries({ queryKey: ["pepperstone-bot-baskets", botId] });
      queryClient.removeQueries({ queryKey: ["pepperstone-bot-events", botId] });
      await queryClient.invalidateQueries({ queryKey: ["pepperstone-bots", workspaceId] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  function handleCreateNew() {
    setIsCreating(true);
    setSelectedBotId(null);
    setForm(initialForm(instruments[0]?.id ?? ""));
  }

  function handleSelectBot(botId: string) {
    const bot = bots.find((candidate) => candidate.id === botId);
    if (!bot) return;
    setIsCreating(false);
    setSelectedBotId(botId);
    setForm(buildFormFromConfig(bot));
  }

  const isBusy = saveMutation.isPending || lifecycleMutation.isPending || killSwitchMutation.isPending || deleteMutation.isPending;

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Gem className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Pepperstone Metals &amp; Energy</h1>
                  <p className="text-sm text-muted-foreground">
                    Gold, Silver, Platinum, and Crude Oil CFD basket trading via Pepperstone, with MTF/V3 confirmation
                    and portfolio-aware risk limits.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Pepperstone only</Badge>
                <Badge variant="secondary">Equal-lot basket model</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { basketsQuery.refetch(); eventsQuery.refetch(); }} disabled={!selectedBotId}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                New metals/energy bot
              </Button>
            </div>
          </div>
        </div>

        {!workspaceId ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Select a workspace first.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Bot list</CardTitle>
                  <Badge variant="outline">{bots.length} bots</Badge>
                </div>
                <Button type="button" variant="secondary" onClick={handleCreateNew}>
                  Configure new bot
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {botsLoading ? <div className="text-sm text-muted-foreground">Loading bots...</div> : null}
                {!botsLoading && bots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                    No Pepperstone bots yet. Create one to get started.
                  </div>
                ) : null}
                <div className="max-h-[68vh] space-y-3 overflow-auto pr-1">
                  {bots.map((bot) => (
                    <BotListCard
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
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold">
                          {isCreating ? "Create metals/energy bot" : selectedBot?.instrument?.name || "Select a bot"}
                        </h2>
                        {!isCreating && selectedBot ? <StatusBadge status={selectedBot.state?.status ?? "idle"} /> : null}
                      </div>
                      {!isCreating && selectedBot?.state?.block_reason_detail ? (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" style={{ color: STATUS_META.blocked.color }} />
                          {selectedBot.state.block_reason_detail}
                        </p>
                      ) : null}
                    </div>

                    {!isCreating && selectedBot ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "start" })}
                          disabled={isBusy}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "pause" })}
                          disabled={isBusy}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "stop" })}
                          disabled={isBusy}
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => killSwitchMutation.mutate(selectedBot.id)}
                          disabled={isBusy}
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          Kill switch
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            if (window.confirm("Delete this bot? This removes its config, baskets, and events.")) {
                              deleteMutation.mutate(selectedBot.id);
                            }
                          }}
                          disabled={isBusy}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {!isCreating && selectedBot ? (
                    <div className="space-y-3">
                      <ExposureGauge
                        label="Exposure vs. per-bot cap"
                        total={toNumber(selectedBot.state?.total_exposure_lots)}
                        max={toNumber(selectedBot.max_total_exposure_lots)}
                      />
                      <ExposureGauge
                        label="Exposure vs. portfolio-wide cap"
                        total={toNumber(selectedBot.state?.total_exposure_lots)}
                        max={toNumber(selectedBot.portfolio_exposure_cap_lots)}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {isCreating || selectedBot ? (
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="config">Config</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-6">
                    {!isCreating && selectedBot ? (
                      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <BasketPanel basket={basketsQuery.isLoading ? null : currentBasket} />
                        <ConfirmationPanel basket={currentBasket} config={selectedBot} />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                        Fill out the config tab and save to create this bot, then overview data will appear here.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="config" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Instrument &amp; connection</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Instrument" hint="Gold, Silver, Platinum, or Crude Oil.">
                            <Select
                              value={form.instrument_id || "none"}
                              onValueChange={(value) => setForm((current) => ({ ...current, instrument_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Select an instrument</SelectItem>
                                {instruments.map((instrument) => (
                                  <SelectItem key={instrument.id} value={instrument.id}>
                                    {instrument.name} ({instrument.canonical_symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field
                            label="Pepperstone connection"
                            hint="No real Pepperstone ExchangeConnection rows can exist yet (Phase 0 pending). Leave unset to run against PepperstoneBrokerAdapter's sandbox mode -- safe, fake fills, no real money."
                          >
                            <Select
                              value={form.connection_id}
                              onValueChange={(value) => setForm((current) => ({ ...current, connection_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (sandbox mode)</SelectItem>
                                {pepperstoneConnections.map((connection) => (
                                  <SelectItem key={connection.id} value={connection.id}>
                                    {connection.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Sizing &amp; caps</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-3">
                          <Field label="Lot per level" hint="Equal-lot basket -- every level opens with this exact lot size.">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.lot_per_level}
                              onChange={(event) => setForm((current) => ({ ...current, lot_per_level: event.target.value }))}
                            />
                          </Field>
                          <Field label="Max basket levels" hint="Optional -- defaults to 8 if left blank.">
                            <Input
                              type="number"
                              step="1"
                              min={1}
                              max={200}
                              value={form.max_basket_levels}
                              onChange={(event) => setForm((current) => ({ ...current, max_basket_levels: event.target.value }))}
                            />
                          </Field>
                          <Field label="Max position (lots)" hint="Hard cap on this bot's single-basket lot exposure.">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.max_position_lots}
                              onChange={(event) => setForm((current) => ({ ...current, max_position_lots: event.target.value }))}
                            />
                          </Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Max total exposure (lots)" hint="Per-bot cap on total open lots across this basket.">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.max_total_exposure_lots}
                              onChange={(event) => setForm((current) => ({ ...current, max_total_exposure_lots: event.target.value }))}
                            />
                          </Field>
                          <Field label="Portfolio exposure cap (lots)" hint="Optional -- portfolio-wide cap enforced by PortfolioRiskEngine across all bots, not just this one.">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.portfolio_exposure_cap_lots}
                              onChange={(event) => setForm((current) => ({ ...current, portfolio_exposure_cap_lots: event.target.value }))}
                            />
                          </Field>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Thresholds</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Min V3 confidence" hint="0-1 scale. The composite V3 score must clear this before a basket opens.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={1}
                              value={form.v3_confidence_threshold}
                              onChange={(event) => setForm((current) => ({ ...current, v3_confidence_threshold: event.target.value }))}
                            />
                          </Field>
                          <Field label="Min MTF confidence" hint="0-1 scale. Multi-timeframe agreement must clear this before a basket opens.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={1}
                              value={form.min_mtf_confidence}
                              onChange={(event) => setForm((current) => ({ ...current, min_mtf_confidence: event.target.value }))}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Spread limit (pips)" hint="Optional -- basket entries are skipped while spread exceeds this.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.spread_limit_pips}
                              onChange={(event) => setForm((current) => ({ ...current, spread_limit_pips: event.target.value }))}
                            />
                          </Field>
                          <Field label="Slippage limit (pips)" hint="Optional -- orders are rejected if expected slippage exceeds this.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.slippage_limit_pips}
                              onChange={(event) => setForm((current) => ({ ...current, slippage_limit_pips: event.target.value }))}
                            />
                          </Field>
                        </div>
                        <Field label="Maximum allowed slippage" hint="Optional -- absolute slippage guard used by RiskEngine, distinct from the pip-based limit above.">
                          <Input
                            type="number"
                            step="0.0001"
                            min={0}
                            value={form.maximum_allowed_slippage}
                            onChange={(event) => setForm((current) => ({ ...current, maximum_allowed_slippage: event.target.value }))}
                          />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Risk limits</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Daily loss limit %" hint="Optional -- bot pauses for the day once realized loss crosses this percent.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              max={100}
                              value={form.daily_loss_limit_pct}
                              onChange={(event) => setForm((current) => ({ ...current, daily_loss_limit_pct: event.target.value }))}
                            />
                          </Field>
                          <Field label="Margin safety reserve floor" hint="Optional -- minimum free margin PositionSizingService must keep in reserve before sizing a new level.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={form.margin_safety_reserve_floor}
                              onChange={(event) => setForm((current) => ({ ...current, margin_safety_reserve_floor: event.target.value }))}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Basket take profit %" hint="Optional -- leave blank for no basket-level TP.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.basket_take_profit_pct}
                              onChange={(event) => setForm((current) => ({ ...current, basket_take_profit_pct: event.target.value }))}
                            />
                          </Field>
                          <Field label="Basket stop loss %" hint="Required -- always enforced by BasketExitEngine.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.basket_stop_loss_pct}
                              onChange={(event) => setForm((current) => ({ ...current, basket_stop_loss_pct: event.target.value }))}
                            />
                          </Field>
                        </div>

                        {formError ? (
                          <p className="flex items-center gap-1.5 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            {formError}
                          </p>
                        ) : null}

                        <Button
                          type="button"
                          onClick={() => saveMutation.mutate()}
                          disabled={!workspaceId || !!formError || saveMutation.isPending}
                        >
                          {isCreating ? "Create bot" : "Save changes"}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="events">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {eventsQuery.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading events...</div>
                        ) : (
                          <EventsFeed events={events} />
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
