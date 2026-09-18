import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Grid3x3,
  ListChecks,
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnections } from "@/hooks/useConnections";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types -- mirror ForexGridBotController exactly (app/Http/Controllers/Api/
// ForexGridBotController.php). Do not import from the legacy Supabase types
// module -- this domain never existed there.
// ---------------------------------------------------------------------------

type PositionSizingMode = "fixed" | "martingale" | "hybrid";
type DirectionMode = "both" | "buy_only" | "sell_only";
type BotStatus = "idle" | "running" | "paused" | "blocked" | "stopped";
type LevelSide = "buy" | "sell";
type LevelStatus = "pending" | "filled" | "closed" | "cancelled";

interface ForexGridBotState {
  status: BotStatus;
  block_reason_code: string | null;
  block_reason_detail: string | null;
  active_levels_count: number;
  total_exposure_lots: string;
  basket_avg_price: string | null;
  last_evaluated_at: string | null;
}

interface ForexGridBotConfig {
  id: string;
  workspace_id: string;
  provider: "oanda";
  connection_id: string | null;
  symbol: string;
  enabled: boolean;
  grid_spacing_pips: string;
  position_sizing_mode: PositionSizingMode;
  base_lot_size: string;
  martingale_multiplier: string | null;
  martingale_max_lot_size: string | null;
  hybrid_martingale_level_count: number | null;
  max_grid_levels: number;
  max_total_exposure_lots: string;
  direction_mode: DirectionMode;
  basket_take_profit_pct: string | null;
  basket_stop_loss_pct: string;
  created_at: string;
  updated_at: string;
  state: ForexGridBotState | null;
}

interface ForexGridBotLevel {
  id: string;
  level_index: number;
  side: LevelSide;
  entry_price: string;
  lot_size: string;
  order_id: string | null;
  status: LevelStatus;
  opened_at: string | null;
  closed_at: string | null;
  realized_pnl: string | null;
}

interface ForexGridBotEvent {
  id: string;
  event_type: string;
  context_json: Record<string, unknown> | null;
  created_at: string;
}

const EMPTY_BOTS: ForexGridBotConfig[] = [];
const EMPTY_LEVELS: ForexGridBotLevel[] = [];
const EMPTY_EVENTS: ForexGridBotEvent[] = [];

// ---------------------------------------------------------------------------
// Fixed dataviz palette -- validated values, do not invent new colors here.
// good/warning/serious/critical are identical in light and dark mode; buy,
// sell, and the delta-up-good token differ by mode so both are encoded as
// Tailwind arbitrary-value classes with a dark: override.
// ---------------------------------------------------------------------------

const STATUS_META: Record<BotStatus, { label: string; color: string; Icon: typeof Play }> = {
  running: { label: "Running", color: "#0ca30c", Icon: Play },
  paused: { label: "Paused", color: "#fab219", Icon: Pause },
  blocked: { label: "Blocked", color: "#ec835a", Icon: ShieldAlert },
  stopped: { label: "Stopped", color: "#d03b3b", Icon: Square },
  idle: { label: "Idle", color: "#94a3b8", Icon: Activity },
};

const BUY_TEXT = "text-[#2a78d6] dark:text-[#3987e5]";
const BUY_BG = "bg-[#2a78d6] dark:bg-[#3987e5]";
const BUY_BORDER = "border-[#2a78d6] dark:border-[#3987e5]";
const SELL_TEXT = "text-[#e34948] dark:text-[#e66767]";
const SELL_BG = "bg-[#e34948] dark:bg-[#e66767]";
const SELL_BORDER = "border-[#e34948] dark:border-[#e66767]";
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

function summarizeEventContext(event: ForexGridBotEvent): string {
  const ctx = event.context_json || {};
  switch (event.event_type) {
    case "level_opened":
      return `Level ${ctx.level_index ?? "?"} opened (${String(ctx.side ?? "").toUpperCase()} @ ${formatNumber(ctx.entry_price as string, 5)})`;
    case "level_closed":
      return `Level ${ctx.level_index ?? "?"} closed${ctx.realized_pnl != null ? `, P&L ${formatNumber(ctx.realized_pnl as string, 2)}` : ""}`;
    case "basket_closed":
      return `Basket closed${ctx.reason ? ` (${prettyLabel(String(ctx.reason))})` : ""}${ctx.realized_pnl != null ? `, P&L ${formatNumber(ctx.realized_pnl as string, 2)}` : ""}`;
    case "blocked":
      return String(ctx.reason_detail || ctx.reason_code || "Bot blocked.");
    case "grid_cap_exceeded":
      return `Grid cap exceeded (max ${ctx.max_grid_levels ?? ctx.cap ?? "?"} levels)`;
    case "level_open_failed":
      return `Level open failed${ctx.reason ? `: ${String(ctx.reason)}` : ""}`;
    case "kill_switch":
      return String(ctx.reason || "Kill switch activated.");
    default:
      return Object.keys(ctx).length > 0 ? JSON.stringify(ctx) : "No additional detail.";
  }
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

type BotForm = {
  symbol: string;
  connection_id: string;
  enabled: boolean;
  grid_spacing_pips: string;
  position_sizing_mode: PositionSizingMode;
  base_lot_size: string;
  martingale_multiplier: string;
  martingale_max_lot_size: string;
  hybrid_martingale_level_count: string;
  max_grid_levels: string;
  max_total_exposure_lots: string;
  direction_mode: DirectionMode;
  basket_take_profit_pct: string;
  basket_stop_loss_pct: string;
};

const INITIAL_FORM: BotForm = {
  symbol: "EUR_USD",
  connection_id: "none",
  enabled: false,
  grid_spacing_pips: "10",
  position_sizing_mode: "fixed",
  base_lot_size: "0.01",
  martingale_multiplier: "1.5",
  martingale_max_lot_size: "0.1",
  hybrid_martingale_level_count: "3",
  max_grid_levels: "10",
  max_total_exposure_lots: "1",
  direction_mode: "both",
  basket_take_profit_pct: "",
  basket_stop_loss_pct: "5",
};

function buildFormFromConfig(config: ForexGridBotConfig): BotForm {
  return {
    symbol: config.symbol,
    connection_id: config.connection_id || "none",
    enabled: config.enabled,
    grid_spacing_pips: String(config.grid_spacing_pips ?? ""),
    position_sizing_mode: config.position_sizing_mode,
    base_lot_size: String(config.base_lot_size ?? ""),
    martingale_multiplier: config.martingale_multiplier != null ? String(config.martingale_multiplier) : "",
    martingale_max_lot_size: config.martingale_max_lot_size != null ? String(config.martingale_max_lot_size) : "",
    hybrid_martingale_level_count: config.hybrid_martingale_level_count != null ? String(config.hybrid_martingale_level_count) : "",
    max_grid_levels: String(config.max_grid_levels ?? ""),
    max_total_exposure_lots: String(config.max_total_exposure_lots ?? ""),
    direction_mode: config.direction_mode,
    basket_take_profit_pct: config.basket_take_profit_pct != null ? String(config.basket_take_profit_pct) : "",
    basket_stop_loss_pct: String(config.basket_stop_loss_pct ?? ""),
  };
}

function validateForm(form: BotForm): string | null {
  if (!form.symbol.trim()) return "Symbol is required.";
  if (form.connection_id === "none" || !form.connection_id) return "Select an OANDA connection.";
  if (!form.grid_spacing_pips.trim()) return "Grid spacing (pips) is required.";
  if (!form.base_lot_size.trim()) return "Base lot size is required.";
  if (!form.max_grid_levels.trim()) return "Max grid levels is required.";
  if (!form.max_total_exposure_lots.trim()) return "Max total exposure (lots) is required.";
  if (!form.basket_stop_loss_pct.trim()) return "Basket stop loss % is required.";

  if (form.position_sizing_mode === "martingale" || form.position_sizing_mode === "hybrid") {
    if (!form.martingale_multiplier.trim()) return "Martingale multiplier is required for martingale/hybrid sizing.";
    if (!form.martingale_max_lot_size.trim()) return "Martingale max lot size is required for martingale/hybrid sizing.";
  }

  if (form.position_sizing_mode === "hybrid") {
    if (!form.hybrid_martingale_level_count.trim()) return "Hybrid martingale level count is required for hybrid sizing.";
    const levelCount = Number(form.hybrid_martingale_level_count);
    const maxLevels = Number(form.max_grid_levels);
    if (Number.isFinite(levelCount) && Number.isFinite(maxLevels) && levelCount > maxLevels) {
      return "Hybrid martingale level count cannot exceed max grid levels.";
    }
  }

  return null;
}

function buildPayload(form: BotForm) {
  const isMartingaleFamily = form.position_sizing_mode === "martingale" || form.position_sizing_mode === "hybrid";
  return {
    provider: "oanda",
    connection_id: form.connection_id === "none" ? null : form.connection_id,
    symbol: form.symbol.trim().toUpperCase(),
    grid_spacing_pips: form.grid_spacing_pips,
    position_sizing_mode: form.position_sizing_mode,
    base_lot_size: form.base_lot_size,
    martingale_multiplier: isMartingaleFamily ? (form.martingale_multiplier || null) : null,
    martingale_max_lot_size: isMartingaleFamily ? (form.martingale_max_lot_size || null) : null,
    hybrid_martingale_level_count:
      form.position_sizing_mode === "hybrid" && form.hybrid_martingale_level_count
        ? Number(form.hybrid_martingale_level_count)
        : null,
    max_grid_levels: form.max_grid_levels ? Number(form.max_grid_levels) : null,
    max_total_exposure_lots: form.max_total_exposure_lots,
    direction_mode: form.direction_mode,
    basket_take_profit_pct: form.basket_take_profit_pct.trim() === "" ? null : form.basket_take_profit_pct,
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
// Exposure gauge -- sequential blue ramp (magnitude toward a bound), swaps to
// the status warning/critical color past 80%/95% of the cap. One ramp, one
// threshold swap -- never a rainbow.
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

function ExposureGauge({ total, max }: { total: number | null; max: number | null }) {
  const fraction = total !== null && max !== null && max > 0 ? Math.min(1, total / max) : 0;
  let barColor = exposureRampColor(fraction);
  let stateLabel = "Within cap";
  if (fraction >= 0.95) {
    barColor = STATUS_META.stopped.color;
    stateLabel = "At cap";
  } else if (fraction >= 0.8) {
    barColor = STATUS_META.paused.color;
    stateLabel = "Approaching cap";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Exposure vs. cap</span>
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
// Grid level ladder + table fallback
// ---------------------------------------------------------------------------

function levelMarkClasses(side: LevelSide, status: LevelStatus): string {
  const border = side === "buy" ? BUY_BORDER : SELL_BORDER;
  const fill = side === "buy" ? BUY_BG : SELL_BG;

  if (status === "filled") return cn("border-2", border, fill);
  if (status === "pending") return cn("border-2 border-dashed bg-transparent", border);
  if (status === "closed") return cn("border-2 opacity-40", border, fill);
  return cn("border-2 border-dotted opacity-30", border);
}

function GridLevelLadder({ levels }: { levels: ForexGridBotLevel[] }) {
  const sorted = useMemo(
    () => [...levels].sort((a, b) => Number(b.entry_price) - Number(a.entry_price)),
    [levels],
  );

  if (sorted.length === 0) {
    return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No grid levels yet.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2 w-6 rounded-full", BUY_BG)} />
          <TrendingUp className={cn("h-3.5 w-3.5", BUY_TEXT)} /> Buy
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2 w-6 rounded-full", SELL_BG)} />
          <TrendingDown className={cn("h-3.5 w-3.5", SELL_TEXT)} /> Sell
        </span>
        <span>Solid = filled &middot; dashed = pending &middot; faded = closed &middot; dotted = cancelled</span>
      </div>
      <div className="max-h-[420px] space-y-1.5 overflow-auto rounded-xl border border-border/70 p-3">
        {sorted.map((level) => (
          <Tooltip key={level.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5",
                  level.side === "sell" ? "justify-end" : "justify-start",
                )}
              >
                {level.side === "buy" ? (
                  <>
                    <span className="w-16 text-xs text-muted-foreground">{formatNumber(level.entry_price, 5)}</span>
                    <span className={cn("h-2 flex-1 max-w-[220px] rounded-full", levelMarkClasses(level.side, level.status))} />
                  </>
                ) : (
                  <>
                    <span className={cn("h-2 flex-1 max-w-[220px] rounded-full", levelMarkClasses(level.side, level.status))} />
                    <span className="w-16 text-right text-xs text-muted-foreground">{formatNumber(level.entry_price, 5)}</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <div className="font-semibold">
                  Level {level.level_index} &middot; {level.side.toUpperCase()} &middot; {prettyLabel(level.status)}
                </div>
                <div>Entry price: {formatNumber(level.entry_price, 5)}</div>
                <div>Lot size: {formatNumber(level.lot_size, 4)}</div>
                <div>Opened: {formatDateTime(level.opened_at)}</div>
                {level.status === "closed" ? (
                  <>
                    <div>Closed: {formatDateTime(level.closed_at)}</div>
                    <div>Realized P&amp;L: {level.realized_pnl != null ? formatNumber(level.realized_pnl, 2) : "None"}</div>
                  </>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function LevelsTable({ levels }: { levels: ForexGridBotLevel[] }) {
  if (levels.length === 0) {
    return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No grid levels yet.</div>;
  }

  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Entry price</TableHead>
            <TableHead>Lot size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Opened</TableHead>
            <TableHead>Closed</TableHead>
            <TableHead>Realized P&amp;L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.map((level) => (
            <TableRow key={level.id}>
              <TableCell>{level.level_index}</TableCell>
              <TableCell className={level.side === "buy" ? BUY_TEXT : SELL_TEXT}>{level.side.toUpperCase()}</TableCell>
              <TableCell>{formatNumber(level.entry_price, 5)}</TableCell>
              <TableCell>{formatNumber(level.lot_size, 4)}</TableCell>
              <TableCell>{prettyLabel(level.status)}</TableCell>
              <TableCell>{formatDateTime(level.opened_at)}</TableCell>
              <TableCell>{formatDateTime(level.closed_at)}</TableCell>
              <TableCell>{level.realized_pnl != null ? formatNumber(level.realized_pnl, 2) : "None"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basket summary -- only shows real backend-sourced figures. No fabricated
// live price / floating P&L: the backend does not expose a live price feed
// for this module today. Realized P&L is real (sum of closed levels'
// realized_pnl from GET /levels), so it is the only P&L figure shown.
// ---------------------------------------------------------------------------

function BasketSummaryCard({ state, levels }: { state: ForexGridBotState | null; levels: ForexGridBotLevel[] }) {
  const realizedPnl = useMemo(() => {
    const closed = levels.filter((level) => level.status === "closed" && level.realized_pnl != null);
    if (closed.length === 0) return null;
    return closed.reduce((sum, level) => sum + (toNumber(level.realized_pnl) ?? 0), 0);
  }, [levels]);

  const isPositive = realizedPnl !== null && realizedPnl >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Basket summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground">Realized P&amp;L (closed levels)</div>
          <div className={cn("text-3xl font-bold", realizedPnl === null ? "text-foreground" : isPositive ? DELTA_UP_TEXT : DELTA_DOWN_TEXT)}>
            {realizedPnl === null ? "None yet" : formatNumber(realizedPnl, 2)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Basket avg. price</div>
            <div className="font-medium">{formatNumber(state?.basket_avg_price, 5)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total exposure</div>
            <div className="font-medium">{formatNumber(state?.total_exposure_lots, 2)} lots</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          No live price feed is exposed by this module yet, so a floating (unrealized) P&amp;L figure is intentionally
          not shown here -- only real, backend-sourced numbers are displayed.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bot list card -- mirrors RatioBotPage's own BotCard / RobotTradingPage's
// session-card pattern for a multi-bot listing.
// ---------------------------------------------------------------------------

function BotListCard({ bot, selected, onClick }: { bot: ForexGridBotConfig; selected: boolean; onClick: () => void }) {
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
          <div className="font-semibold">{bot.symbol}</div>
          <div className="text-xs text-muted-foreground">
            OANDA &middot; {prettyLabel(bot.position_sizing_mode)} sizing &middot; {prettyLabel(bot.direction_mode)}
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
// Events feed
// ---------------------------------------------------------------------------

function EventsFeed({ events }: { events: ForexGridBotEvent[] }) {
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
    queryClient.invalidateQueries({ queryKey: ["forex-grid-bots", workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ["forex-grid-bot-levels", botId] }),
    queryClient.invalidateQueries({ queryKey: ["forex-grid-bot-events", botId] }),
  ]);
}

export default function ForexGridBotPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [] } = useConnections(workspaceId);
  const oandaConnections = useMemo(() => connections.filter((connection) => connection.provider === "oanda"), [connections]);

  const { data: bots = EMPTY_BOTS, isLoading: botsLoading } = useQuery({
    queryKey: ["forex-grid-bots", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as ForexGridBotConfig[];
      const response = await api.get<ForexGridBotConfig[]>(`/workspaces/${workspaceId}/forex-grid-bots`);
      return response.data ?? [];
    },
    enabled: !!workspaceId,
  });

  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<BotForm>(INITIAL_FORM);
  const [ladderView, setLadderView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    if (!selectedBotId && !isCreating && bots.length > 0) {
      setSelectedBotId(bots[0].id);
      setForm(buildFormFromConfig(bots[0]));
    }
  }, [bots, isCreating, selectedBotId]);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) || null, [bots, selectedBotId]);

  const levelsQuery = useQuery({
    queryKey: ["forex-grid-bot-levels", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as ForexGridBotLevel[];
      const response = await api.get<ForexGridBotLevel[]>(`/forex-grid-bots/${selectedBotId}/levels`);
      return response.data ?? [];
    },
    enabled: !!selectedBotId,
  });
  const levels = levelsQuery.data ?? EMPTY_LEVELS;

  const eventsQuery = useQuery({
    queryKey: ["forex-grid-bot-events", selectedBotId],
    queryFn: async () => {
      if (!selectedBotId) return [] as ForexGridBotEvent[];
      const response = await api.get<ForexGridBotEvent[]>(`/forex-grid-bots/${selectedBotId}/events`);
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
        const response = await api.post<ForexGridBotConfig>(`/workspaces/${workspaceId}/forex-grid-bots`, payload);
        return response.data;
      }
      if (!selectedBotId) throw new Error("Select a bot first.");
      const response = await api.put<ForexGridBotConfig>(`/forex-grid-bots/${selectedBotId}`, payload);
      return response.data;
    },
    onSuccess: async (savedBot) => {
      toast({ title: isCreating ? "Bot created" : "Bot updated", description: `${savedBot.symbol} configuration saved.` });
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
      const response = await api.post<{ message?: string }>(`/forex-grid-bots/${botId}/${action}`, {});
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
      const response = await api.post<{ message?: string }>(`/forex-grid-bots/${botId}/kill-switch`, {
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
      await api.delete(`/forex-grid-bots/${botId}`);
      return { botId };
    },
    onSuccess: async ({ botId }) => {
      toast({ title: "Bot deleted", description: "Config, levels, events, and state were all removed." });
      setSelectedBotId(null);
      setIsCreating(false);
      queryClient.removeQueries({ queryKey: ["forex-grid-bot-levels", botId] });
      queryClient.removeQueries({ queryKey: ["forex-grid-bot-events", botId] });
      await queryClient.invalidateQueries({ queryKey: ["forex-grid-bots", workspaceId] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  function handleCreateNew() {
    setIsCreating(true);
    setSelectedBotId(null);
    setForm(INITIAL_FORM);
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
                <Grid3x3 className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Forex Grid Trading</h1>
                  <p className="text-sm text-muted-foreground">
                    Grid ladder trading for forex/metals via OANDA, with fixed/martingale/hybrid position sizing.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">OANDA only</Badge>
                <Badge variant="secondary">One bot = one symbol</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { levelsQuery.refetch(); eventsQuery.refetch(); }} disabled={!selectedBotId}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                New grid bot
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
                    No forex grid bots yet. Create one to get started.
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
                          {isCreating ? "Create grid bot" : selectedBot?.symbol || "Select a bot"}
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
                          className="h-11 sm:h-8"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "start" })}
                          disabled={isBusy}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 sm:h-8"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "pause" })}
                          disabled={isBusy}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 sm:h-8"
                          onClick={() => lifecycleMutation.mutate({ botId: selectedBot.id, action: "stop" })}
                          disabled={isBusy}
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-11 sm:h-8"
                          onClick={() => killSwitchMutation.mutate(selectedBot.id)}
                          disabled={isBusy}
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          Kill switch
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 sm:h-8 text-destructive"
                          onClick={() => {
                            if (window.confirm("Delete this grid bot? This removes its config, levels, and events.")) {
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
                    <ExposureGauge
                      total={toNumber(selectedBot.state?.total_exposure_lots)}
                      max={toNumber(selectedBot.max_total_exposure_lots)}
                    />
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
                        <Card>
                          <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <CardTitle className="text-base">Grid level ladder</CardTitle>
                              <div className="flex gap-1 rounded-lg border border-border/70 p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={ladderView === "chart" ? "default" : "ghost"}
                                  onClick={() => setLadderView("chart")}
                                >
                                  <Grid3x3 className="mr-1.5 h-3.5 w-3.5" />
                                  Ladder
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={ladderView === "table" ? "default" : "ghost"}
                                  onClick={() => setLadderView("table")}
                                >
                                  <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                                  Table
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {levelsQuery.isLoading ? (
                              <div className="text-sm text-muted-foreground">Loading levels...</div>
                            ) : ladderView === "chart" ? (
                              <GridLevelLadder levels={levels} />
                            ) : (
                              <LevelsTable levels={levels} />
                            )}
                          </CardContent>
                        </Card>

                        <BasketSummaryCard state={selectedBot.state} levels={levels} />
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
                        <CardTitle className="text-base">Grid configuration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Symbol" hint="OANDA instrument, e.g. EUR_USD, XAU_USD.">
                            <Input
                              value={form.symbol}
                              onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
                            />
                          </Field>
                          <Field label="OANDA connection">
                            <Select
                              value={form.connection_id}
                              onValueChange={(value) => setForm((current) => ({ ...current, connection_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Select a connection</SelectItem>
                                {oandaConnections.map((connection) => (
                                  <SelectItem key={connection.id} value={connection.id}>
                                    {connection.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Field label="Grid spacing (pips)">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.grid_spacing_pips}
                              onChange={(event) => setForm((current) => ({ ...current, grid_spacing_pips: event.target.value }))}
                            />
                          </Field>
                          <Field label="Base lot size">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.base_lot_size}
                              onChange={(event) => setForm((current) => ({ ...current, base_lot_size: event.target.value }))}
                            />
                          </Field>
                          <Field label="Max grid levels">
                            <Input
                              type="number"
                              step="1"
                              min={1}
                              max={200}
                              value={form.max_grid_levels}
                              onChange={(event) => setForm((current) => ({ ...current, max_grid_levels: event.target.value }))}
                            />
                          </Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Direction mode">
                            <Select
                              value={form.direction_mode}
                              onValueChange={(value: DirectionMode) => setForm((current) => ({ ...current, direction_mode: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="both">Both</SelectItem>
                                <SelectItem value="buy_only">Buy only</SelectItem>
                                <SelectItem value="sell_only">Sell only</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Max total exposure (lots)">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0.0001}
                              value={form.max_total_exposure_lots}
                              onChange={(event) => setForm((current) => ({ ...current, max_total_exposure_lots: event.target.value }))}
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
                          <Field label="Basket stop loss %" hint="Required -- always enforced, even though the column allows null.">
                            <Input
                              type="number"
                              step="0.01"
                              min={0.01}
                              value={form.basket_stop_loss_pct}
                              onChange={(event) => setForm((current) => ({ ...current, basket_stop_loss_pct: event.target.value }))}
                            />
                          </Field>
                        </div>

                        <Field label="Position sizing mode">
                          <Select
                            value={form.position_sizing_mode}
                            onValueChange={(value: PositionSizingMode) =>
                              setForm((current) => ({ ...current, position_sizing_mode: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed</SelectItem>
                              <SelectItem value="martingale">Martingale</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>

                        {form.position_sizing_mode === "martingale" || form.position_sizing_mode === "hybrid" ? (
                          <div className="grid gap-4 rounded-xl border border-border/70 p-4 md:grid-cols-2">
                            <Field label="Martingale multiplier">
                              <Input
                                type="number"
                                step="0.0001"
                                min={1.0001}
                                max={100}
                                value={form.martingale_multiplier}
                                onChange={(event) => setForm((current) => ({ ...current, martingale_multiplier: event.target.value }))}
                              />
                            </Field>
                            <Field label="Martingale max lot size">
                              <Input
                                type="number"
                                step="0.0001"
                                min={0.0001}
                                value={form.martingale_max_lot_size}
                                onChange={(event) => setForm((current) => ({ ...current, martingale_max_lot_size: event.target.value }))}
                              />
                            </Field>
                            {form.position_sizing_mode === "hybrid" ? (
                              <Field label="Hybrid martingale level count" hint="Must be <= max grid levels.">
                                <Input
                                  type="number"
                                  step="1"
                                  min={1}
                                  max={100}
                                  value={form.hybrid_martingale_level_count}
                                  onChange={(event) =>
                                    setForm((current) => ({ ...current, hybrid_martingale_level_count: event.target.value }))
                                  }
                                />
                              </Field>
                            ) : null}
                          </div>
                        ) : null}

                        <Field label="Enabled" hint="Toggling here alone does not start evaluation -- use Start/Pause/Stop above once the bot exists.">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={form.enabled}
                              onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
                              disabled={isCreating}
                            />
                            <span className="text-sm text-muted-foreground">{form.enabled ? "Enabled" : "Disabled"}</span>
                          </div>
                        </Field>

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
