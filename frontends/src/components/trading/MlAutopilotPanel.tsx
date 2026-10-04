import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authorizedFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MlSignalsBoard, type SignalRow } from "@/components/trading/MlSignalsBoard";

/*
 * ML Paper Autopilot — simulated trades opened automatically on the python
 * champion's BUY/SELL signals (GET /quick-trade/ml-autopilot).
 *
 * Fully separate from the user's own trades: its own table and its own
 * virtual balance. It never touches the paper wallet, Quick Trade rows, live
 * data or orders, and nothing here feeds order placement.
 *
 * In LIVE mode only the read-only signal board is shown (manual trading;
 * no autopilot section).
 */

type Stats = {
  closed_trades: number; wins: number; losses: number;
  win_rate_pct: number | null; direction_accuracy_pct: number | null;
  total_pnl_usd: number; avg_net_pct: number | null; best_net_pct: number | null; worst_net_pct: number | null;
  profit_factor: number | null; avg_hold_minutes: number | null;
};

type TradeRow = {
  id: string; symbol: string; horizon_minutes: number; side: "BUY" | "SELL"; status: string;
  model_version: string | null; p_buy: number | null; p_sell: number | null; expected_net_pct: number | null;
  signal_time: string; signal_price: number; entry_time: string; entry_price: number; entry_price_source: string;
  expires_at: string; exit_time: string | null; exit_price: number | null; exit_price_source: string | null;
  stake_usd: number; cost_pct: number; funding_buy_pct: number | null;
  gross_return_pct: number | null; net_return_pct: number | null; pnl_usd: number | null; outcome: "WIN" | "LOSS" | null;
};

type AutopilotPayload = {
  enabled: boolean;
  settings: {
    starting_balance_usd: number; stake_usd: number; cost_pct: number; min_closed_trades: number; rule: string;
    trade_horizons_minutes: number[]; stability: { confirm_predictions: number; entry_probability: number; exit_probability: number };
  };
  summary: Stats & {
    status: "ok" | "insufficient_data"; balance_usd: number; total_return_pct: number;
    open_trades: number; max_drawdown_usd: number; cancelled_trades: number;
  };
  by_scope: (Stats & { symbol: string; horizon_minutes: number })[];
  by_side: { BUY: Stats; SELL: Stats };
  execution_gap: {
    autopilot_avg_net_pct: number | null; shadow_avg_net_pct_same_signals: number | null;
    avg_entry_slippage_pct: number | null; live_quote_entries: number; live_quote_exits: number;
  };
  equity_curve: { t: string | null; balance: number }[];
  signals: SignalRow[];
  open_trades: TradeRow[];
  recent_trades: TradeRow[];
};

