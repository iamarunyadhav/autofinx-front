import { MlApiError } from "@/lib/mlTraining";
import type {
  MlAlert,
  MlCandle,
  MlCandlesResponse,
  MlHorizonRow,
  MlModelRow,
  MlOverview,
  MlRunDetail,
  MlRunPhase,
  MlRunStatus,
  MlRunSummary,
  MlSymbolOverview,
  MlSystem,
} from "@/types/mlTraining";

/*
 * DEV ONLY. Contract-shaped fixtures for the ML Training dashboard, used when
 * VITE_ML_TRAINING_MOCK=true (see useMlTraining.ts, the only importer, behind
 * a dynamic import that is dead code in a normal build). Includes a RUNNING
 * run, a STALLED one, a FAILED one with an auto-retry countdown, a REJECTED
 * and a CHAMPION run. Mutations edit an in-memory list so the UI can be
 * exercised end to end. Nothing here talks to the network.
 */

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
const HORIZONS = [15, 60, 120, 240, 1440];
const PRESETS: Record<string, number[]> = { long: [240, 1440], mid: [120, 60], short: [15] };
const STALL_SECONDS = 180;

interface MockRun {
  id: string;
  symbol: string;
  horizon: number;
  status: MlRunStatus;
  outcome: "CHAMPION" | "REJECTED" | null;
  reason: string | null;
  phase: MlRunPhase;
  progress: number | null;
  source: "ui" | "scheduler" | "cli";
  attempt: number;
  retryOf: string | null;
  batchId: string | null;
  queuedMs: number;
  startedMs: number | null;
  /** null with status RUNNING = a healthy worker that heartbeats every few seconds. */
  heartbeatMs: number | null;
  finishedMs: number | null;
  nextRetryMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  rows: number | null;
  log: string[];
}

const ago = (seconds: number) => Date.now() - seconds * 1000;
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
let counter = 100;
const nextId = () => `0199mock-${(counter++).toString(16).padStart(4, "0")}`;

const LOG = [
  "[export] reading ml_feature_rows ...",
  "[export] 412,880 rows written to /tmp/ml/export.csv",
  "[fit] lightgbm classifier, 5 walk-forward folds",
  "[fit] fold 1/5 done in 41s",
  "[fit] fold 2/5 done in 44s",
];

function seed(): MockRun[] {
  const base = {
    outcome: null, reason: null, source: "scheduler" as const, attempt: 1, retryOf: null, batchId: null,
    startedMs: null, heartbeatMs: null, finishedMs: null, nextRetryMs: null, errorCode: null, errorMessage: null,
    rows: null, log: LOG, progress: null as number | null,
  };
  return [
    { ...base, id: "0199mock-0001", symbol: "BTCUSDT", horizon: 60, status: "RUNNING", phase: "fitting", progress: 42, source: "ui", queuedMs: ago(300), startedMs: ago(240), heartbeatMs: null, rows: 412880 },
    { ...base, id: "0199mock-0002", symbol: "ETHUSDT", horizon: 240, status: "RUNNING", phase: "fitting", progress: 18, source: "cli", queuedMs: ago(1500), startedMs: ago(1400), heartbeatMs: ago(420), rows: 380112 },
    {
      ...base, id: "0199mock-0003", symbol: "SOLUSDT", horizon: 15, status: "FAILED", phase: "fitting", queuedMs: ago(900), startedMs: ago(700), heartbeatMs: ago(100),
      finishedMs: ago(60), nextRetryMs: Date.now() + 90_000, errorCode: "python_crashed", errorMessage: "Trainer process exited with code 137 (killed, probably out of memory).", rows: 120400,
    },
    {
      ...base, id: "0199mock-0004", symbol: "BTCUSDT", horizon: 240, status: "FINISHED", outcome: "REJECTED", reason: "holdout_net_not_positive_after_costs", phase: "done",
      queuedMs: ago(7300), startedMs: ago(7200), heartbeatMs: ago(3700), finishedMs: ago(3600), rows: 398000, progress: 100,
    },
    {
      ...base, id: "0199mock-0005", symbol: "ETHUSDT", horizon: 60, status: "FINISHED", outcome: "CHAMPION", reason: "classifier_passed_fee_aware_gate", phase: "done",
      queuedMs: ago(9000), startedMs: ago(8900), heartbeatMs: ago(8000), finishedMs: ago(7900), rows: 401500, progress: 100,
    },
    { ...base, id: "0199mock-0006", symbol: "BNBUSDT", horizon: 120, status: "QUEUED", phase: "queued", source: "ui", queuedMs: ago(30) },
    {
      ...base, id: "0199mock-0007", symbol: "SOLUSDT", horizon: 60, status: "INTERRUPTED", phase: "fitting", queuedMs: ago(20000), startedMs: ago(19900), heartbeatMs: ago(19000),
      finishedMs: ago(18500), errorCode: "interrupted", errorMessage: "Worker restarted mid-run.",
    },
    {
      ...base, id: "0199mock-0008", symbol: "BNBUSDT", horizon: 15, status: "STOPPED", phase: "fitting", source: "ui", queuedMs: ago(40000), startedMs: ago(39900),
      heartbeatMs: ago(39000), finishedMs: ago(38900), errorCode: "cancelled_by_operator",
    },
  ] as MockRun[];
}

