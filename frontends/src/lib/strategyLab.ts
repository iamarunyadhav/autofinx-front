/*
 * Strategy Lab (research only) — API types and display helpers.
 *
 * Shapes mirror App\Http\Controllers\Api\StrategyLabController (views built
 * there) and external-predictive-engine/v4/lab_runner.py (result.json /
 * chart.json). Uploaded code is stored and audited as TEXT; nothing in this
 * module or its API can place an order.
 */

export const LAB_SOURCE_TYPES = ["PINE", "RULE_JSON", "MANUAL_COMPONENT"] as const;
export type LabSourceType = (typeof LAB_SOURCE_TYPES)[number];

export const LAB_PURPOSES = [
  "FULL_STRATEGY",
  "DIRECTION",
  "TRADEABILITY_FILTER",
  "NOISE_FILTER",
  "ENTRY_CONFIRMATION",
  "EXIT",
  "RISK",
  "FEATURE_IDEA",
  "UNKNOWN",
] as const;
export type LabPurpose = (typeof LAB_PURPOSES)[number];

/** Progress order (StrategyLabCandidate::ORDER); REJECTED / ARCHIVED close a candidate. */
export const LAB_LIFECYCLE = [
  "DRAFT",
  "AUDITED",
  "QUICK_TESTED",
  "OWNER_APPROVED_DEEP_TEST",
  "DEEP_TESTED",
  "OWNER_APPROVED_EXPERIMENT",
] as const;
export type LabCandidateStatus = (typeof LAB_LIFECYCLE)[number] | "REJECTED" | "ARCHIVED";
export const LAB_CLOSED_STATUSES: string[] = ["REJECTED", "ARCHIVED"];

export type LabAuditClass = "CAUSAL" | "CAUSAL_IF_LAGGED" | "REPAINT_RISK" | "UNSUPPORTED" | "INVALID";
/** Audit classes the server refuses to test (StrategyLabService::assertStartable). */
export const LAB_AUDIT_BLOCKING: string[] = ["INVALID", "UNSUPPORTED", "REPAINT_RISK"];

export type LabRunKind = "QUICK" | "DEEP";
export type LabRunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type LabRunPhase = "queued" | "preparing_data" | "running" | "scoring" | "done";
export const LAB_ACTIVE_STATUSES: string[] = ["QUEUED", "RUNNING"];
export const LAB_PHASES: LabRunPhase[] = ["queued", "preparing_data", "running", "scoring", "done"];

export interface LabRunBrief {
  id: string;
  status: LabRunStatus;
  verdict: string | null;
  progress_pct: number | null;
}

