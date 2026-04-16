import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatioBotConfig {
  id: string;
  name: string;
  symbol: string;
  enabled: boolean;
  mode: string;
  execution_mode: string;
  sell_threshold_ratio: string;
  buy_threshold_ratio: string;
  base_quote_amount: string;
  poll_interval_seconds: number;
  cooldown_seconds_after_trade: number;
  evaluation_mode: string;
  connection_id: string | null;
  state?: RatioBotState;
}

interface RatioBotState {
  id: string;
  position_state: string;
  last_buy_price: string | null;
  last_sell_price: string | null;
  active_anchor_price: string | null;
  active_anchor_type: string | null;
  last_trade_side: string | null;
  last_trade_time: string | null;
  current_ratio: string | null;
  last_seen_price: string | null;
  consecutive_order_failures: number;
  block_reason_code: string | null;
  block_reason_detail: string | null;
  cooldown_until: string | null;
}

interface RatioDisplay {
  current_price: number;
  position_state: string;
  last_buy_price: number | null;
  last_sell_price: number | null;
  active_anchor_price: number | null;
  active_anchor_type: string | null;
  sell_ratio: number | null;
  buy_ratio: number | null;
  sell_threshold: string;
  buy_threshold: string;
  sell_distance_pct: number | null;
  buy_distance_pct: number | null;
  unrealized_pnl: number | null;
}