const pct = (v: number | null | undefined, d = 3) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
const plain = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)}%`);
const usd = (v: number | null | undefined) => (v == null ? "—" : `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const signedUsd = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${usd(v)}`);
const price = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 2 }));
const prob = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const hz = (m: number) => (m >= 1440 ? `${m / 1440}d` : m >= 60 ? `${m / 60}h` : `${m}m`);
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const tone = (v: number | null | undefined) => (v == null || v === 0 ? "text-slate-200" : v > 0 ? "text-emerald-300" : "text-rose-300");
const words = (v?: string | null) => (v ? v.replaceAll("_", " ") : "—");

function sideClass(side?: string | null) {
  if (side === "BUY") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (side === "SELL") return "border-rose-500/30 bg-rose-500/15 text-rose-300";
  return "border-slate-600 bg-slate-800/60 text-slate-300";
}

function Kpi({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums text-slate-100", valueClass)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function EquityChart({ data, start }: { data: AutopilotPayload["equity_curve"]; start: number }) {
  if (data.length < 2) {
    return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">The equity curve appears after the first trade closes.</div>;
  }
  const points = data.map((p, i) => ({ i, t: p.t, balance: p.balance }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Autopilot virtual balance after each closed trade">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="i" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} tickFormatter={(i: number) => (i === 0 ? "start" : `#${i}`)} minTickGap={24} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <ReferenceLine y={start} stroke="#475569" strokeDasharray="4 4" label={{ value: "start", fill: "#64748b", fontSize: 10, position: "insideTopLeft" }} />
          <Tooltip
            cursor={{ stroke: "#475569", strokeWidth: 1 }}
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
            labelFormatter={(i: number) => (i === 0 ? "Start" : `Trade #${i} · ${when(points[i]?.t)}`)}
            formatter={(v: number) => [usd(v), "Balance"]}
          />
          <Line type="monotone" dataKey="balance" stroke="#38bdf8" strokeWidth={2} dot={points.length <= 40 ? { r: 3, fill: "#38bdf8", stroke: "#020617", strokeWidth: 2 } : false} activeDot={{ r: 5, stroke: "#020617", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TradesTable({ rows, open }: { rows: TradeRow[]; open?: boolean }) {
  if (!rows.length) return <div className="py-6 text-center text-xs text-slate-500">{open ? "No open autopilot positions." : "No closed autopilot trades yet."}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-800">
            <th className="py-2 pr-3 font-medium">Symbol</th><th className="pr-3 font-medium">Side</th><th className="pr-3 font-medium">P(side)</th>
            <th className="pr-3 font-medium">Entry</th><th className="pr-3 font-medium">{open ? "Expires" : "Exit"}</th>
            {!open && <><th className="pr-3 text-right font-medium">Gross</th><th className="pr-3 text-right font-medium">Net</th><th className="pr-3 text-right font-medium">P&L</th><th className="font-medium">Result</th></>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-slate-900 align-top text-slate-300">
              <td className="py-2 pr-3"><div className="font-medium text-slate-200">{t.symbol}</div><div className="text-[11px] text-slate-500">{hz(t.horizon_minutes)} · {t.model_version ?? "—"}</div></td>
              <td className="pr-3"><Badge variant="outline" className={sideClass(t.side)}>{t.side}</Badge></td>
              <td className="pr-3 tabular-nums">{prob(t.side === "BUY" ? t.p_buy : t.p_sell)}</td>
              <td className="pr-3 tabular-nums"><div>{price(t.entry_price)}</div><div className="text-[11px] text-slate-500">{when(t.entry_time)} · {words(t.entry_price_source)}</div></td>
              <td className="pr-3 tabular-nums">{open
                ? <div>{when(t.expires_at)}</div>
                : <><div>{price(t.exit_price)}</div><div className="text-[11px] text-slate-500">{when(t.exit_time)} · {words(t.exit_price_source)}</div></>}</td>
              {!open && <>
                <td className={cn("pr-3 text-right tabular-nums", tone(t.gross_return_pct))}>{pct(t.gross_return_pct)}</td>
                <td className={cn("pr-3 text-right tabular-nums", tone(t.net_return_pct))}>{pct(t.net_return_pct)}</td>
                <td className={cn("pr-3 text-right tabular-nums", tone(t.pnl_usd))}>{signedUsd(t.pnl_usd)}</td>
                <td>{t.outcome === "WIN" ? <span className="text-emerald-300">✓ Win</span> : t.outcome === "LOSS" ? <span className="text-rose-300">✗ Loss</span> : "—"}</td>
              </>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({ rows }: { rows: { label: string; stats: Stats }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-800">
            <th className="py-2 pr-3 font-medium">Scope</th><th className="pr-3 text-right font-medium">Trades</th><th className="pr-3 text-right font-medium">Win rate</th>
            <th className="pr-3 text-right font-medium">Direction right</th><th className="pr-3 text-right font-medium">Avg net</th>
            <th className="pr-3 text-right font-medium">Profit factor</th><th className="text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, stats }) => (
            <tr key={label} className="border-b border-slate-900 text-slate-300">
              <td className="py-2 pr-3 font-medium text-slate-200">{label}</td>
              <td className="pr-3 text-right tabular-nums">{stats.closed_trades} <span className="text-slate-500">({stats.wins}W/{stats.losses}L)</span></td>
              <td className="pr-3 text-right tabular-nums">{plain(stats.win_rate_pct)}</td>
              <td className="pr-3 text-right tabular-nums">{plain(stats.direction_accuracy_pct)}</td>
              <td className={cn("pr-3 text-right tabular-nums", tone(stats.avg_net_pct))}>{pct(stats.avg_net_pct)}</td>
              <td className="pr-3 text-right tabular-nums">{stats.profit_factor?.toFixed(2) ?? "—"}</td>
              <td className={cn("text-right tabular-nums", tone(stats.total_pnl_usd))}>{signedUsd(stats.total_pnl_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MlAutopilotPanel({ workspaceId, mode = "paper" }: { workspaceId?: string; mode?: "paper" | "live" }) {
  const query = useQuery({
    queryKey: ["ml-autopilot", workspaceId],
    queryFn: () => authorizedFetch("/quick-trade/ml-autopilot", "GET", undefined, { params: { workspace_id: workspaceId } }) as Promise<AutopilotPayload>,
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
    retry: false,
  });
  const data = query.data;
  const paper = mode === "paper";

  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {paper ? "ML Paper Autopilot" : "ML Signals"}
          {paper
            ? <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">Simulated · separate from your trades</Badge>
            : <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Read-only · you trade manually</Badge>}
          {paper && data && !data.enabled && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Paused</Badge>}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {paper ? (
            <>Opens a virtual trade automatically when a champion model gives a <span className="text-slate-300">confirmed</span> BUY or SELL, and closes it at expiry.
              {data && <> Stake {usd(data.settings.stake_usd)} per trade, fee + slippage {data.settings.cost_pct}% per round trip plus real funding, one position per coin × horizon, traded horizons {data.settings.trade_horizons_minutes.map(hz).join(", ")}.</>}
              {" "}Your manual trades, paper wallet and live account are never touched.</>
          ) : (
            <>What every model says right now, how well it tested and how its training is going. Nothing here places an order: the ML never trades your live account.</>
          )}
          {data && <> A side becomes <span className="text-slate-300">stable</span> after {data.settings.stability.confirm_predictions} readings in a row at ≥{(data.settings.stability.entry_probability * 100).toFixed(0)}%, and holds until it drops below {(data.settings.stability.exit_probability * 100).toFixed(0)}%.</>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
        {query.isError && <div className="text-xs text-rose-300">ML data unavailable.</div>}
        {data && <MlSignalsBoard workspaceId={workspaceId} signals={data.signals} confirm={data.settings.stability.confirm_predictions} showAutopilot={paper} />}
        {data && paper && <Body data={data} />}
      </CardContent>
    </Card>
  );
}

function Body({ data }: { data: AutopilotPayload }) {
  const s = data.summary;
  const gap = data.execution_gap;
  const sideRows = (["BUY", "SELL"] as const).map((side) => ({ label: side, stats: data.by_side[side] }));
  const scopeRows = data.by_scope.map((row) => ({ label: `${row.symbol} · ${hz(row.horizon_minutes)}`, stats: row }));

  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-3 bg-slate-900">
        <TabsTrigger value="overview">Autopilot results</TabsTrigger>
        <TabsTrigger value="trades">Trades ({s.closed_trades}{s.open_trades ? ` + ${s.open_trades} open` : ""})</TabsTrigger>
        <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {s.status === "insufficient_data" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Early results: {s.closed_trades}/{data.settings.min_closed_trades} closed trades. Below that, win rate and P&L are mostly noise. Judge after 2–4 weeks.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Virtual balance" value={usd(s.balance_usd)} sub={`${pct(s.total_return_pct, 2)} from ${usd(data.settings.starting_balance_usd)}`} valueClass={tone(s.total_return_pct)} />
          <Kpi label="Total P&L" value={signedUsd(s.total_pnl_usd)} sub={`max drawdown ${usd(s.max_drawdown_usd)}`} valueClass={tone(s.total_pnl_usd)} />
          <Kpi label="Win rate (after costs)" value={plain(s.win_rate_pct)} sub={`${s.wins} wins · ${s.losses} losses`} />
          <Kpi label="Direction accuracy" value={plain(s.direction_accuracy_pct)} sub="price moved the predicted way, before costs" />
          <Kpi label="Avg net / trade" value={pct(s.avg_net_pct)} sub={`best ${pct(s.best_net_pct, 2)} · worst ${pct(s.worst_net_pct, 2)}`} valueClass={tone(s.avg_net_pct)} />
          <Kpi label="Profit factor" value={s.profit_factor?.toFixed(2) ?? "—"} sub="gross wins ÷ gross losses" />
          <Kpi label="Trades" value={`${s.closed_trades} closed`} sub={`${s.open_trades} open · ${s.cancelled_trades} cancelled`} />
          <Kpi label="Avg hold" value={s.avg_hold_minutes == null ? "—" : `${hz(Math.round(s.avg_hold_minutes))}`} sub="entry → expiry" />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Virtual balance after each closed trade</div>
          <EquityChart data={data.equity_curve} start={data.settings.starting_balance_usd} />
        </div>

      </TabsContent>

      <TabsContent value="trades" className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Open positions</div>
          <TradesTable rows={data.open_trades} open />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Closed trades (latest 50)</div>
          <TradesTable rows={data.recent_trades} />
        </div>
      </TabsContent>

      <TabsContent value="breakdown" className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">By symbol × horizon</div>
          {scopeRows.length ? <StatsTable rows={scopeRows} /> : <div className="py-4 text-xs text-slate-500">No closed trades yet.</div>}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">By side</div>
          <StatsTable rows={sideRows} />
        </div>
        <div className="rounded-lg border border-slate-800 p-3 text-xs">
          <div className="mb-2 font-medium text-slate-300">Autopilot vs shadow evaluation (same signals)</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div><div className="text-[11px] text-slate-500">Autopilot avg net</div><div className={cn("tabular-nums", tone(gap.autopilot_avg_net_pct))}>{pct(gap.autopilot_avg_net_pct)}</div></div>
            <div><div className="text-[11px] text-slate-500">Shadow avg net</div><div className={cn("tabular-nums", tone(gap.shadow_avg_net_pct_same_signals))}>{pct(gap.shadow_avg_net_pct_same_signals)}</div></div>
            <div><div className="text-[11px] text-slate-500">Avg entry slippage vs signal</div><div className="tabular-nums text-slate-200">{pct(gap.avg_entry_slippage_pct)}</div></div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Shadow scores with candle closes and the model's own cost. Autopilot enters at the live quote and pays {data.settings.cost_pct}%.
            A large gap means real execution costs eat the model's edge. Live-quote fills: {gap.live_quote_entries} entries, {gap.live_quote_exits} exits.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