export interface LabCandidateSummary {
  id: string;
  name: string;
  description: string | null;
  source_type: LabSourceType;
  intended_purpose: LabPurpose;
  original_timeframe: string | null;
  status: LabCandidateStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface LabCandidateListItem extends LabCandidateSummary {
  latest_version: number | null;
  audit_status: string | null;
  testable: boolean;
  quick_test: LabRunBrief | null;
  deep_test: LabRunBrief | null;
}

export interface LabAuditFinding {
  classification: string;
  construct: string;
  detail: string;
}

export interface LabAuditIndicator {
  function: string;
  calls: number;
  existing_v4_equivalent: string | null;
}

/** Non-PINE sources only carry classification / findings / executed. */
export interface LabAudit {
  classification: string;
  pine_version?: number | null;
  script_type?: string | null;
  findings?: LabAuditFinding[];
  indicators?: LabAuditIndicator[];
  inputs_count?: number;
  overfit_risk?: string;
  htf_reads?: number | boolean | null;
  lines?: number;
  executed: false;
}

export interface LabVersion {
  id: string;
  version: number;
  parent_version_id: string | null;
  sha256: string;
  adapter: string | null;
  adapter_label: string | null;
  testable: boolean;
  audit_status: string | null;
  audit: LabAudit | null;
  notes: string | null;
  created_at: string | null;
  source?: string;
}

export interface LabRunDecision {
  decision: "APPROVE" | "REJECT";
  scope: "DEEP_TEST" | "EXPERIMENT";
  notes: string | null;
  created_at: string | null;
}

export interface LabRun {
  id: string;
  candidate_id: string;
  version_id: string;
  kind: LabRunKind;
  status: LabRunStatus;
  phase: LabRunPhase | string | null;
  progress_pct: number | null;
  adapter: string | null;
  sample_policy: string | null;
  verdict: string | null;
  error_code: string | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  cancel_requested: boolean;
  result_sha256: string | null;
  decision: LabRunDecision | null;
  /** Only on GET /runs/{id}. */
  summary?: LabResult | null;
  log_tail?: string | null;
}

export interface LabApproval {
  id: string;
  candidate_id?: string;
  version_id?: string;
  run_id: string;
  scope: "DEEP_TEST" | "EXPERIMENT";
  decision: "APPROVE" | "REJECT";
  notes: string | null;
  decided_by: string | null;
  created_at: string | null;
}

export interface LabCandidateDetail extends LabCandidateSummary {
  versions: LabVersion[];
  runs: LabRun[];
  approvals: LabApproval[];
}

export interface LabSlice {
  trades: number;
  avg_net_pct: number | null;
}

/** lab_runner.scorecard(); a window with no trades is just {trades: 0}. */
export interface LabScorecard {
  trades: number;
  buy_trades?: number;
  sell_trades?: number;
  gross_total_pct?: number;
  fees_total_pct?: number;
  funding_total_pct?: number;
  net_total_pct?: number;
  avg_net_pct?: number;
  median_net_pct?: number;
  profit_factor?: number | null;
  win_rate_pct?: number;
  loss_rate_pct?: number;
  avg_win_pct?: number | null;
  avg_loss_pct?: number | null;
  reward_risk?: number | null;
  max_drawdown_additive_pct?: number;
  t_stat?: number | null;
  avg_hold_minutes?: number;
  slices?: LabSlice[];
  exit_reasons?: Record<string, number>;
}

/** { "<cost>": scorecard }, cost keys are strings like "0.12". */
export type LabCostCards = Record<string, LabScorecard>;

export interface LabResult {
  verdict?: string;
  verdict_reasons?: string[];
  sample_policy?: string;
  policy?: { symbols?: string[]; charts?: string[]; window?: string; costs?: number[]; slices?: number };
  rules?: { min_trades?: number; min_profit_factor?: number; min_positive_slices?: number; accuracy_used_for_verdict?: boolean };
  execution?: string;
  data?: string;
  primary_chart?: string;
  combined?: Record<string, LabCostCards>;
  symbols?: Record<string, { window?: { start_ms: number; end_ms: number }; charts?: Record<string, LabCostCards> }>;
  component_layers_h15?: Record<string, Record<string, unknown>> | null;
  seconds?: number;
}

export interface LabChartTrade {
  entry_time: number;
  exit_time: number;
  side: "BUY" | "SELL";
  entry_price: number;
  exit_price_a: number;
  exit_price_b: number;
  net_pct: number;
  reason_a: string;
  reason_b: string;
}

export interface LabChart {
  symbol: string;
  timeframe: string;
  /** [open_time_ms, open, high, low, close] */
  candles: Array<[number, number, number, number, number]>;
  trades: LabChartTrade[];
}

export interface LabCreateCandidateInput {
  name: string;
  description?: string;
  source_type: LabSourceType;
  intended_purpose: LabPurpose;
  original_timeframe?: string;
  notes?: string;
  source: string;
}

/** Server limit (config strategy_lab.max_source_bytes). */
export const LAB_MAX_SOURCE_BYTES = 120_000;

export const labByteLength = (text: string) => new TextEncoder().encode(text).length;

/* ---------------------------------------------------------------- errors */

/**
 * Plain-language text for the 422 `code`s StrategyLabService / the runner use.
 * Unknown codes fall back to the server's own message.
 */
const LAB_CODE_TEXT: Record<string, string> = {
  RUNNER_UNAVAILABLE: "Tests can't run on this server. They run on the research PC where the 5-year data lives.",
  NEEDS_TRANSLATION: "There's no reviewed translation for this exact source yet. Arbitrary Pine is never executed, so this version can't be tested until a translation exists.",
  AUDIT_BLOCKED: "The audit blocks testing (invalid, unsupported or repaint risk). Fix the findings in a new version first.",
  APPROVAL_REQUIRED: "A Deep Test needs an owner approval on a completed Quick Test of this same version.",
  CANDIDATE_CLOSED: "This candidate is closed (rejected or archived), so nothing more can happen to it.",
  DISABLED: "Strategy Lab is switched off on the server.",
  RUN_NOT_COMPLETED: "Only a completed run can be approved or rejected.",
  ALREADY_DECIDED: "This run already has an owner decision. Decisions can't be changed.",
  RUN_ACTIVE: "Cancel the active run before archiving.",
  INVALID_SOURCE: "The source must be UTF-8 text no larger than 120,000 bytes.",
  NO_CHART: "This run has no chart.",
  // Runner failure codes (run.error_code)
  DATA_UNAVAILABLE: "The research data set wasn't found on the machine running the test.",
  ADAPTER_UNKNOWN: "The runner doesn't know this translation (adapter).",
  TIMEOUT: "The test ran past its time limit and was stopped.",
  NO_RESULT: "The runner finished without writing a result.",
  PYTHON_EXIT: "The research runner exited with an error.",
  CANCELLED: "The run was cancelled.",
  OTHER: "The run failed unexpectedly.",
};

export function labCodeText(code: string | null | undefined): string | null {
  return code ? LAB_CODE_TEXT[code] ?? null : null;
}

export class LabApiError extends Error {
  status: number;
  code: string | null;
  serverMessage: string;