let runs: MockRun[] | null = null;
const state = () => (runs ??= seed());

const isActive = (r: MockRun) => r.status === "QUEUED" || r.status === "RUNNING";

function summarize(r: MockRun): MlRunSummary {
  const now = Date.now();
  const live = r.status === "RUNNING" && r.heartbeatMs === null;
  const heartbeatMs = live ? now - 3000 : r.heartbeatMs;
  const end = r.finishedMs ?? now;
  const elapsed = r.startedMs ? (end - r.startedMs) / 1000 : null;
  const progress = live && r.progress != null && r.startedMs ? Math.min(95, r.progress + ((now - r.startedMs) / 1000 - 240) * 0.2) : r.progress;
  const retryable = ["FAILED", "STOPPED", "INTERRUPTED"].includes(r.status) && !runs?.some((x) => x.retryOf === r.id);
  return {
    id: r.id, symbol: r.symbol, horizon_minutes: r.horizon, model_type: "classifier", status: r.status, outcome: r.outcome, outcome_reason: r.reason, phase: r.phase,
    progress_pct: progress, source: r.source, triggered_by: r.source === "ui" ? "user-1" : null, batch_id: r.batchId, attempt: r.attempt, max_attempts: 3, retry_of: r.retryOf,
    next_retry_at: iso(r.nextRetryMs), queued_at: iso(r.queuedMs), started_at: iso(r.startedMs), heartbeat_at: iso(heartbeatMs),
    heartbeat_age_seconds: r.status === "RUNNING" && heartbeatMs ? (now - heartbeatMs) / 1000 : null, finished_at: iso(r.finishedMs),
    elapsed_seconds: elapsed, eta_seconds: r.status === "RUNNING" ? Math.max(30, 1800 - (elapsed ?? 0)) : null, rows_exported: r.rows,
    error_code: r.errorCode, error_message: r.errorMessage, can_stop: isActive(r), can_retry: retryable, model_id: r.outcome ? `model-${r.id}` : null,
  };
}

