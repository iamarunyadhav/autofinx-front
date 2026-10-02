import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { authorizedFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * Quick Trade Python ML — Phase 1 shadow card.
 *
 * Shows ONLY what the backend's python champion for the selected duration
 * produced (GET /quick-trade/ml-shadow). Nothing here is borrowed from the
 * Primary/Unified forecast, a different horizon's model is never relabelled,
 * and nothing on this card feeds order placement.
 */

type ForecastMetrics = { status: "ok" | "insufficient_data"; samples: number; directional_samples: number; direction_hit_rate_pct: number | null; mae_pct: number | null };
type DecisionMetrics = { status: "ok" | "insufficient_data"; samples: number; wait_samples: number; net_win_rate_pct: number | null; average_net_pct: number | null };
type LiveEvaluation = { minimum_samples: number; pending: number; forecast: ForecastMetrics; decision: DecisionMetrics };

type SimResult = { raw_signals?: number; trades: number; total_net_pct: number; average_net_pct: number | null; net_win_rate_pct: number | null };

type ModelSummary = {
  model_version: string | null;
  model_type?: "regression" | "side_classifier";
  status: string;
  trained_at: string | null;
  promoted_at: string | null;
  training_samples: number;
  holdout_samples: number;
  holdout: {
    mae_pct: number | null; baseline_zero_mae_pct: number | null; direction_hit_pct: number | null;
    fee_aware?: { trade_count?: number; average_net_pct?: number | null; total_net_pct?: number | null } | null;
    non_overlapping?: SimResult | null;
    baselines?: { never_trade?: SimResult; always_buy?: SimResult; always_sell?: SimResult } | null;
    effective_samples?: number | null;
  };
  calibration: { state: string; holdout_interval_coverage_pct?: number | null; target_coverage_pct?: number; sides?: Record<string, { brier: number | null; brier_climatology: number | null; state: string }> };
  decision_reason: string | null;
  comparison?: Record<string, unknown> | null;
};

type MlShadowPayload = {
  enabled?: boolean;
  status: "DISABLED" | "UNSUPPORTED_SYMBOL" | "UNSUPPORTED_DURATION" | "COST_EXCEEDS_MOVE" | "NO_CHAMPION" | "NO_PREDICTION_YET" | "READY" | "DATA_STALE";
  message?: string;
  horizon_minutes?: number | null;
  supported_horizons_minutes?: number[];
  supported_symbols?: string[];
  model?: ModelSummary | null;
  live_evaluation?: LiveEvaluation;
  prediction?: {
    anchor_time: string;
    target_time: string;
    data_age_seconds: number;
    current_price: number;
    predicted_expiry_price: number | null;
    predicted_low: number | null;
    predicted_high: number | null;
    expected_move_pct: number | null;
    model_type?: "regression" | "side_classifier";
    p_buy?: number | null;
    p_sell?: number | null;
    probability_floor?: number | null;
    funding_estimate_buy_pct?: number | null;
    buy_net_pct: number | null;
    sell_net_pct: number | null;
    cost_pct: number | null;
    required_move_pct: number | null;
    decision: "BUY" | "SELL" | "WAIT";
    decision_reason: string | null;
    model_version: string | null;
    training_samples: number | null;
  };
};

type LearningHorizon = {
  horizon_minutes: number;
  labels: { pending: number; mature: number };
  retrain: { eligible: boolean; reason: string; new_mature: number; required: number; mature_total: number };
  last_training: { status: string; model_version: string | null; at: string | null; reason: string | null } | null;
  champion: ModelSummary | null;
  last_candidate: ModelSummary | null;
  live_evaluation: LiveEvaluation;
};

type LearningPayload = {
  enabled: boolean;
  status?: string;
  candles?: { collected: number; earliest_open: string | null; latest_close: string | null; latest_close_age_seconds: number | null; rejected: number; rejections_by_reason: Record<string, { total: number; unresolved: number }> };
  horizons?: LearningHorizon[];
};

const pct = (value: number | null | undefined, digits = 3) => (value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`);
const prob = (value: number | null | undefined) => (value == null ? "—" : `${(value * 100).toFixed(1)}%`);
const price = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 2 }));
const words = (value?: string | null) => (value ? value.replaceAll("_", " ") : "—");
const age = (seconds?: number | null) => (seconds == null ? "—" : seconds < 120 ? `${seconds}s` : `${Math.round(seconds / 60)}m`);

function decisionClass(value?: string | null): string {
  if (value === "BUY") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (value === "SELL") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div><div className="text-[11px] text-slate-500">{label}</div><div className={cn("mt-0.5 text-sm font-medium text-slate-200", tone)}>{value}</div></div>;
}

function LiveEvaluationLine({ evaluation }: { evaluation?: LiveEvaluation }) {
  if (!evaluation) return null;
  const { forecast, decision, minimum_samples: min } = evaluation;
  return <div className="grid gap-2 text-[11px] text-slate-400 md:grid-cols-2">
    <div>Live forecast (scored at expiry): {forecast.status === "ok"
      ? `direction hit ${forecast.direction_hit_rate_pct?.toFixed(1) ?? "—"}% · MAE ${forecast.mae_pct?.toFixed(3) ?? "—"}% · n=${forecast.samples}`
      : `insufficient data (n=${forecast.samples}/${min})`}</div>
    <div>Live fee-aware decisions: {decision.status === "ok"
      ? `net win ${decision.net_win_rate_pct?.toFixed(1) ?? "—"}% · avg net ${pct(decision.average_net_pct)} · n=${decision.samples}`
      : `insufficient data (n=${decision.samples}/${min})`}{evaluation.pending > 0 ? ` · ${evaluation.pending} pending` : ""}</div>
  </div>;
}

function LearningPanel({ symbol, workspaceId }: { symbol: string; workspaceId?: string }) {
  const query = useQuery({
    queryKey: ["ml-shadow-learning", workspaceId, symbol],
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow/learning", "GET", undefined, { params: { workspace_id: workspaceId, symbol } }) as Promise<LearningPayload>,
    enabled: Boolean(workspaceId && symbol),
    refetchInterval: 60_000,
    retry: false,
  });
  const data = query.data;
  if (query.isLoading) return <div className="text-[11px] text-slate-500">Loading learning status…</div>;
  if (!data?.candles) return <div className="text-[11px] text-slate-500">Learning status unavailable.</div>;
  const rejections = Object.entries(data.candles.rejections_by_reason);

  return <div className="space-y-2 text-[11px] text-slate-400">
    <div className="grid gap-2 md:grid-cols-3">
      <span>Closed candles: {data.candles.collected.toLocaleString()} (latest close {age(data.candles.latest_close_age_seconds)} ago)</span>
      <span>Rejected: {data.candles.rejected.toLocaleString()}{rejections.length ? ` · ${rejections.map(([reason, row]) => `${words(reason)} ${row.total}${row.unresolved ? ` (${row.unresolved} open)` : ""}`).join(", ")}` : ""}</span>
      <span>History from: {data.candles.earliest_open ? new Date(data.candles.earliest_open).toLocaleDateString() : "—"}</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead className="text-slate-500"><tr><th className="py-1 pr-2">Horizon</th><th className="pr-2">Labels pending / mature</th><th className="pr-2">Retrain</th><th className="pr-2">Last training</th><th className="pr-2">Champion</th><th>Last candidate</th></tr></thead>
        <tbody>{(data.horizons ?? []).map((row) => <tr key={row.horizon_minutes} className="border-t border-slate-800 align-top">
          <td className="py-1 pr-2 text-slate-300">{row.horizon_minutes}m</td>
          <td className="pr-2">{row.labels.pending.toLocaleString()} / {row.labels.mature.toLocaleString()}</td>
          <td className="pr-2">{row.retrain.eligible ? "eligible" : words(row.retrain.reason)} ({row.retrain.new_mature.toLocaleString()}/{row.retrain.required.toLocaleString()} new)</td>
          <td className="pr-2">{row.last_training ? `${words(row.last_training.status)}${row.last_training.at ? ` · ${new Date(row.last_training.at).toLocaleString()}` : ""}` : "never"}</td>
          <td className="pr-2">{row.champion ? `${row.champion.model_version} · MAE ${row.champion.holdout.mae_pct?.toFixed(3) ?? "—"}%` : "none"}</td>
          <td>{row.last_candidate ? `${row.last_candidate.model_version} · ${words(row.last_candidate.status)} · ${words(row.last_candidate.decision_reason)}` : "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export function MlShadowCard({ symbol, durationSeconds, workspaceId }: { symbol: string; durationSeconds: number; workspaceId?: string }) {
  const [showLearning, setShowLearning] = useState(false);
  const query = useQuery({
    queryKey: ["ml-shadow", workspaceId, symbol, durationSeconds],
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow", "GET", undefined, { params: { workspace_id: workspaceId, symbol, duration_seconds: durationSeconds } }) as Promise<MlShadowPayload>,
    enabled: Boolean(workspaceId && symbol && durationSeconds),
    refetchInterval: 30_000,
    retry: false,
  });
  const data = query.data;
  const p = data?.prediction;
  const horizonLabel = data?.horizon_minutes ? `${data.horizon_minutes}m model` : `${Math.round(durationSeconds / 60)}m`;
  const supported = (data?.supported_horizons_minutes ?? [60, 120, 240, 1440]).map((h) => `${h}m`).join(" / ");

  let notice: string | null = null;
  if (query.isError) notice = "Python ML shadow status could not be loaded.";
  else if (!data) notice = query.isLoading ? "Loading Python ML shadow…" : null;
  else if (data.status === "DISABLED") notice = "Python ML shadow learning is disabled on the server.";
  else if (data.status === "UNSUPPORTED_SYMBOL") notice = `No Python ML model for this symbol. Shadow learning covers ${(data.supported_symbols ?? []).join(", ")}.`;
  else if (data.status === "COST_EXCEEDS_MOVE") notice = data.message ?? "No model for this expiry: trading costs exceed the typical price move at this horizon.";
  else if (data.status === "UNSUPPORTED_DURATION") notice = `No Python model for this expiry. Models exist for ${supported} only; another horizon's model is never shown in its place.`;
  else if (data.status === "NO_CHAMPION") notice = `No validated ${horizonLabel} for ${symbol} yet. A model is shown only after it is profitable after fees and funding on unseen data, one position at a time, and beats always-BUY / always-SELL.`;
  else if (data.status === "NO_PREDICTION_YET") notice = "Champion ready; waiting for the next closed 5m candle to produce a shadow prediction.";

  return <div className="space-y-3 rounded-2xl border border-violet-900/60 bg-slate-950/60 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="text-xs uppercase tracking-wide text-violet-300">Python ML Shadow · {horizonLabel}</div>
        <div className="text-[11px] text-slate-500">Closed Binance Futures candles only. Decision support only; never places, blocks, or changes an order.</div>
      </div>
      <Badge variant="outline" className="border-violet-800 text-[10px] text-violet-300">Shadow only</Badge>
    </div>

    {notice && <div className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-xs text-slate-400">{notice}</div>}

    {p && (data?.status === "READY" || data?.status === "DATA_STALE") && <>
      {data.status === "DATA_STALE" && <div className="rounded-md border border-amber-900/70 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-300">WAIT · DATA STALE: the newest shadow prediction is {age(p.data_age_seconds)} old. Values below are historical, not current.</div>}
      {p.model_type === "side_classifier" ? <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div><div className="text-[11px] text-slate-500">Shadow decision</div><Badge variant="outline" className={cn("mt-1 text-sm", decisionClass(p.decision))}>{p.decision}</Badge></div>
        <Metric label="Price at prediction" value={price(p.current_price)} />
        <Metric label="P(BUY wins after costs)" value={prob(p.p_buy)} tone={(p.p_buy ?? 0) >= (p.probability_floor ?? 1) ? "text-emerald-300" : undefined} />
        <Metric label="P(SELL wins after costs)" value={prob(p.p_sell)} tone={(p.p_sell ?? 0) >= (p.probability_floor ?? 1) ? "text-emerald-300" : undefined} />
        <Metric label="Probability floor" value={prob(p.probability_floor)} />
        <Metric label="Data age" value={age(p.data_age_seconds)} />
      </div> : <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div><div className="text-[11px] text-slate-500">Shadow decision</div><Badge variant="outline" className={cn("mt-1 text-sm", decisionClass(p.decision))}>{p.decision}</Badge></div>
        <Metric label="Price at prediction" value={price(p.current_price)} />
        <Metric label="Predicted expiry price" value={price(p.predicted_expiry_price)} />
        <Metric label="Low / high (p10–p90)" value={p.predicted_low == null ? "—" : `${price(p.predicted_low)} / ${price(p.predicted_high)}`} />
        <Metric label="Expected move" value={pct(p.expected_move_pct)} />
        <Metric label="Data age" value={age(p.data_age_seconds)} />
      </div>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label={p.model_type === "side_classifier" ? "BUY expected net" : "BUY net (after costs)"} value={pct(p.buy_net_pct)} tone={(p.buy_net_pct ?? 0) > 0 ? "text-emerald-300" : "text-slate-300"} />
        <Metric label={p.model_type === "side_classifier" ? "SELL expected net" : "SELL net (after costs)"} value={pct(p.sell_net_pct)} tone={(p.sell_net_pct ?? 0) > 0 ? "text-emerald-300" : "text-slate-300"} />
        <Metric label="Cost / required move" value={`${p.cost_pct?.toFixed(3) ?? "—"}% / ${p.required_move_pct?.toFixed(3) ?? "—"}%`} />
        <Metric label="Funding est. (long pays)" value={pct(p.funding_estimate_buy_pct, 4)} />
      </div>
      <div className="text-[11px] text-slate-500">Reason: {words(p.decision_reason)} · Fees from the Quick Trade cost model, charged once; funding: longs pay, shorts receive.</div>
    </>}

    {data?.model && <div className="grid gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400 md:grid-cols-3">
      <span>Model: {data.model.model_version} · {data.model.training_samples.toLocaleString()} training samples</span>
      <span>Holdout MAE {data.model.holdout.mae_pct?.toFixed(3) ?? "—"}% vs zero-baseline {data.model.holdout.baseline_zero_mae_pct?.toFixed(3) ?? "—"}% (n={data.model.holdout_samples.toLocaleString()})</span>
      <span>Calibration: {words(data.model.calibration.state)}{data.model.calibration.holdout_interval_coverage_pct != null ? ` · p10–p90 covered ${data.model.calibration.holdout_interval_coverage_pct.toFixed(1)}% (target ${data.model.calibration.target_coverage_pct}%)` : ""}{data.model.calibration.sides ? ` · Brier buy ${data.model.calibration.sides.buy?.brier?.toFixed(3) ?? "—"} / sell ${data.model.calibration.sides.sell?.brier?.toFixed(3) ?? "—"}` : ""}</span>
      {data.model.holdout.non_overlapping && <span className="md:col-span-3">Holdout, one position at a time (after fees + funding): {data.model.holdout.non_overlapping.trades} trades of {data.model.holdout.non_overlapping.raw_signals ?? "—"} raw signals · net {pct(data.model.holdout.non_overlapping.total_net_pct, 2)} · win {data.model.holdout.non_overlapping.net_win_rate_pct?.toFixed(1) ?? "—"}% · vs always-BUY {pct(data.model.holdout.baselines?.always_buy?.total_net_pct, 2)} / always-SELL {pct(data.model.holdout.baselines?.always_sell?.total_net_pct, 2)} · ~{Math.round(data.model.holdout.effective_samples ?? 0)} independent outcomes</span>}
    </div>}

    <LiveEvaluationLine evaluation={data?.live_evaluation} />

    {data && data.status !== "DISABLED" && data.status !== "UNSUPPORTED_SYMBOL" && <div>
      <button type="button" className="text-[11px] text-violet-300 hover:text-violet-200" onClick={() => setShowLearning((value) => !value)}>
        {showLearning ? "Hide learning status" : "Show learning status"}
      </button>
      {showLearning && <div className="mt-2"><LearningPanel symbol={symbol} workspaceId={workspaceId} /></div>}
    </div>}
  </div>;
}
