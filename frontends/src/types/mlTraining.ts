/*
 * ML Training dashboard: types mirroring the API contract in
 * autofinx-backend/backends/docs/ML_TRAINING_DASHBOARD_PLAN.md section 3
 * (all routes under /workspaces/{workspace}/ml-training). Anything the
 * contract does not promise is optional or nullable so a missing field can
 * never crash a page.
 */

export type MlRunStatus = "QUEUED" | "RUNNING" | "FINISHED" | "FAILED" | "STOPPED" | "INTERRUPTED";
export type MlRunOutcome = "CHAMPION" | "REJECTED";
export type MlRunPhase = "queued" | "exporting" | "fitting" | "evaluating" | "promoting" | "done";
export type MlRunSource = "ui" | "scheduler" | "cli";

export type MlAlertSeverity = "critical" | "warning" | "info";

export interface MlAlertAction {
  type: "retry_run" | "resume_backfill" | "open_run";
  run_id?: string | null;
  symbol?: string | null;
}

export interface MlAlert {
  id: string;
  severity: MlAlertSeverity;
  code: string;
  title: string;
  detail?: string | null;
  symbol?: string | null;
  horizon_minutes?: number | null;
  since?: string | null;
  action?: MlAlertAction | null;
}

export type MlCandleState = "live" | "lagging" | "stale" | "missing";

export interface MlCandleStats {
  state: MlCandleState;
  latest_close: number | null;
  age_seconds: number | null;
  collected: number | null;
  target: number | null;
  coverage_pct: number | null;
  rejected: number | null;
}

export type MlBackfillStatus = "RUNNING" | "COMPLETED" | "FAILED" | "STALLED";

export interface MlBackfill {
  status: MlBackfillStatus | null;
  pages: number | null;
  rows_written: number | null;
  cursor: string | null;
  updated_at: string | null;
  last_error: string | null;
}

export interface MlHorizonChampion {
  model_version: string | null;
  trained_at: string | null;
}

export interface MlHorizonLastRun {
  id: string;
  status: MlRunStatus;
  outcome: MlRunOutcome | null;
  outcome_reason: string | null;
  finished_at: string | null;
}

export interface MlHorizonActiveRun {
  id: string;
  status: MlRunStatus;
  phase: MlRunPhase | null;
  progress_pct: number | null;
  started_at: string | null;
  heartbeat_age_seconds: number | null;
}

export interface MlHorizonRetrain {
  eligible: boolean;
  reason: string | null;
  new_mature: number | null;
  required: number | null;
}

export interface MlHorizonRow {
  horizon_minutes: number;
  tradable: boolean;
  champion: MlHorizonChampion | null;
  last_run: MlHorizonLastRun | null;
  active_run: MlHorizonActiveRun | null;
  retrain: MlHorizonRetrain | null;
}

export interface MlSymbolOverview {
  symbol: string;
  candles: MlCandleStats | null;
  backfill: MlBackfill | null;
  features: { rows: number | null; state: "ok" | "building" | "missing" } | null;
  labels: { pending: number | null; mature: number | null } | null;
  funding: { latest: number | null; state: "ok" | "stale" | "missing" } | null;
  horizons: MlHorizonRow[];
}

export interface MlRunSummary {
  id: string;
  symbol: string;
  horizon_minutes: number;
  model_type: string | null;
  status: MlRunStatus;
  outcome: MlRunOutcome | null;
  outcome_reason: string | null;
  phase: MlRunPhase | null;
  progress_pct: number | null;
  source: MlRunSource | null;
  triggered_by: string | null;
  batch_id: string | null;
  attempt: number | null;
  max_attempts: number | null;
  retry_of: string | null;
  next_retry_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  heartbeat_age_seconds: number | null;
  finished_at: string | null;
  elapsed_seconds: number | null;
  eta_seconds: number | null;
  rows_exported: number | null;
  error_code: string | null;
  error_message: string | null;
  can_stop: boolean;
  can_retry: boolean;
  model_id: string | null;
}

export type MlJobState = "ok" | "late" | "never";

export interface MlPipelineJob {
  command: string;
  last_started_at: string | null;
  last_status: string | null;
  age_seconds: number | null;
  state: MlJobState;
}

