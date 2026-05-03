import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Bot, Brain, Power, RefreshCw, Save, ShieldAlert, Square, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFutureTradeBot, type FutureTradeSettings } from "@/hooks/useFutureTradeBot";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const FUTURE_TRADE_ALL_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT",
  "DOGEUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT",
  "APTUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "SEIUSDT",
];

const DEFAULT_SETTINGS: FutureTradeSettings = {
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT"],
  timeframe: "5m",
  paperTrading: true,
  liveTrading: false,
  forceTestnet: true,
  leverage: 3,
  marginMode: "isolated",
  tradeAmountUsdt: 25,
  minConfidence: 0.82,
  takeProfitPercent: 1.2,
  stopLossPercent: 0.4,
  trailingTakeProfitPercent: 0.30,
  rollbackLossPercent: 0.25,
  maxDailyLossPercent: 2,
  maxOpenPositions: 1,
  maxTradesPerDay: 10,
  maxLeverage: 5,
  maxSpreadPercent: 0.12,
  cooldownSeconds: 60,
  scanIntervalSeconds: 3,
  autoExecutePaperSignals: true,
  avoidChoppyMarket: true,
  emergencyStop: false,
};

function n(value: unknown, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "None";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(parsed);
}

function statusVariant(value?: string) {
  const normalized = (value || "").toLowerCase();
  if (["running", "connected", "buy", "sell", "long", "short", "in_position", "buy_executed", "sell_executed"].includes(normalized)) return "default";
  if (["scanning", "cooldown", "waiting_for_signal", "wait"].includes(normalized)) return "secondary";
  if (["stopped", "emergency_stop", "stop_loss_hit", "loss_rollback_triggered"].includes(normalized)) return "destructive";
  return "outline";
}