function overview(): MlOverview {
  const list = state();
  const symbols: MlSymbolOverview[] = SYMBOLS.map((symbol, i) => {
    const horizons: MlHorizonRow[] = HORIZONS.map((h) => {
      const mine = list.filter((r) => r.symbol === symbol && r.horizon === h);
      const active = mine.find(isActive);
      const finished = mine.filter((r) => r.finishedMs).sort((a, b) => (b.finishedMs ?? 0) - (a.finishedMs ?? 0))[0];
      const champ = mine.find((r) => r.outcome === "CHAMPION");
      return {
        horizon_minutes: h,
        tradable: h !== 1440,
        champion: champ ? { model_version: `v-${symbol}-${h}-20261001`, trained_at: iso(champ.finishedMs) } : null,
        last_run: finished ? { id: finished.id, status: finished.status, outcome: finished.outcome, outcome_reason: finished.reason, finished_at: iso(finished.finishedMs) } : null,
        active_run: active ? (() => { const s = summarize(active); return { id: s.id, status: s.status, phase: s.phase, progress_pct: s.progress_pct, started_at: s.started_at, heartbeat_age_seconds: s.heartbeat_age_seconds }; })() : null,
        retrain: { eligible: h === 15, reason: h === 15 ? null : "not_enough_new_labels", new_mature: h === 15 ? 5200 : 310, required: 2000 },
      };
    });
    const candleState = (["live", "lagging", "stale", "missing"] as const)[i];
    return {
      symbol,
      candles: candleState === "missing"
        ? { state: "missing", latest_close: null, age_seconds: null, collected: 0, target: 1_051_200, coverage_pct: 0, rejected: 0 }
        : { state: candleState, latest_close: [67210.5, 3510.2, 148.77][i], age_seconds: [20, 240, 5400][i], collected: [1_040_000, 880_000, 410_000][i], target: 1_051_200, coverage_pct: [98.9, 83.7, 39][i], rejected: [3, 0, 120][i] },
      backfill: i === 3
        ? { status: "FAILED", pages: 12, rows_written: 12000, cursor: iso(ago(86400 * 400)), updated_at: iso(ago(7200)), last_error: "HTTP 429 from exchange: rate limited" }
        : i === 2
          ? { status: "RUNNING", pages: 300, rows_written: 300000, cursor: iso(ago(86400 * 200)), updated_at: iso(ago(30)), last_error: null }
          : { status: "COMPLETED", pages: 1040, rows_written: 1040000, cursor: iso(ago(86400 * 730)), updated_at: iso(ago(86400)), last_error: null },
      features: { rows: [980000, 850000, 300000, 0][i], state: (["ok", "ok", "building", "missing"] as const)[i] },
      labels: { pending: [1200, 800, 5000, 0][i], mature: [890000, 760000, 210000, 0][i] },
      funding: { latest: [0.0001, 0.00008, null, null][i], state: (["ok", "ok", "stale", "missing"] as const)[i] },
      horizons,
    };
  });
  const alerts: MlAlert[] = [
    { id: "a1", severity: "critical", code: "run_stalled", title: "ETH 4h run has no heartbeat", detail: "No heartbeat for 7 minutes. It will be marked interrupted shortly.", symbol: "ETHUSDT", horizon_minutes: 240, since: iso(ago(420)), action: { type: "open_run", run_id: "0199mock-0002" } },
    { id: "a2", severity: "warning", code: "run_failed", title: "SOL 15m run failed", detail: "Trainer killed (out of memory). An automatic retry is scheduled.", symbol: "SOLUSDT", horizon_minutes: 15, since: iso(ago(60)), action: { type: "retry_run", run_id: "0199mock-0003" } },
    { id: "a3", severity: "warning", code: "backfill_failed", title: "BNB history download failed", detail: "HTTP 429 from exchange: rate limited", symbol: "BNBUSDT", since: iso(ago(7200)), action: { type: "resume_backfill", symbol: "BNBUSDT" } },
    { id: "a4", severity: "info", code: "candles_stale", title: "SOL candles are 90 minutes old", symbol: "SOLUSDT", since: iso(ago(5400)) },
  ];
  return {
    generated_at: new Date().toISOString(), enabled: true, mode: "shadow_only", counts_as_of: iso(ago(180)), alerts, symbols,
    active_runs: list.filter(isActive).map(summarize),
    queue: { pending: list.filter((r) => r.status === "QUEUED").length, reserved: list.filter((r) => r.status === "RUNNING").length, failed: 2 },
    pipeline_jobs: [
      { command: "ml:candles:collect", last_started_at: iso(ago(40)), last_status: "ok", age_seconds: 40, state: "ok" },
      { command: "ml:features:build", last_started_at: iso(ago(1300)), last_status: "ok", age_seconds: 1300, state: "late" },
      { command: "ml:training:reap", last_started_at: iso(ago(70)), last_status: "ok", age_seconds: 70, state: "ok" },
      { command: "ml:labels:mature", last_started_at: null, last_status: null, age_seconds: null, state: "never" },
    ],
  };
}

function candles(symbol: string, limit: number): MlCandlesResponse {
  if (!SYMBOLS.includes(symbol)) throw new MlApiError("Unknown symbol", 422, "unknown_symbol");
  const i = SYMBOLS.indexOf(symbol);
  const price0 = [67000, 3500, 148, 590][i];
  const ageSeconds = [20, 240, 5400, 0][i];
  const lastOpen = Math.floor((Date.now() - ageSeconds * 1000) / 60000) * 60000 - 60000;
  const out: MlCandle[] = [];
  let p = price0;
  let seed = (i + 1) * 9301;
  const rnd = () => ((seed = (seed * 49297 + 233280) % 233280) / 233280) - 0.5;
  const n = Math.min(Math.max(limit, 1), 500);
  for (let k = n - 1; k >= 0; k--) {
    const o = p;
    const c = o * (1 + rnd() * 0.002);
    out.push({ t: lastOpen - k * 60000, o, h: Math.max(o, c) * 1.0006, l: Math.min(o, c) * 0.9994, c, v: 20 + Math.abs(rnd()) * 100 });
    p = c;
  }
  return { symbol, timeframe: "1m", generated_at: new Date().toISOString(), latest_close: i === 3 ? null : out[out.length - 1].c, age_seconds: i === 3 ? null : ageSeconds, state: (["live", "lagging", "stale", "missing"] as const)[i], candles: i === 3 ? [] : out };
}

