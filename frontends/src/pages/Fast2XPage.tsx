import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { AlertTriangle, Bot, Brain, Gauge, Pause, Play, RotateCcw, Save, ShieldAlert, Square, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useFast2X, type Fast2XChartPayload, type Fast2XSettings } from "@/hooks/useFast2X";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const EMPTY_SETTINGS: Fast2XSettings = {
  symbol: "BTCUSDT",
  tradeMode: "SPOT",
  botMode: "FAST2X",
  paperTrading: true,
  tradeAmountType: "PERCENTAGE",
  tradeAmountValue: 10,
  minProfitTargetPercent: 0.2,
  rollbackLossPercent: 0.15,
  manualSellThresholdPercent: 0.5,
  manualBuyThresholdPercent: 0.5,
  useDynamicThreshold: true,
  useIndicators: true,
  useStopLoss: true,
  useTrailingTakeProfit: true,
  stopLossPercent: 0.4,
  trailingTakeProfitPercent: 0.25,
  maxAllowedSlippagePercent: 0.15,
  minimumProfitAfterFeesPercent: 0.1,
  cooldownSeconds: 3,
  maxTradesPerMinute: 5,
  maxTradesPerDay: 50,
  maxDailyLossPercent: 3,
  maxApiLatencyMs: 500,
  emergencyStop: false,
};