export interface MlOverview {
  generated_at: string;
  enabled: boolean;
  mode: "shadow_only" | string;
  counts_as_of: string | null;
  alerts: MlAlert[];
  symbols: MlSymbolOverview[];
  active_runs: MlRunSummary[];
  queue: { pending: number | null; reserved: number | null; failed: number | null } | null;
  pipeline_jobs: MlPipelineJob[];
}

export interface MlRunsQuery {
  status?: MlRunStatus | "";
  symbol?: string;
  horizon_minutes?: number | "";
  batch_id?: string;
  limit?: number;
  cursor?: string | null;
}

export interface MlRunsPage {
  data: MlRunSummary[];
  next_cursor: string | null;
}

/** Shape of `model` inside a run detail is only partly specified: everything optional. */
export interface MlRunModel {
  model_version: string | null;
  status: string | null;
  decision_reason: string | null;
  metrics?: Record<string, unknown> | null;
  holdout?: Record<string, unknown> | null;
  folds?: Array<Record<string, unknown>> | null;
  comparison?: Record<string, unknown> | null;
}

export interface MlRunDetail {
  run: MlRunSummary;
  log_tail: string[];
  model: MlRunModel | null;
  attempts: MlRunSummary[];
}

export interface MlStartRunInput {
  symbol: string;
  horizon_minutes: number;
  type?: string;
}

export type MlBatchPreset = "long" | "mid" | "short";

export type MlStartBatchInput =
  | { pairs: Array<{ symbol: string; horizon_minutes: number }> }
  | { preset: MlBatchPreset; symbols?: string[] };

export interface MlBatchResult {
  batch_id: string;
  runs: MlRunSummary[];
  /** Listed by the backend for duplicates; element shape is not specified. */
  skipped?: Array<{ symbol?: string; horizon_minutes?: number; reason?: string }> | null;
}

export interface MlCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MlCandlesResponse {
  symbol: string;
  timeframe: string;
  generated_at: string;
  latest_close: number | null;
  age_seconds: number | null;
  state: MlCandleState;
  candles: MlCandle[];
}

export interface MlModelRow {
  model_version: string;
  symbol: string;
  horizon_minutes: number;
  model_type: string | null;
  status: string;
  decision_reason: string | null;
  trained_at: string | null;
  promoted_at: string | null;
  samples: { total: number | null; train: number | null; holdout: number | null } | null;
  /** Contract says `{...}`: free-form, read defensively. */
  holdout_summary: Record<string, unknown> | null;
  comparison: Record<string, unknown> | null;
}

export interface MlModelsResponse {
  data: MlModelRow[];
}

export interface MlSystemHost {
  cores: number | null;
  load: { m1: number | null; m5: number | null; m15: number | null } | null;
  memory: { total_mb: number | null; available_mb: number | null; used_pct: number | null } | null;
  swap: { total_mb: number | null; used_mb: number | null; used_pct: number | null } | null;
  disk: { path: string | null; free_gb: number | null; used_pct: number | null } | null;
}

export interface MlSystem {
  generated_at: string;
  host: MlSystemHost | null;
  health: { level: "ok" | "warning" | "critical"; reasons: string[] } | null;
  queue: {
    connection: string | null;
    name: string | null;
    pending: number | null;
    reserved: number | null;
    failed_recent: Array<{
      id: string;
      failed_at: string | null;
      symbol?: string | null;
      horizon_minutes?: number | null;
      summary: string;
    }>;
  } | null;
  training: {
    timeout_seconds: number | null;
    stall_seconds: number | null;
    export_stall_seconds?: number | null;
    auto_retry: boolean | null;
    max_attempts: number | null;
  } | null;
  thresholds: {
    load_per_core_warn: number | null;
    load_per_core_critical: number | null;
    swap_used_pct_warn: number | null;
    swap_used_pct_critical: number | null;
    disk_free_gb_warn: number | null;
  } | null;
}

export type MlErrorCode =
  | "ml_disabled"
  | "already_active"
  | "not_stoppable"
  | "not_retryable"
  | "unknown_symbol"
  | "unknown_horizon";