function models(params: Record<string, unknown>): { data: MlModelRow[] } {
  const rows: MlModelRow[] = [];
  for (const symbol of SYMBOLS.slice(0, 3)) {
    for (const h of HORIZONS) {
      const champion = (symbol === "ETHUSDT" && h === 60) || (symbol === "BTCUSDT" && h === 15);
      rows.push({
        model_version: `v-${symbol}-${h}-20261001`, symbol, horizon_minutes: h, model_type: "classifier", status: champion ? "CHAMPION" : "REJECTED",
        decision_reason: champion ? "classifier_passed_fee_aware_gate" : "holdout_net_not_positive_after_costs", trained_at: iso(ago(3600 * (h % 7 + 2))), promoted_at: champion ? iso(ago(3500)) : null,
        samples: { total: 400000, train: 320000, holdout: 80000 },
        holdout_summary: { trades: champion ? 64 : 12, net_win_rate_pct: champion ? 57.3 : 41.7, average_net_pct: champion ? 0.18 : -0.04, total_net_pct: champion ? 11.5 : -0.5, t_stat: champion ? 2.4 : 0.3 },
        comparison: champion ? { champion_total_net_pct: 6.2, candidate_total_net_pct: 11.5 } : null,
      });
    }
  }
  const sym = params.symbol ? String(params.symbol) : null;
  const hz = params.horizon_minutes ? Number(params.horizon_minutes) : null;
  return { data: rows.filter((m) => (!sym || m.symbol === sym) && (!hz || m.horizon_minutes === hz)) };
}

function system(): MlSystem {
  return {
    generated_at: new Date().toISOString(),
    host: { cores: 4, load: { m1: 6.4, m5: 5.1, m15: 4.2 }, memory: { total_mb: 7900, available_mb: 420, used_pct: 94.7 }, swap: { total_mb: 4096, used_mb: 3300, used_pct: 80.6 }, disk: { path: "/", free_gb: 18.4, used_pct: 71 } },
    health: { level: "critical", reasons: ["Swap is 81% used: training will be very slow", "Load is 1.6 per core"] },
    queue: {
      connection: "ml_training", name: "ml_training", pending: 1, reserved: 1,
      failed_recent: [
        { id: "f1", failed_at: iso(ago(60)), symbol: "SOLUSDT", horizon_minutes: 15, summary: "Trainer process exited with code 137" },
        { id: "f2", failed_at: iso(ago(86400)), symbol: "BNBUSDT", horizon_minutes: 15, summary: "TimeoutException: job exceeded 1920 seconds" },
      ],
    },
    training: { timeout_seconds: 1800, stall_seconds: STALL_SECONDS, auto_retry: true, max_attempts: 3 },
    thresholds: { load_per_core_warn: 1.0, load_per_core_critical: 1.5, swap_used_pct_warn: 25, swap_used_pct_critical: 60, disk_free_gb_warn: 5 },
  };
}

function find(id: string): MockRun {
  const run = state().find((r) => r.id === id);
  if (!run) throw new MlApiError("Run not found", 404);
  return run;
}

function create(symbol: string, horizon: number, extra: Partial<MockRun> = {}): MockRun {
  if (!SYMBOLS.includes(symbol)) throw new MlApiError("Unknown symbol", 422, "unknown_symbol");
  if (!HORIZONS.includes(horizon)) throw new MlApiError("Unknown horizon", 422, "unknown_horizon");
  if (state().some((r) => r.symbol === symbol && r.horizon === horizon && isActive(r))) throw new MlApiError("Already active", 422, "already_active");
  const run: MockRun = {
    id: nextId(), symbol, horizon, status: "QUEUED", outcome: null, reason: null, phase: "queued", progress: null, source: "ui", attempt: 1, retryOf: null, batchId: null,
    queuedMs: Date.now(), startedMs: null, heartbeatMs: null, finishedMs: null, nextRetryMs: null, errorCode: null, errorMessage: null, rows: null, log: [], ...extra,
  };
  state().unshift(run);
  return run;
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 250));