export default function FutureTradeBotPage() {
  const { currentWorkspace, loading } = useWorkspace();
  const bot = useFutureTradeBot(currentWorkspace?.id);
  const { toast } = useToast();
  const [settings, setSettings] = useState<FutureTradeSettings>(DEFAULT_SETTINGS);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (bot.config.data?.settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...bot.config.data.settings });
      setNotes(bot.config.data.algorithm_notes || "");
    }
  }, [bot.config.data]);

  const dashboard = bot.dashboard.data;
  const status = dashboard?.status;
  const busy = bot.start.isPending || bot.stop.isPending || bot.emergencyStop.isPending || bot.resetPaper.isPending || bot.updateConfig.isPending;
  const chart = useMemo(() => dashboard?.chart ?? [], [dashboard?.chart]);

  const save = () => {
    bot.updateConfig.mutate(
      { settings: { ...settings, paperTrading: !settings.liveTrading }, algorithm_notes: notes },
      {
        onSuccess: () => toast({ title: "Future Trade Bot saved", description: settings.liveTrading ? "Live mode requested. Backend env gate decides if it can activate." : "Paper futures mode active." }),
        onError: (error) => toast({ title: "Save failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" }),
      }
    );
  };

  if (loading || !currentWorkspace) {
    return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading workspace...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
              <Bot className="h-6 w-6 text-primary" />
              Future Trade Bot
            </h1>
            <p className="text-sm text-muted-foreground">Video-style Binance Futures scanner with paper execution, BUY/SELL signals, PnL, stop loss, rollback and trailing profit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(status?.status)}>{status?.status || "Stopped"}</Badge>
            <Badge variant={status?.liveTrading ? "destructive" : "secondary"}>{status?.mode || "Paper Futures"}</Badge>
            <Badge variant={status?.liveTradingEnvEnabled ? "outline" : "destructive"}>{status?.liveTradingEnvEnabled ? "Live Env Enabled" : "Live Env Blocked"}</Badge>
          </div>
        </div>

        {settings.liveTrading ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              Live mode only activates when server `.env` has `FUTURE_TRADE_ENABLE_LIVE_TRADING=true` and Binance API keys are set. Keep Force testnet on until testnet orders are verified.
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-5">
          <Metric title="Total Profit" value={`${n(status?.totalProfit ?? status?.realizedPnl, 4)} ${status?.accountAsset || "USDT"}`} sub={`Realized ${n(status?.realizedPnl, 4)} | Unrealized ${n(status?.unrealizedPnlPercent, 4)}%`} good={(status?.totalProfit ?? status?.realizedPnl ?? 0) >= 0} />
          <Metric title="Wallet Balance" value={`${n(status?.walletBalance, 4)} ${status?.accountAsset || "USDT"}`} sub={status?.balanceSource === "PAPER_LEDGER" ? "Paper mode wallet not linked" : `Available ${n(status?.availableBalance, 4)}`} icon={<Wallet className="h-4 w-4" />} />
          <Metric title="Current Signal" value={status?.currentSignal || "WAITING"} sub={`${status?.currentSymbol || "No symbol"} | ${n((status?.confidence ?? 0) * 100, 2)}%`} />
          <Metric title="Position" value={status?.positionSide || "FLAT"} sub={`Entry ${n(status?.entryPrice, 8)} | Qty ${n(status?.quantity, 6)}`} />
          <Metric title="Loss Summary" value={`${n(status?.botLoss ?? status?.dailyLoss, 4)} ${status?.accountAsset || "USDT"}`} sub={`Win ${n(status?.winRate, 2)}% | Trades ${n(status?.tradeCountToday, 0)}`} good={(status?.botLoss ?? status?.dailyLoss ?? 0) === 0} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Live Futures Graph</CardTitle>
                <Badge variant={statusVariant(dashboard?.bestSignal?.signal)}>{dashboard?.bestSignal?.signal || "WAIT"}</Badge>
              </CardHeader>
              <CardContent className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area dataKey="price" type="monotone" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.16)" strokeWidth={2} />
                    {dashboard?.levels.entry ? <ReferenceLine y={dashboard.levels.entry} label="Entry" stroke="hsl(var(--chart-2))" /> : null}
                    {dashboard?.levels.stopLoss ? <ReferenceLine y={dashboard.levels.stopLoss} label="Stop" stroke="hsl(var(--destructive))" /> : null}
                    {dashboard?.levels.takeProfit ? <ReferenceLine y={dashboard.levels.takeProfit} label="Target" stroke="hsl(var(--chart-1))" /> : null}
                    {dashboard?.levels.trailing ? <ReferenceLine y={dashboard.levels.trailing} label="Trail" stroke="hsl(var(--chart-4))" /> : null}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <SignalBoard signals={dashboard?.scanner ?? []} />
              <Orderbook bids={dashboard?.orderbook.bids ?? []} asks={dashboard?.orderbook.asks ?? []} />
            </div>

            <TradeHistory trades={bot.trades.data ?? []} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Bot Controls</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button disabled={busy} onClick={() => bot.start.mutate(undefined, { onError: err(toast) })}><Power className="mr-2 h-4 w-4" />On</Button>
                <Button disabled={busy} variant="outline" onClick={() => bot.stop.mutate(undefined, { onError: err(toast) })}><Square className="mr-2 h-4 w-4" />Off</Button>
                <Button disabled={busy} variant="destructive" onClick={() => bot.emergencyStop.mutate(undefined, { onError: err(toast) })}><ShieldAlert className="mr-2 h-4 w-4" />Emergency</Button>
                <Button disabled={busy} variant="secondary" onClick={() => bot.resetPaper.mutate(undefined, { onError: err(toast) })}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button>
              </CardContent>
            </Card>

            <RiskPanel settings={settings} />
            <ConfigPanel settings={settings} setSettings={setSettings} notes={notes} setNotes={setNotes} availableSymbols={bot.config.data?.available_symbols ?? FUTURE_TRADE_ALL_SYMBOLS} onSave={save} busy={busy} />
            <LogFeed logs={bot.logs.data ?? []} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function err(toast: ReturnType<typeof useToast>["toast"]) {
  return (error: unknown) => toast({ title: "Future Trade Bot failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
}

function Metric({ title, value, sub, good, icon }: { title: string; value: string; sub: string; good?: boolean; icon?: ReactNode }) {
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</CardTitle></CardHeader><CardContent><div className={cn("text-xl font-semibold", good === false && "text-destructive", good === true && "text-running")}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{sub}</div></CardContent></Card>
  );
}

function SignalBoard({ signals }: { signals: Array<{ symbol: string; signal: string; price: number; changePercent: number; confidence: number; timeframe: string; reason: string }> }) {
  return (
    <Card>
      <CardHeader><CardTitle>Signal History Scanner</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {signals.slice(0, 10).map((signal) => (
          <div key={signal.symbol} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div>
              <div className="flex items-center gap-2"><Badge variant={statusVariant(signal.signal)}>{signal.signal}</Badge><span className="font-medium">FUTURES - {signal.symbol} - {signal.timeframe}</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{signal.reason}</div>
            </div>
            <div className="text-right">
              <div>{n(signal.price, 8)}</div>
              <div className={cn("text-xs", signal.changePercent >= 0 ? "text-running" : "text-destructive")}>{n(signal.changePercent, 2)}% | {n(signal.confidence * 100, 1)}%</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Orderbook({ bids, asks }: { bids: Array<{ price: number; qty: number }>; asks: Array<{ price: number; qty: number }> }) {
  return (
    <Card>
      <CardHeader><CardTitle>Orderbook Ladder</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">{asks.slice().reverse().map((row) => <div key={`a-${row.price}`} className="flex justify-between rounded bg-destructive/10 px-2 py-1 text-destructive"><span>{n(row.price, 8)}</span><span>{n(row.qty, 4)}</span></div>)}</div>
        <div className="space-y-1">{bids.map((row) => <div key={`b-${row.price}`} className="flex justify-between rounded bg-running/10 px-2 py-1 text-running"><span>{n(row.price, 8)}</span><span>{n(row.qty, 4)}</span></div>)}</div>
      </CardContent>
    </Card>
  );
}

function RiskPanel({ settings }: { settings: FutureTradeSettings }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Loss Prevention</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Row label="Stop loss" value={`${settings.stopLossPercent}%`} />
        <Row label="Rollback loss" value={`${settings.rollbackLossPercent}%`} />
        <Row label="Trailing profit" value={`${settings.trailingTakeProfitPercent}%`} />
        <Row label="Take profit" value={`${settings.takeProfitPercent}%`} />
        <Row label="Daily loss limit" value={`${settings.maxDailyLossPercent}%`} />
        <Row label="Max leverage" value={`${settings.maxLeverage}x`} />
      </CardContent>
    </Card>
  );
}

function ConfigPanel({ settings, setSettings, notes, setNotes, availableSymbols, onSave, busy }: { settings: FutureTradeSettings; setSettings: (settings: FutureTradeSettings) => void; notes: string; setNotes: (value: string) => void; availableSymbols: string[]; onSave: () => void; busy: boolean }) {
  const update = <K extends keyof FutureTradeSettings>(key: K, value: FutureTradeSettings[K]) => setSettings({ ...settings, [key]: value });

  const toggleSymbol = (sym: string) => {
    const active = settings.symbols.includes(sym);
    if (active && settings.symbols.length <= 1) return; // keep at least one
    const next = active ? settings.symbols.filter((s) => s !== sym) : [...settings.symbols, sym];
    update("symbols", next);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4" /> Algorithm Config</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Symbols — click to toggle scan list">
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {availableSymbols.map((sym) => {
              const active = settings.symbols.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggleSymbol(sym)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {sym.replace("USDT", "")}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{settings.symbols.length} coin{settings.symbols.length !== 1 ? "s" : ""} selected: {settings.symbols.map((s) => s.replace("USDT", "")).join(", ")}</p>
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Live trading" checked={settings.liveTrading} onChange={(value) => update("liveTrading", value)} />
          <Toggle label="Force testnet" checked={settings.forceTestnet} onChange={(value) => update("forceTestnet", value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["leverage", "tradeAmountUsdt", "minConfidence", "takeProfitPercent", "stopLossPercent", "trailingTakeProfitPercent", "rollbackLossPercent", "maxDailyLossPercent", "maxTradesPerDay", "cooldownSeconds"] as const).map((key) => (
            <Field key={key} label={key}><Input type="number" step="0.01" value={Number(settings[key])} onChange={(e) => update(key, Number(e.target.value) as never)} /></Field>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Auto paper execute" checked={settings.autoExecutePaperSignals} onChange={(value) => update("autoExecutePaperSignals", value)} />
          <Toggle label="Avoid choppy market" checked={settings.avoidChoppyMarket} onChange={(value) => update("avoidChoppyMarket", value)} />
        </div>
        <Field label="Algorithm Notes"><Textarea className="min-h-[120px] font-mono text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Button className="w-full" disabled={busy} onClick={onSave}><Save className="mr-2 h-4 w-4" />Save Algorithm</Button>
      </CardContent>
    </Card>
  );
}

function LogFeed({ logs }: { logs: Array<{ id: string; event: string; symbol?: string | null; signal?: string | null; reason?: string | null; occurred_at: string }> }) {
  return (
    <Card><CardHeader><CardTitle>Decision Feed</CardTitle></CardHeader><CardContent className="space-y-2">{logs.slice(0, 10).map((log) => <div key={log.id} className="rounded-md border px-3 py-2 text-sm"><Badge variant={statusVariant(log.event)}>{log.event}</Badge><span className="ml-2 text-muted-foreground">{log.symbol} {log.signal}</span><div className="mt-1 text-xs text-muted-foreground">{log.reason}</div></div>)}</CardContent></Card>
  );
}

function TradeHistory({ trades }: { trades: Array<{ id: string; symbol: string; side: string; entry_price?: string | number | null; exit_price?: string | number | null; net_pnl?: string | number | null; reason?: string | null; status: string; created_at: string }> }) {
  return (
    <Card><CardHeader><CardTitle>Paper Futures Trades</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Symbol</TableHead><TableHead>Side</TableHead><TableHead>Entry</TableHead><TableHead>Exit</TableHead><TableHead>Net PnL</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{trades.map((trade) => <TableRow key={trade.id}><TableCell>{new Date(trade.created_at).toLocaleTimeString()}</TableCell><TableCell>{trade.symbol}</TableCell><TableCell>{trade.side}</TableCell><TableCell>{n(trade.entry_price, 8)}</TableCell><TableCell>{n(trade.exit_price, 8)}</TableCell><TableCell>{n(trade.net_pnl, 6)}</TableCell><TableCell>{trade.reason}</TableCell><TableCell>{trade.status}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
