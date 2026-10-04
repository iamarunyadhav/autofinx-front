import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { authorizedFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * Per-symbol ML signal board: one tab per configured coin, one card per
 * horizon (15m…1d) with the STABLE signal, the raw model reading, the
 * model's tested accuracy, and a live training tracker underneath.
 *
 * Read-only. Data comes from GET /quick-trade/ml-autopilot (signals for every
 * coin) and GET /quick-trade/ml-shadow/learning (the selected coin's
 * training detail). Nothing here places, blocks or changes an order.
 */

export type StableState = {
  state: "BUY" | "SELL" | "WAIT" | null; since: string | null; held_minutes: number | null;
  confirming: number; raw_flips: number; window_predictions: number;
};

export type SignalRow = {
  symbol: string; horizon_minutes: number; model_version: string | null; model_type: string | null; tradable: boolean;
  decision: "BUY" | "SELL" | "WAIT" | null; decision_reason: string | null; p_buy: number | null; p_sell: number | null;
  buy_net_pct: number | null; sell_net_pct: number | null; price: number | null;
  signal_time: string | null; signal_age_seconds: number | null;
  stable: StableState; action: string;
  last_training: { status: string; at: string | null; reason: string | null } | null;
  raw_trade_signals: number; trades_taken: number;
};

type Sim = { raw_signals?: number; trades: number; total_net_pct: number; average_net_pct: number | null; net_win_rate_pct: number | null; t_stat?: number | null };

type ModelSummary = {
  model_version: string | null; status: string; trained_at: string | null; training_samples: number | null;
  training_window_from?: string | null;
  holdout: { direction_hit_pct: number | null; non_overlapping?: Sim | null; baselines?: Record<string, Sim> | null };
  decision_reason: string | null;
};

type Evaluation = {
  minimum_samples: number; pending: number;
  forecast: { status: string; samples: number; direction_hit_rate_pct: number | null };
  decision: { status: string; samples: number; net_win_rate_pct: number | null; average_net_pct: number | null };
};

type LearningHorizon = {
  horizon_minutes: number; tradable: boolean;
  training_now: { model_type: string; started_at: string | null } | null;
  labels: { pending: number; mature: number };
  retrain: { eligible: boolean; reason: string; new_mature: number; required: number; mature_total: number };
  last_training: { status: string; model_version: string | null; at: string | null; reason: string | null } | null;
  champion: ModelSummary | null; last_candidate: ModelSummary | null; live_evaluation: Evaluation;
};

type Learning = {
  enabled: boolean; status?: string; next_retrain_at?: string;
  history?: {
    target_months: number; target_candles: number; coverage_pct: number | null;
    backfill: { status: string; pages: number; rows_written: number; cursor: string; updated_at: string | null; range_from: string; last_error: string | null } | null;
  };
  candles?: { collected: number; earliest_open: string | null; latest_close_age_seconds: number | null; rejected: number };
  horizons?: LearningHorizon[];
};

const hz = (m: number) => (m >= 1440 ? `${m / 1440}d` : m >= 60 ? `${m / 60}h` : `${m}m`);
const pct = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}%`);
const plain = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${Number(v).toFixed(d)}%`);
const prob = (v: number | null | undefined) => (v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`);
const dur = (minutes: number | null | undefined) => (minutes == null ? "—" : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`);
const ago = (iso: string | null | undefined) => (iso ? dur(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))) + " ago" : "—");
const until = (iso: string | null | undefined) => (iso ? "in " + dur(Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))) : "—");
const words = (v?: string | null) => (v ? v.replaceAll("_", " ") : "—");
const short = (s: string) => s.replace(/USDT$/, "");

const ACTION: Record<string, string> = {
  traded: "Autopilot traded this signal", pending_entry: "Autopilot enters on next run", skipped_position_open: "Position already open",
  signal_stale: "Latest signal too old", wait: "No trade: model says wait", confirming: "Waiting for confirmation",
  holding_no_fresh_entry: "Stable, waiting for a fresh agreeing signal", display_only: "Display only (not traded)",
  no_signal_yet: "No prediction yet", no_champion: "No champion model",
};

function sideTone(side?: string | null) {
  if (side === "BUY") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (side === "SELL") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  return "border-slate-700 bg-slate-800/50 text-slate-300";
}

/** What the screen should say, in one line. */
function stableHeadline(row: SignalRow, confirm: number): { label: string; sub: string; tone: string } {
  if (!row.model_version) return { label: "No model yet", sub: "Training continues daily", tone: "text-slate-500" };
  const s = row.stable;
  if (s.state === "BUY" || s.state === "SELL") {
    return { label: `Stable ${s.state}`, sub: `holding ${dur(s.held_minutes)}`, tone: s.state === "BUY" ? "text-emerald-300" : "text-rose-300" };
  }
  if (row.decision === "BUY" || row.decision === "SELL") {
    return { label: `WAIT`, sub: `${row.decision} confirming ${Math.min(s.confirming, confirm)}/${confirm}`, tone: "text-amber-300" };
  }
  return { label: "WAIT", sub: s.held_minutes != null ? `no edge for ${dur(s.held_minutes)}` : "no edge after costs", tone: "text-slate-300" };
}