  constructor(serverMessage: string, status: number, code: string | null = null) {
    const friendly = labCodeText(code);
    const fallback = status === 403 ? "You don't have permission for this. Only a workspace owner or admin can change Strategy Lab." : serverMessage;
    super(friendly ?? fallback);
    this.name = "LabApiError";
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

export function labErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}

/* ------------------------------------------------------------ formatting */

export const labWords = (v?: string | null) => (v ? v.replaceAll("_", " ").toLowerCase() : "—");

export function labDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/** Seconds since `iso`, or null when unknown. */
export function labAgeSeconds(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (nowMs - t) / 1000) : null;
}

export function labDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** Null / missing stays a dash, never a fabricated 0. */
export function labNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function labPct(v: number | null | undefined, digits = 3, signed = true): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Number(v).toFixed(digits);
  return `${signed && v > 0 ? "+" : ""}${s}%`;
}

export function labSignClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "text-profit" : "text-loss";
}

/** Cost keys sorted numerically: [base, ..., stressed]. */
export function labCostKeys(cards: LabCostCards | null | undefined): string[] {
  return Object.keys(cards ?? {}).sort((a, b) => Number(a) - Number(b));
}

/* ---------------------------------------------------------------- tones */

export type LabTone = "neutral" | "running" | "good" | "bad" | "warn";

/** Badge classes built only from theme tokens (CSS vars), so they follow the active theme. */
export const LAB_TONE_CLASS: Record<LabTone, string> = {
  neutral: "border-border bg-muted/40 text-muted-foreground",
  running: "border-primary/40 bg-primary/10 text-primary",
  good: "border-success/40 bg-success/15 text-success",
  bad: "border-error/40 bg-error/15 text-error",
  warn: "border-warning/40 bg-warning/15 text-warning",
};

export function labAuditTone(cls: string | null | undefined): LabTone {
  switch (cls) {
    case "CAUSAL": return "good";
    case "CAUSAL_IF_LAGGED": return "warn";
    case "REPAINT_RISK":
    case "UNSUPPORTED":
    case "INVALID": return "bad";
    default: return "neutral";
  }
}

export function labRunTone(status: string | null | undefined): LabTone {
  switch (status) {
    case "QUEUED": return "neutral";
    case "RUNNING": return "running";
    case "COMPLETED": return "good";
    case "FAILED": return "bad";
    case "CANCELLED": return "warn";
    default: return "neutral";
  }
}

/**
 * Verdict strings from lab_runner.verdict(). A negative verdict is a valid
 * research result, not an error, so only the clearly-negative ones read red.
 */
export function labVerdictTone(verdict: string | null | undefined): LabTone {
  if (!verdict) return "neutral";
  if (verdict === "PROMISING" || verdict === "PROMISING_FOR_DEEP_TEST") return "good";
  if (verdict === "WEAK" || verdict === "FRAGILE" || verdict === "TOO_FEW_TRADES") return "warn";
  if (verdict.startsWith("REJECTED") || verdict === "NO_VALUE") return "bad";
  return "neutral";
}

const VERDICT_TEXT: Record<string, string> = {
  PROMISING_FOR_DEEP_TEST: "promising enough for a deep test",
  PROMISING: "promising",
  WEAK: "weak (little or no edge after costs)",
  FRAGILE: "fragile (the edge is not consistent across time or coins)",
  TOO_FEW_TRADES: "too few trades to judge",
  NO_VALUE: "no value after costs",
  REJECTED_TOO_FEW_TRADES: "rejected: too few trades",
  REJECTED_NO_VALUE: "rejected: no value after costs",
  REJECTED_COST_FRAGILE: "rejected: does not survive the stressed cost",
};

export const labVerdictText = (verdict: string | null | undefined) =>
  verdict ? VERDICT_TEXT[verdict] ?? labWords(verdict) : "—";

export function labStatusTone(status: string | null | undefined): LabTone {
  if (status === "REJECTED") return "bad";
  if (status === "ARCHIVED") return "neutral";
  if (status === "OWNER_APPROVED_DEEP_TEST" || status === "OWNER_APPROVED_EXPERIMENT") return "good";
  if (status === "DRAFT") return "neutral";
  return "running";
}

/** RFC 4122 v4 id for the Idempotency-Key header (crypto.randomUUID needs a secure context). */
export function labUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