// ─── State badge helper ──────────────────────────────────────────────────────

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    idle: "secondary",
    holding: "default",
    flat: "outline",
    paused: "secondary",
    blocked: "destructive",
    cooldown: "secondary",
    awaiting_execution_result: "secondary",
    error_review_required: "destructive",
  };
  const variant = (map[state] ?? "secondary") as "default" | "secondary" | "outline" | "destructive";
  return <Badge variant={variant}>{state.replace(/_/g, " ").toUpperCase()}</Badge>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RatioBotPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── List ──
  const { data: bots = [], isLoading } = useQuery<RatioBotConfig[]>({
    queryKey: ["ratio-bots", workspaceId],
    queryFn: () => api.get(`workspaces/${workspaceId}/ratio-bots`).then((r) => r.data),
    enabled: !!workspaceId,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bots.find((b) => b.id === selectedId) ?? null;

  // ── Ratio display ──
  const { data: ratioDisplay, refetch: refreshRatio } = useQuery<RatioDisplay>({
    queryKey: ["ratio-display", selectedId],
    queryFn: () => api.get(`ratio-bots/${selectedId}/ratio`).then((r) => r.data),
    enabled: !!selectedId,
    refetchInterval: 15_000,
  });

  // ── Create form state ──
  const [createForm, setCreateForm] = useState({
    symbol: "BTCUSDT",
    sell_threshold_ratio: "0.50",
    buy_threshold_ratio: "0.25",
    base_quote_amount: "100",
    execution_mode: "sandbox",
    mode: "restricted_auto",
    poll_interval_seconds: "300",
    name: "Ratio Bot",
  });

  // ── Anchor buy form ──
  const [anchorPrice, setAnchorPrice] = useState("");
  const [anchorQty, setAnchorQty] = useState("");

  // ─── Mutations ───────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ratio-bots", workspaceId] });
    qc.invalidateQueries({ queryKey: ["ratio-display", selectedId] });
  };

  const createMut = useMutation({
    mutationFn: (data: typeof createForm) =>
      api.post(`workspaces/${workspaceId}/ratio-bots`, data).then((r) => r.data),
    onSuccess: (bot) => {
      invalidate();
      setSelectedId(bot.id);
      toast({ title: "Ratio Bot created", description: bot.symbol });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Failed", variant: "destructive" }),
  });

  const lifecycleMut = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: object }) =>
      api.post(`ratio-bots/${selectedId}/${action}`, body ?? {}).then((r) => r.data),
    onSuccess: (_, { action }) => {
      invalidate();
      toast({ title: `Bot ${action}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Failed", variant: "destructive" }),
  });

  const anchorMut = useMutation({
    mutationFn: () =>
      api.post(`ratio-bots/${selectedId}/anchor-buy`, {
        buy_price: parseFloat(anchorPrice),
        quantity: parseFloat(anchorQty),
      }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Buy anchor set", description: `Bot is now HOLDING at ${anchorPrice}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Failed", variant: "destructive" }),
  });

  const evaluateMut = useMutation({
    mutationFn: () => api.post(`ratio-bots/${selectedId}/evaluate`).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Evaluation dispatched" });
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const fmt = (n: string | number | null | undefined, dp = 2) =>
    n == null ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const pct = (n: number | null | undefined) =>
    n == null ? "—" : `${(n * 100).toFixed(2)}%`;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell activePath="/ratio-bot">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Ratio Bot</h1>
          <p className="text-muted-foreground text-sm">
            Stateful buy/sell cycle bot. Set a manual buy anchor → bot watches for sell ratio → after sell watches for rebuy ratio. Repeats automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left panel: list + create ──────────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Your Ratio Bots</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!isLoading && bots.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bots yet. Create one below.</p>
                )}
                {bots.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${selectedId === b.id ? "bg-accent border-accent-foreground" : "hover:bg-muted"}`}
                  >
                    <div className="font-medium">{b.name} — {b.symbol}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <StateBadge state={b.state?.position_state ?? "idle"} />
                      <Badge variant={b.execution_mode === "live" ? "destructive" : "outline"} className="text-xs">
                        {b.execution_mode}
                      </Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Create form */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Create New Bot</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ratio Bot" />
                </div>
                <div>
                  <Label className="text-xs">Symbol</Label>
                  <Input value={createForm.symbol} onChange={(e) => setCreateForm((f) => ({ ...f, symbol: e.target.value }))} placeholder="BTCUSDT" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Sell Threshold</Label>
                    <Input value={createForm.sell_threshold_ratio} onChange={(e) => setCreateForm((f) => ({ ...f, sell_threshold_ratio: e.target.value }))} placeholder="0.50" />
                  </div>
                  <div>
                    <Label className="text-xs">Buy Threshold</Label>
                    <Input value={createForm.buy_threshold_ratio} onChange={(e) => setCreateForm((f) => ({ ...f, buy_threshold_ratio: e.target.value }))} placeholder="0.25" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Quote Amount (USDT)</Label>
                  <Input value={createForm.base_quote_amount} onChange={(e) => setCreateForm((f) => ({ ...f, base_quote_amount: e.target.value }))} placeholder="100" />
                </div>
                <div>
                  <Label className="text-xs">Execution Mode</Label>
                  <Select value={createForm.execution_mode} onValueChange={(v) => setCreateForm((f) => ({ ...f, execution_mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (simulated)</SelectItem>
                      <SelectItem value="live">Live (real Binance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={createForm.mode} onValueChange={(v) => setCreateForm((f) => ({ ...f, mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advisor">Advisor (suggestions only)</SelectItem>
                      <SelectItem value="manual_approval">Manual Approval</SelectItem>
                      <SelectItem value="restricted_auto">Restricted Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Poll Interval (seconds)</Label>
                  <Select value={createForm.poll_interval_seconds} onValueChange={(v) => setCreateForm((f) => ({ ...f, poll_interval_seconds: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 min</SelectItem>
                      <SelectItem value="300">5 min</SelectItem>
                      <SelectItem value="600">10 min</SelectItem>
                      <SelectItem value="900">15 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMut.mutate(createForm)}
                  disabled={createMut.isPending || !workspaceId}
                >
                  {createMut.isPending ? "Creating…" : "Create Bot"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Right panel: selected bot detail ──────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {!selected && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a bot from the left to view its dashboard.
                </CardContent>
              </Card>
            )}

            {selected && (
              <>
                {/* Status card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{selected.name} — {selected.symbol}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={selected.execution_mode === "live" ? "destructive" : "secondary"}>
                          {selected.execution_mode}
                        </Badge>
                        <StateBadge state={selected.state?.position_state ?? "idle"} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Lifecycle controls */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button size="sm" variant="default"
                        onClick={() => lifecycleMut.mutate({ action: "start" })}
                        disabled={lifecycleMut.isPending}>
                        Start
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => lifecycleMut.mutate({ action: "pause" })}
                        disabled={lifecycleMut.isPending}>
                        Pause
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => lifecycleMut.mutate({ action: "resume" })}
                        disabled={lifecycleMut.isPending}>
                        Resume
                      </Button>
                      <Button size="sm" variant="destructive"
                        onClick={() => lifecycleMut.mutate({ action: "stop" })}
                        disabled={lifecycleMut.isPending}>
                        Stop
                      </Button>
                      <Button size="sm" variant="secondary"
                        onClick={() => evaluateMut.mutate()}
                        disabled={evaluateMut.isPending}>
                        Evaluate Now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => refreshRatio()}>
                        Refresh Ratio
                      </Button>
                    </div>

                    {/* Block reason */}
                    {selected.state?.block_reason_code && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm mb-4">
                        <strong>Blocked:</strong> {selected.state.block_reason_code}<br />
                        <span className="text-muted-foreground">{selected.state.block_reason_detail}</span>
                      </div>
                    )}

                    {/* Anchor prices */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Last Buy Price</div>
                        <div className="font-mono font-bold">{fmt(selected.state?.last_buy_price, 2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last Sell Price</div>
                        <div className="font-mono font-bold">{fmt(selected.state?.last_sell_price, 2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sell Threshold</div>
                        <div className="font-mono font-bold">{pct(parseFloat(selected.sell_threshold_ratio))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Buy Threshold</div>
                        <div className="font-mono font-bold">{pct(parseFloat(selected.buy_threshold_ratio))}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Live ratio card */}
                {ratioDisplay && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Live Ratio Monitor</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Current Price</div>
                          <div className="text-xl font-bold font-mono">${fmt(ratioDisplay.current_price, 2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Active Anchor</div>
                          <div className="font-mono">${fmt(ratioDisplay.active_anchor_price, 2)}</div>
                          <div className="text-xs text-muted-foreground">{ratioDisplay.active_anchor_type?.replace("_", " ") ?? "—"}</div>
                        </div>
                        {ratioDisplay.sell_ratio != null && (
                          <div>
                            <div className="text-muted-foreground">Sell Ratio</div>
                            <div className={`font-bold font-mono ${ratioDisplay.sell_ratio >= parseFloat(ratioDisplay.sell_threshold) ? "text-green-500" : ""}`}>
                              {pct(ratioDisplay.sell_ratio)}
                            </div>
                            <div className="text-xs text-muted-foreground">Target: {pct(parseFloat(ratioDisplay.sell_threshold))}</div>
                          </div>
                        )}
                        {ratioDisplay.buy_ratio != null && (
                          <div>
                            <div className="text-muted-foreground">Buy Ratio</div>
                            <div className={`font-bold font-mono ${ratioDisplay.buy_ratio >= parseFloat(ratioDisplay.buy_threshold) ? "text-blue-500" : ""}`}>
                              {pct(ratioDisplay.buy_ratio)}
                            </div>
                            <div className="text-xs text-muted-foreground">Target: {pct(parseFloat(ratioDisplay.buy_threshold))}</div>
                          </div>
                        )}
                        {ratioDisplay.unrealized_pnl != null && (
                          <div>
                            <div className="text-muted-foreground">Unrealized PnL</div>
                            <div className={`font-bold font-mono ${ratioDisplay.unrealized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                              ${fmt(ratioDisplay.unrealized_pnl, 4)}
                            </div>
                          </div>
                        )}
                        {ratioDisplay.sell_distance_pct != null && (
                          <div>
                            <div className="text-muted-foreground">Distance to Sell</div>
                            <div className="font-mono text-sm">{ratioDisplay.sell_distance_pct.toFixed(2)}%</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Manual anchor buy */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Set Buy Anchor (Manual)</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      Use this when you manually bought on Binance and want to anchor the bot to that price. Bot will transition to HOLDING and start watching for the sell trigger.
                    </p>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Buy Price (USDT)</Label>
                        <Input
                          type="number"
                          value={anchorPrice}
                          onChange={(e) => setAnchorPrice(e.target.value)}
                          placeholder="e.g. 60000"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Quantity (base asset)</Label>
                        <Input
                          type="number"
                          value={anchorQty}
                          onChange={(e) => setAnchorQty(e.target.value)}
                          placeholder="e.g. 0.001"
                        />
                      </div>
                      <Button
                        onClick={() => anchorMut.mutate()}
                        disabled={anchorMut.isPending || !anchorPrice || !anchorQty}
                      >
                        {anchorMut.isPending ? "Setting…" : "Set Anchor"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Config summary */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Mode: </span>{selected.mode}</div>
                      <div><span className="text-muted-foreground">Quote Amount: </span>{fmt(selected.base_quote_amount, 2)} USDT</div>
                      <div><span className="text-muted-foreground">Poll Interval: </span>{selected.poll_interval_seconds}s</div>
                      <div><span className="text-muted-foreground">Evaluation: </span>{selected.evaluation_mode}</div>
                      <div><span className="text-muted-foreground">Cooldown: </span>{selected.cooldown_seconds_after_trade}s</div>
                      <div><span className="text-muted-foreground">Failures before pause: </span>—</div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Ratio algorithm reference ──────────────────────────────────── */}
        <Card className="bg-muted/30">
          <CardHeader><CardTitle className="text-sm">Algorithm Reference</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <div>
              <strong>SELL trigger</strong> (when HOLDING):{" "}
              <code className="bg-background rounded px-1 font-mono">
                (current_price / last_buy_price) - 1 &gt;= sell_threshold
              </code>
            </div>
            <div>
              <strong>BUY trigger</strong> (when FLAT after sell):{" "}
              <code className="bg-background rounded px-1 font-mono">
                (last_sell_price / current_price) - 1 &gt;= buy_threshold
              </code>
            </div>
            <div className="text-muted-foreground">
              Example: Buy at 60,000 → Sell at 90,000 (ratio 0.5 = 50%). Then rebuy when price drops 25% from 90,000 → at 72,000.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