function TrainedBadge({ row, learning }: { row: SignalRow; learning?: LearningHorizon }) {
  if (learning?.training_now) {
    return <Badge variant="outline" className="animate-pulse border-sky-500/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-300" title={`Training started ${ago(learning.training_now.started_at)}`}>Training…</Badge>;
  }
  const last = learning?.last_training ?? row.last_training;
  if (!last || !last.at || last.status === "TRAINING") return <Badge variant="outline" className="border-slate-700 px-1.5 text-[10px] text-slate-500" title="Not trained yet">—</Badge>;
  const failed = last.status === "FAILED";
  return (
    <Badge variant="outline" className={cn("px-1.5 text-[10px] font-bold", failed ? "border-rose-500/40 text-rose-300" : "border-emerald-500/50 bg-emerald-500/15 text-emerald-300")}
      title={`${failed ? "Training failed" : "Trained"} ${ago(last.at)}${last.reason ? ` · ${words(last.reason)}` : ""}`}>
      T
    </Badge>
  );
}

function ModelStatusBadge({ row, learning }: { row: SignalRow; learning?: LearningHorizon }) {
  if (row.model_version) return <Badge variant="outline" className="border-emerald-500/30 px-1.5 text-[10px] text-emerald-300">Champion</Badge>;
  const last = learning?.last_training ?? row.last_training;
  if (last?.status === "REJECTED") return <Badge variant="outline" className="border-amber-500/30 px-1.5 text-[10px] text-amber-300">Rejected</Badge>;
  return null;
}

function Accuracy({ learning }: { learning?: LearningHorizon }) {
  if (!learning) return <div className="text-[11px] text-slate-600">Loading model detail…</div>;
  const model = learning.champion ?? learning.last_candidate;
  const sim = model?.holdout.non_overlapping;
  const live = learning.live_evaluation;
  return (
    <div className="space-y-1 text-[11px] text-slate-400">
      {model && sim ? (
        <div>
          <span className="text-slate-500">{learning.champion ? "Tested" : "Last test"} (unseen data, after costs): </span>
          {sim.trades} trades · win {plain(sim.net_win_rate_pct)} · avg {pct(sim.average_net_pct, 3)}
          {sim.t_stat != null && <> · t {Number(sim.t_stat).toFixed(2)}</>}
        </div>
      ) : <div className="text-slate-600">No tested model yet.</div>}
      {!learning.champion && learning.last_training?.reason && (
        <div className="text-amber-300/80">Why not live: {words(learning.last_training.reason)}</div>
      )}
      <div>
        <span className="text-slate-500">Live scoring: </span>
        {live.forecast.status === "ok" ? `direction ${plain(live.forecast.direction_hit_rate_pct)} (n=${live.forecast.samples})` : `collecting (${live.forecast.samples}/${live.minimum_samples})`}
        {live.decision.status === "ok" && <> · trade win {plain(live.decision.net_win_rate_pct)} · avg {pct(live.decision.average_net_pct, 3)}</>}
      </div>
    </div>
  );
}