export async function mockMlRequest(method: string, path: string, params: Record<string, unknown>, body: unknown): Promise<unknown> {
  await delay();
  const list = state();
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpMatchArray | null;

  if (method === "GET") {
    if (path === "/overview") return overview();
    if (path === "/system") return system();
    if (path === "/models") return models(params);
    if ((m = path.match(/^\/candles\/(.+)$/))) return candles(decodeURIComponent(m[1]), Number(params.limit ?? 120));
    if (path === "/runs") {
      const limit = Number(params.limit ?? 50);
      const filtered = list.filter((r) => (!params.status || r.status === params.status) && (!params.symbol || r.symbol === params.symbol)
        && (!params.horizon_minutes || r.horizon === Number(params.horizon_minutes)) && (!params.batch_id || r.batchId === params.batch_id));
      return { data: filtered.slice(0, limit).map(summarize), next_cursor: null };
    }
    if ((m = path.match(/^\/runs\/([^/]+)$/))) {
      const run = find(decodeURIComponent(m[1]));
      const chain: MockRun[] = [run];
      let cur: MockRun | undefined = run;
      while (cur?.retryOf) { cur = list.find((r) => r.id === cur?.retryOf); if (cur) chain.unshift(cur); }
      const child = list.find((r) => r.retryOf === run.id);
      if (child) chain.push(child);
      const detail: MlRunDetail = {
        run: summarize(run), log_tail: run.log, attempts: chain.map(summarize),
        model: run.outcome ? {
          model_version: `v-${run.symbol}-${run.horizon}-20261001`, status: run.outcome, decision_reason: run.reason,
          metrics: { holdout_rows: 80000 }, holdout: { trades: 64, net_win_rate_pct: 57.3, average_net_pct: 0.18, total_net_pct: 11.5, t_stat: 2.4 },
          folds: [1, 2, 3, 4, 5].map((n) => ({ fold: n, trades: 10 + n, total_net_pct: n === 4 ? -0.8 : 2 + n * 0.3, net_win_rate_pct: 50 + n * 2 })),
          comparison: run.outcome === "CHAMPION" ? { champion_total_net_pct: 6.2, candidate_total_net_pct: 11.5 } : null,
        } : null,
      };
      return detail;
    }
  }

  if (method === "POST") {
    if (path === "/runs") return { run: summarize(create(String(b.symbol), Number(b.horizon_minutes))) };
    if (path === "/batches") {
      const batchId = nextId();
      const pairs = Array.isArray(b.pairs)
        ? (b.pairs as Array<{ symbol: string; horizon_minutes: number }>)
        : (Array.isArray(b.symbols) && b.symbols.length ? (b.symbols as string[]) : SYMBOLS).flatMap((symbol) => (PRESETS[String(b.preset)] ?? []).map((h) => ({ symbol, horizon_minutes: h })));
      const created: MlRunSummary[] = [];
      const skipped: Array<{ symbol: string; horizon_minutes: number; reason: string }> = [];
      for (const p of pairs) {
        try { created.push(summarize(create(p.symbol, p.horizon_minutes, { batchId }))); } catch { skipped.push({ symbol: p.symbol, horizon_minutes: p.horizon_minutes, reason: "already_active" }); }
      }
      return { batch_id: batchId, runs: created, skipped };
    }
    if ((m = path.match(/^\/runs\/([^/]+)\/stop$/))) {
      const run = find(decodeURIComponent(m[1]));
      if (!isActive(run)) throw new MlApiError("Not stoppable", 422, "not_stoppable");
      run.status = "STOPPED"; run.finishedMs = Date.now(); run.errorCode = "cancelled_by_operator";
      return { run: summarize(run) };
    }
    if ((m = path.match(/^\/runs\/([^/]+)\/retry$/))) {
      const run = find(decodeURIComponent(m[1]));
      if (!["FAILED", "STOPPED", "INTERRUPTED"].includes(run.status)) throw new MlApiError("Not retryable", 422, "not_retryable");
      run.nextRetryMs = null;
      return { run: summarize(create(run.symbol, run.horizon, { attempt: run.attempt + 1, retryOf: run.id })) };
    }
    if ((m = path.match(/^\/batches\/([^/]+)\/stop$/))) {
      const id = decodeURIComponent(m[1]);
      const targets = list.filter((r) => r.batchId === id && isActive(r));
      targets.forEach((r) => { r.status = "STOPPED"; r.finishedMs = Date.now(); });
      return { stopped: targets.filter((r) => r.startedMs).length, cancelled: targets.filter((r) => !r.startedMs).length };
    }
    if ((m = path.match(/^\/backfill\/([^/]+)\/resume$/))) return { job: { symbol: decodeURIComponent(m[1]), queued: true } };
  }

  throw new MlApiError(`Mock has no route for ${method} ${path}`, 404);
}