function n(value: unknown, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "None";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function dt(value?: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusVariant(value?: string) {
  const normalized = (value || "").toLowerCase();
  if (["running", "connected", "in_position", "profit_lock"].includes(normalized)) return "default";
  if (["paused", "cooldown", "waiting_for_signal"].includes(normalized)) return "secondary";
  if (["error", "stopped", "disconnected", "loss_rollback"].includes(normalized)) return "destructive";
  return "outline";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function Fast2XPage() {
  const { currentWorkspace, loading } = useWorkspace();
  const fast2x = useFast2X(currentWorkspace?.id);
  const { toast } = useToast();
  const [settings, setSettings] = useState<Fast2XSettings>(EMPTY_SETTINGS);
  const [aiBrainEnabled, setAiBrainEnabled] = useState(false);
  const [algorithmMarkdown, setAlgorithmMarkdown] = useState("");

  useEffect(() => {
    if (fast2x.config.data?.settings) {
      setSettings({ ...EMPTY_SETTINGS, ...fast2x.config.data.settings, paperTrading: true });
      setAiBrainEnabled(!!fast2x.config.data.ai_brain_enabled);
      setAlgorithmMarkdown(fast2x.config.data.algorithm_markdown || "");
    }
  }, [fast2x.config.data]);

  const chartData = useMemo(() => {
    const livePoints = fast2x.chart.data?.points ?? [];
    if (livePoints.length > 0) return livePoints;
    const live = fast2x.price.data?.currentPrice || fast2x.pnl.data?.currentPrice || 0;
    return live > 0 ? [{ index: 0, time: "Live", price: live }] : [];
  }, [fast2x.chart.data, fast2x.price.data, fast2x.pnl.data]);

  const busy = fast2x.start.isPending || fast2x.pause.isPending || fast2x.stop.isPending || fast2x.emergencyStop.isPending || fast2x.resetPaper.isPending || fast2x.updateConfig.isPending;

  const save = () => {
    fast2x.updateConfig.mutate(
      {
        settings: { ...settings, paperTrading: true },
        ai_brain_enabled: aiBrainEnabled,
        algorithm_markdown: algorithmMarkdown,
        enable_live_trading: false,
      },
      {
        onSuccess: () => toast({ title: "Fast2X config saved", description: "Paper trading remains enabled by default." }),
        onError: (error) => toast({ title: "Save failed", description: error instanceof Error ? error.message : "Could not save config", variant: "destructive" }),
      }
    );
  };

  if (loading || !currentWorkspace) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Loading workspace...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Fast2X</h1>
                <p className="text-sm text-muted-foreground">Real-time micro scalping engine for Binance Spot. Paper trading is locked on by default.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(fast2x.status.data?.status)}>{fast2x.status.data?.status || "Stopped"}</Badge>
            <Badge variant="secondary">{fast2x.status.data?.mode || "Paper Trading"}</Badge>
            {aiBrainEnabled ? <Badge variant="default">AI Brain On</Badge> : <Badge variant="outline">Normal Mode</Badge>}
          </div>
        </div>

        {!settings.paperTrading ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Live trading is blocked in this screen unless backend environment flags explicitly allow it.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <Fast2XStatusCard status={fast2x.status.data} />
          <Fast2XPriceCard price={fast2x.price.data} />
          <Fast2XPnLCard pnl={fast2x.pnl.data} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <Fast2XLiveChart data={chartData} pnl={fast2x.pnl.data} settings={settings} levels={fast2x.chart.data?.levels} />
            <Fast2XAutoManagementPanel auto={fast2x.chart.data?.autoManagement} pnl={fast2x.pnl.data} price={fast2x.price.data} />
            <Fast2XDecisionFeed logs={fast2x.logs.data ?? []} />
            <Fast2XTradeHistory trades={fast2x.trades.data ?? []} />
          </div>

          <div className="space-y-6">
            <Fast2XControlPanel
              busy={busy}
              onStart={() => fast2x.start.mutate(undefined, { onError: showError(toast) })}
              onPause={() => fast2x.pause.mutate(undefined, { onError: showError(toast) })}
              onStop={() => fast2x.stop.mutate(undefined, { onError: showError(toast) })}
              onEmergency={() => fast2x.emergencyStop.mutate(undefined, { onError: showError(toast) })}
              onReset={() => fast2x.resetPaper.mutate(undefined, { onError: showError(toast) })}
            />
            <Fast2XConfigPanel
              settings={settings}
              setSettings={setSettings}
              aiBrainEnabled={aiBrainEnabled}
              setAiBrainEnabled={setAiBrainEnabled}
              algorithmMarkdown={algorithmMarkdown}
              setAlgorithmMarkdown={setAlgorithmMarkdown}
              onSave={save}
              busy={busy}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function showError(toast: ReturnType<typeof useToast>["toast"]) {
  return (error: unknown) => toast({ title: "Fast2X action failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
}

function Fast2XStatusCard({ status }: { status?: ReturnType<typeof useFast2X>["status"]["data"] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> Bot Status</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Bot Status" value={status?.status || "Stopped"} badge />
        <Row label="Mode" value={status?.mode || "Paper Trading"} />
        <Row label="Exchange" value="Binance Spot" />
        <Row label="Symbol" value={status?.symbol || "BTCUSDT"} />
        <Row label="WebSocket" value={status?.webSocketStatus || "Disconnected"} badge />
        <Row label="Latency" value={`${status?.latencyMs ?? 0} ms`} />
        <Row label="Last Update" value={dt(status?.lastPriceUpdateTime)} />
      </CardContent>
    </Card>
  );
}

function Fast2XPriceCard({ price }: { price?: ReturnType<typeof useFast2X>["price"]["data"] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Live Price</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Current Price" value={n(price?.currentPrice, 8)} />
        <Row label="24h Change" value={`${n(price?.change24h, 2)}%`} />
        <Row label="Spread" value={n(price?.spread, 8)} />
        <Row label="Volume" value={n(price?.volume, 4)} />
        <Row label="Last Tick" value={dt(price?.lastTickTime)} />
      </CardContent>
    </Card>
  );
}

function Fast2XPnLCard({ pnl }: { pnl?: ReturnType<typeof useFast2X>["pnl"]["data"] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">PnL</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Entry Price" value={n(pnl?.entryPrice, 8)} />
        <Row label="Current Price" value={n(pnl?.currentPrice, 8)} />
        <Row label="Unrealized PnL" value={n(pnl?.unrealizedPnL, 8)} />
        <Row label="Realized PnL" value={n(pnl?.realizedPnL, 8)} />
        <Row label="Net PnL After Fees" value={`${n(pnl?.netPnLAfterFees, 8)} (${n(pnl?.netPnLPercent, 4)}%)`} />
        <Row label="Daily Profit" value={n(pnl?.dailyProfit, 8)} />
        <Row label="Daily Loss" value={n(pnl?.dailyLoss, 8)} />
        <Row label="Win Rate" value={`${n(pnl?.winRate, 2)}%`} />
        <Row label="Trade Count Today" value={n(pnl?.tradeCountToday, 0)} />
      </CardContent>
    </Card>
  );
}

function Fast2XControlPanel({ busy, onStart, onPause, onStop, onEmergency, onReset }: { busy: boolean; onStart: () => void; onPause: () => void; onStop: () => void; onEmergency: () => void; onReset: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Controls</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button disabled={busy} onClick={onStart}><Play className="mr-2 h-4 w-4" />Start Bot</Button>
        <Button disabled={busy} variant="secondary" onClick={onPause}><Pause className="mr-2 h-4 w-4" />Pause Bot</Button>
        <Button disabled={busy} variant="outline" onClick={onStop}><Square className="mr-2 h-4 w-4" />Stop Bot</Button>
        <Button disabled={busy} variant="destructive" onClick={onEmergency}><ShieldAlert className="mr-2 h-4 w-4" />Emergency</Button>
        <Button disabled={busy} variant="outline" className="col-span-2" onClick={onReset}><RotateCcw className="mr-2 h-4 w-4" />Reset Paper Trading</Button>
      </CardContent>
    </Card>
  );
}

function Fast2XConfigPanel(props: {
  settings: Fast2XSettings;
  setSettings: Dispatch<SetStateAction<Fast2XSettings>>;
  aiBrainEnabled: boolean;
  setAiBrainEnabled: (value: boolean) => void;
  algorithmMarkdown: string;
  setAlgorithmMarkdown: (value: string) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const update = (key: keyof Fast2XSettings, value: string | number | boolean) => props.setSettings((current) => ({ ...current, [key]: value }));
  const numericKeys: (keyof Fast2XSettings)[] = ["tradeAmountValue", "minProfitTargetPercent", "rollbackLossPercent", "manualSellThresholdPercent", "manualBuyThresholdPercent", "stopLossPercent", "trailingTakeProfitPercent", "maxAllowedSlippagePercent", "minimumProfitAfterFeesPercent", "cooldownSeconds", "maxTradesPerMinute", "maxTradesPerDay", "maxDailyLossPercent", "maxApiLatencyMs"];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Symbol"><Input value={props.settings.symbol} onChange={(e) => update("symbol", e.target.value.toUpperCase())} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {numericKeys.map((key) => (
            <Field key={String(key)} label={String(key)}>
              <Input type="number" step="0.01" value={Number(props.settings[key])} onChange={(e) => update(key, Number(e.target.value))} />
            </Field>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["useDynamicThreshold", "useIndicators", "useStopLoss", "useTrailingTakeProfit"] as (keyof Fast2XSettings)[]).map((key) => (
            <div key={String(key)} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{String(key)}</span>
              <Switch checked={Boolean(props.settings[key])} onCheckedChange={(value) => update(key, value)} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <span className="flex items-center gap-2 text-sm"><Brain className="h-4 w-4" />AI thinking brain</span>
          <Switch checked={props.aiBrainEnabled} onCheckedChange={props.setAiBrainEnabled} />
        </div>
        <Field label="Intelligent Algorithm Markdown">
          <Textarea className="min-h-[160px] font-mono text-xs" value={props.algorithmMarkdown} onChange={(event) => props.setAlgorithmMarkdown(event.target.value)} />
        </Field>
        <Button disabled={props.busy} onClick={props.onSave} className="w-full"><Save className="mr-2 h-4 w-4" />Save Fast2X Config</Button>
      </CardContent>
    </Card>
  );
}

function Fast2XDecisionFeed({ logs }: { logs: ReturnType<typeof useFast2X>["logs"]["data"] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Live Decision Feed</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(logs ?? []).slice(0, 12).map((log) => (
          <div key={log.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div><Badge variant={statusVariant(log.event)}>{log.event}</Badge><div className="mt-1 text-xs text-muted-foreground">{log.reason || `Price ${n(log.current_price, 6)} | PnL ${n(log.net_pnl_percent, 4)}%`}</div></div>
            <span className="shrink-0 text-xs text-muted-foreground">{dt(log.occurred_at)}</span>
          </div>
        ))}
        {(logs ?? []).length === 0 ? <div className="text-sm text-muted-foreground">WAITING_FOR_SIGNAL</div> : null}
      </CardContent>
    </Card>
  );
}

function Fast2XTradeHistory({ trades }: { trades: ReturnType<typeof useFast2X>["trades"]["data"] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Trade History</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>{["Time", "Symbol", "Side", "Entry Price", "Exit Price", "Quantity", "Gross PnL", "Fees", "Net PnL", "Reason", "Mode", "Status"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {(trades ?? []).map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>{dt(trade.created_at)}</TableCell><TableCell>{trade.symbol}</TableCell><TableCell><Badge>{trade.side}</Badge></TableCell><TableCell>{n(trade.entry_price, 8)}</TableCell><TableCell>{n(trade.exit_price, 8)}</TableCell><TableCell>{n(trade.quantity, 8)}</TableCell><TableCell>{n(trade.gross_pnl, 8)}</TableCell><TableCell>{n(trade.fees, 8)}</TableCell><TableCell>{n(trade.net_pnl, 8)}</TableCell><TableCell>{trade.reason}</TableCell><TableCell>{trade.mode}</TableCell><TableCell>{trade.status}</TableCell>
              </TableRow>
            ))}
            {(trades ?? []).length === 0 ? <TableRow><TableCell colSpan={12} className="text-center text-sm text-muted-foreground">No Fast2X trades yet.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Fast2XLiveChart({ data, pnl, settings, levels }: { data: Array<Record<string, number | string | null>>; pnl?: ReturnType<typeof useFast2X>["pnl"]["data"]; settings: Fast2XSettings; levels?: Record<string, number | null> }) {
  const entry = levels?.entry || pnl?.entryPrice || 0;
  const stop = levels?.stopLoss || (entry ? entry * (1 - settings.stopLossPercent / 100) : 0);
  const target = levels?.profitTarget || (entry ? entry * (1 + settings.minProfitTargetPercent / 100) : 0);
  const trailing = levels?.trailingTakeProfit || (pnl?.currentPeak ? pnl.currentPeak * (1 - settings.trailingTakeProfitPercent / 100) : 0);
  const peak = levels?.peak || pnl?.currentPeak || 0;
  const bottom = levels?.bottom || pnl?.currentBottom || 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Live Binance-Style Graph</CardTitle>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline">Price</Badge>
          <Badge variant="secondary">Auto levels</Badge>
        </div>
      </CardHeader>
      <CardContent className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.16)" strokeWidth={2} />
            <Line type="monotone" dataKey="bid" stroke="hsl(var(--chart-2))" dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ask" stroke="hsl(var(--chart-5))" dot={false} strokeDasharray="4 4" />
            {entry > 0 ? <ReferenceLine y={entry} label="Entry" stroke="hsl(var(--chart-2))" /> : null}
            {stop > 0 ? <ReferenceLine y={stop} label="Stop" stroke="hsl(var(--destructive))" /> : null}
            {target > 0 ? <ReferenceLine y={target} label="Target" stroke="hsl(var(--chart-1))" /> : null}
            {trailing > 0 ? <ReferenceLine y={trailing} label="Trailing" stroke="hsl(var(--chart-4))" /> : null}
            {peak > 0 ? <ReferenceLine y={peak} label="Peak" stroke="hsl(var(--chart-3))" /> : null}
            {bottom > 0 ? <ReferenceLine y={bottom} label="Bottom" stroke="hsl(var(--muted-foreground))" /> : null}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function Fast2XAutoManagementPanel({ auto, pnl, price }: { auto?: Fast2XChartPayload["autoManagement"]; pnl?: ReturnType<typeof useFast2X>["pnl"]["data"]; price?: ReturnType<typeof useFast2X>["price"]["data"] }) {
  const thresholds = auto?.dynamicThresholds ?? {};
  const indicators = auto?.indicatorConfirmation ?? {};
  const risk = auto?.riskControls ?? {};
  const net = Number(pnl?.netPnLPercent ?? 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Auto Trend + Profit Management</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Auto State</div>
          <Badge variant={statusVariant(auto?.state)}>{auto?.state || "WAITING_FOR_SIGNAL"}</Badge>
          <div className="text-sm font-medium">{auto?.decision || "WAITING_FOR_SIGNAL"}</div>
          <div className="text-xs text-muted-foreground">Mode: {auto?.mode || "PAPER"} {auto?.aiBrainEnabled ? "| AI Brain" : "| Normal"}</div>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Live PnL Lock</div>
          <div className={cn("text-2xl font-semibold", net < 0 ? "text-destructive" : "text-running")}>{n(net, 4)}%</div>
          <div className="text-xs text-muted-foreground">Current {n(price?.currentPrice || pnl?.currentPrice, 8)} | Entry {n(pnl?.entryPrice, 8)}</div>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Market Brain</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{String(thresholds.marketMode || "RANGING")}</Badge>
            <Badge variant="outline">{String(thresholds.volatilityLevel || "NORMAL")}</Badge>
            <Badge variant={(indicators.allowTrade ?? true) ? "default" : "destructive"}>{(indicators.allowTrade ?? true) ? "Trade Allowed" : "Trade Blocked"}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">Confidence {n(indicators.confidence, 2)} | RSI {n(indicators.rsi, 2)}</div>
        </div>
        <div className="grid gap-2 md:col-span-3 sm:grid-cols-3">
          <MiniMetric label="Rollback Loss" value={`${n(risk.rollbackLossPercent, 4)}%`} />
          <MiniMetric label="Stop Loss" value={`${n(risk.stopLossPercent, 4)}%`} />
          <MiniMetric label="Trailing Profit" value={`${n(risk.trailingTakeProfitPercent, 4)}%`} />
          <MiniMetric label="Trades / Min" value={n(risk.maxTradesPerMinute, 0)} />
          <MiniMetric label="Trades / Day" value={n(risk.maxTradesPerDay, 0)} />
          <MiniMetric label="Daily Loss Limit" value={`${n(risk.maxDailyLossPercent, 2)}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value, badge = false }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {badge ? <Badge variant={statusVariant(value)}>{value}</Badge> : <span className={cn("text-right font-medium", value.startsWith("-") && "text-destructive")}>{value}</span>}
    </div>
  );
}