function HorizonCard({ row, learning, confirm, showAutopilot }: { row: SignalRow; learning?: LearningHorizon; confirm: number; showAutopilot: boolean }) {
  const head = stableHeadline(row, confirm);
  const stableSide = row.stable.state === "BUY" || row.stable.state === "SELL" ? row.stable.state : null;
  return (
    <div className={cn("rounded-lg border p-3", stableSide ? sideTone(stableSide) : "border-slate-800 bg-slate-900/40", !row.model_version && "opacity-80")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-slate-100">{hz(row.horizon_minutes)}</span>
        <TrainedBadge row={row} learning={learning} />
        <ModelStatusBadge row={row} learning={learning} />
        {!row.tradable && <Badge variant="outline" className="border-slate-700 px-1.5 text-[10px] text-slate-400">display only</Badge>}
        <span className="ml-auto text-[10px] text-slate-500">{row.signal_age_seconds != null ? `${Math.round(row.signal_age_seconds / 60)}m ago` : ""}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-xl font-bold", head.tone)}>{head.label}</span>
        <span className="text-xs text-slate-400">{head.sub}</span>
      </div>

      {row.model_version && (
        <div className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-slate-400">
          <span>P(buy) <span className="text-slate-200">{prob(row.p_buy)}</span></span>
          <span>P(sell) <span className="text-slate-200">{prob(row.p_sell)}</span></span>
          <span>BUY net <span className={Number(row.buy_net_pct) > 0 ? "text-emerald-300" : "text-slate-300"}>{pct(row.buy_net_pct, 3)}</span></span>
          <span>SELL net <span className={Number(row.sell_net_pct) > 0 ? "text-emerald-300" : "text-slate-300"}>{pct(row.sell_net_pct, 3)}</span></span>
          <span className="col-span-2 text-slate-500">raw now: {row.decision ?? "—"} · {row.stable.raw_flips} raw flips in last {row.stable.window_predictions} readings</span>
        </div>
      )}

      <div className="mt-2 border-t border-slate-800/80 pt-2"><Accuracy learning={learning} /></div>

      {showAutopilot && row.model_version && (
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-slate-300">{ACTION[row.action] ?? words(row.action)}</span>
          <span className="text-slate-500">{row.trades_taken} taken</span>
        </div>
      )}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

function TrainingTracker({ learning }: { learning?: Learning }) {
  if (!learning?.candles || !learning.history) return null;
  const h = learning.history;
  const running = (learning.horizons ?? []).filter((x) => x.training_now);
  const backfillActive = h.backfill?.status === "RUNNING";
  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-[11px] text-slate-300">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-emerald-300">Training tracker</span>
        {running.length > 0
          ? <Badge variant="outline" className="animate-pulse border-sky-500/40 text-[10px] text-sky-300">training {running.map((r) => hz(r.horizon_minutes)).join(", ")} now</Badge>
          : <span className="text-slate-500">next retrain {until(learning.next_retrain_at)}</span>}
        {backfillActive && <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-300">history download running</Badge>}
      </div>
      <div className="mb-1 flex justify-between">
        <span>Candles collected: <span className="font-semibold text-emerald-300 tabular-nums">{learning.candles.collected.toLocaleString()}</span> / {h.target_candles.toLocaleString()} ({h.target_months / 12} years)</span>
        <span className="tabular-nums text-emerald-300">{plain(h.coverage_pct)}</span>
      </div>
      <Bar value={h.coverage_pct ?? 0} />
      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-slate-500">
        <span>from {learning.candles.earliest_open ? new Date(learning.candles.earliest_open).toLocaleDateString() : "—"} · newest candle {learning.candles.latest_close_age_seconds != null ? `${Math.round(learning.candles.latest_close_age_seconds / 60)}m` : "—"} old</span>
        {h.backfill && <span>download: {words(h.backfill.status).toLowerCase()} · at {new Date(h.backfill.cursor).toLocaleDateString()}{h.backfill.last_error ? " · error" : ""}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(learning.horizons ?? []).map((x) => (
          <div key={x.horizon_minutes} className="rounded border border-slate-800 bg-slate-950/50 p-1.5">
            <div className="flex justify-between"><span className="font-medium text-slate-200">{hz(x.horizon_minutes)}</span><span className="text-slate-500">{x.last_training?.at ? ago(x.last_training.at) : "never"}</span></div>
            <div className="tabular-nums text-slate-400">{x.labels.mature.toLocaleString()} learned rows</div>
            <div className="text-slate-500">{x.retrain.eligible ? "ready to retrain" : words(x.retrain.reason)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MlSignalsBoard({ workspaceId, signals, confirm, showAutopilot }: { workspaceId?: string; signals: SignalRow[]; confirm: number; showAutopilot: boolean }) {
  const symbols = Array.from(new Set(signals.map((s) => s.symbol)));
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const active = selected && symbols.includes(selected) ? selected : symbols[0];
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ml-board-symbol");
      if (saved) setSelected(saved);
    } catch { /* storage unavailable: default to the first coin */ }
  }, []);
  const choose = (symbol: string) => {
    setSelected(symbol);
    try { localStorage.setItem("ml-board-symbol", symbol); } catch { /* ignore */ }
  };

  const learning = useQuery({
    queryKey: ["ml-shadow-learning", workspaceId, active],
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow/learning", "GET", undefined, { params: { workspace_id: workspaceId, symbol: active } }) as Promise<Learning>,
    enabled: Boolean(workspaceId && active),
    refetchInterval: 30_000,
    retry: false,
  });
  const byHorizon = new Map((learning.data?.horizons ?? []).map((h) => [h.horizon_minutes, h]));
  const rows = signals.filter((s) => s.symbol === active);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Coins">
        {symbols.map((symbol) => {
          const coin = signals.filter((s) => s.symbol === symbol);
          const champions = coin.filter((s) => s.model_version).length;
          const trained = coin.filter((s) => s.last_training?.at).length;
          const live = coin.find((s) => s.stable.state === "BUY" || s.stable.state === "SELL");
          return (
            <button key={symbol} role="tab" aria-selected={symbol === active} onClick={() => choose(symbol)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                symbol === active ? "border-sky-500/50 bg-sky-500/10 text-sky-200" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200")}>
              {short(symbol)}
              {trained > 0 && <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-300" title={`${trained}/${coin.length} horizons trained`}>T</span>}
              {champions > 0 && <span className="text-[10px] text-slate-500">{champions}★</span>}
              {live && <span className={cn("h-1.5 w-1.5 rounded-full", live.stable.state === "BUY" ? "bg-emerald-400" : "bg-rose-400")} title={`Stable ${live.stable.state} on ${hz(live.horizon_minutes)}`} />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <HorizonCard key={row.horizon_minutes} row={row} learning={byHorizon.get(row.horizon_minutes)} confirm={confirm} showAutopilot={showAutopilot} />
        ))}
      </div>

      <TrainingTracker learning={learning.data} />
    </div>
  );
}
