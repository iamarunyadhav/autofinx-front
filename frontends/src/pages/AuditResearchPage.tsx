import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Pause,
  PlayCircle,
  RefreshCw,
  SearchCheck,
  Square,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types -- mirror AuditResearchController / AuditSession / AuditEvent /
// AuditDecisionSnapshot / AuditIncident / AuditReportBuilder exactly (see
// app/Http/Controllers/Api/AuditResearchController.php and the models it
// reads). Do not import from the legacy Supabase types module -- this domain
// never existed there.
// ---------------------------------------------------------------------------

type SessionStatus = "running" | "completed" | "failed" | "stopped";
type SessionMode = "standard" | "detailed" | "deep_diagnostic";
type SessionEnvironment = "local" | "sandbox" | "testnet" | "live";

interface AuditSession {
  id: string;
  workspace_id: string;
  name: string;
  bot_type: string;
  bot_instance_id: string | null;
  environment: SessionEnvironment;
  symbol: string | null;
  purpose: string | null;
  mode: SessionMode;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  build_version: string | null;
  created_at: string;
  updated_at: string;
}

type EventCategory =
  | "market"
  | "analysis"
  | "prediction"
  | "decision"
  | "risk"
  | "execution"
  | "health"
  | "incident"
  | "system";

type EventSeverity = "info" | "low" | "medium" | "high" | "critical";

interface AuditEvent {
  id: string;
  audit_session_id: string | null;
  correlation_id: string | null;
  bot_type: string;
  bot_instance_id: string | null;
  environment: string | null;
  symbol: string | null;
  event_type: string;
  event_category: EventCategory;
  severity: EventSeverity;
  occurred_at: string;
  received_at: string | null;
  market_price: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

interface AuditEventsResponse {
  events: AuditEvent[];
  next_since_id: string | null;
}

type RuleItem = { rule?: string; detail?: string } & Record<string, unknown>;

interface AuditDecisionSnapshot {
  id: string;
  audit_event_id: string | null;
  ratio_bot_decision_id: string | null;
  correlation_id: string | null;
  passed_rules: RuleItem[] | null;
  failed_rules: RuleItem[] | null;
  final_decision: string | null;
  final_reason: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  diagnosis_category: string | null;
  diagnosis_confidence: "high" | "medium" | "low" | null;
}

interface RatioBotDecisionWithSnapshot {
  id: string;
  ratio_bot_config_id: string;
  correlation_id: string | null;
  decision: string;
  evaluated_price: string | null;
  anchor_price: string | null;
  computed_ratio: string | null;
  threshold_used: string | null;
  execution_status: string | null;
  order_id: string | null;
  client_order_id: string | null;
  executed_qty: string | null;
  executed_price: string | null;
  reason: string | null;
  decided_at: string;
  executed_at: string | null;
  metadata: Record<string, unknown> | null;
  rule_evaluation: AuditDecisionSnapshot | null;
}

type IncidentStatus =
  | "detected"
  | "active"
  | "recovering"
  | "recovered"
  | "recurring"
  | "persistent"
  | "resolved";

interface AuditIncident {
  id: string;
  workspace_id: string;
  bot_type: string;
  bot_instance_id: string | null;
  symbol: string | null;
  title: string;
  root_cause_category: string;
  severity: EventSeverity;
  status: IncidentStatus;
  first_detected_at: string;
  last_detected_at: string;
  recovered_at: string | null;
  occurrence_count: number;
  self_recovered: boolean;
  evidence: Record<string, unknown> | null;
  recommended_action: string | null;
  created_at: string;
  updated_at: string;
}

interface PredictionHorizon {
  horizon_seconds: number;
  hit_rate_pct: number | null;
  sample_size: number;
  avg_confidence_pct: number | null;
  computed_at: string | null;
}

interface PredictionAccuracyBot {
  ratio_bot_config_id: string;
  name: string;
  symbol: string;
  horizons: PredictionHorizon[];
}

// Mirrors AuditReportBuilder::buildForSession()'s real return shape -- read
// fresh from app/Domain/AuditResearch/AuditReportBuilder.php, not guessed.
interface AuditReport {
  session: {
    id: string;
    name: string;
    bot_type: string;
    bot_instance_id: string | null;
    environment: string;
    symbol: string | null;
    mode: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    build_version: string | null;
  };
  executive_summary: {
    total_events: number;
    total_decisions: number;
    total_trades: number;
    total_blocks: number;
    total_incidents: number;
    realized_pnl: number;
  };
  trading_summary: {
    decision_counts: Record<string, number>;
    trade_count: number;
    realized_pnl: number;
  };
  prediction_analysis: PredictionHorizon[];
  incident_analysis: Array<{
    id: string;
    title: string;
    root_cause_category: string;
    severity: string;
    status: string;
    occurrence_count: number;
    self_recovered: boolean;
    first_detected_at: string | null;
    recovered_at: string | null;
  }>;
  financial_impact: { realized_pnl: number };
  health: { blockers: string[] };
  events: Array<{
    id: string;
    occurred_at: string | null;
    event_type: string;
    event_category: string;
    severity: string;
    correlation_id: string | null;
    symbol: string | null;
    market_price: string | null;
    metadata: Record<string, unknown>;
  }>;
  decisions: Array<{
    id: string;
    correlation_id: string | null;
    decision: string;
    evaluated_price: string | null;
    execution_status: string | null;
    reason: string | null;
    decided_at: string | null;
  }>;
  recommendations: string[];
  blockers: string[];
}

interface RatioBotConfigOption {
  id: string;
  name: string;
  symbol: string;
}

// Mirrors BuildComparisonService::compare()'s real return shape (read fresh
// from app/Domain/AuditResearch/BuildComparisonService.php) -- session_a/b
// reuse the same `session` shape AuditReportBuilder::buildForSession()
// returns.
interface BuildComparisonSessionSummary {
  id: string;
  name: string;
  bot_type: string;
  bot_instance_id: string | null;
  environment: string;
  symbol: string | null;
  mode: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  build_version: string | null;
}

interface BuildComparisonResult {
  session_a: BuildComparisonSessionSummary;
  session_b: BuildComparisonSessionSummary;
  prediction_accuracy: {
    session_a: PredictionHorizon[];
    session_b: PredictionHorizon[];
    avg_hit_rate_pct: { session_a: number | null; session_b: number | null };
  };
  execution_failure_count: { session_a: number; session_b: number };
  average_decision_latency_ms: { session_a: number | null; session_b: number | null };
  root_cause_breakdown: { session_a: Record<string, number>; session_b: Record<string, number> };
  realized_pnl: { session_a: number; session_b: number };
  total_incidents: { session_a: number; session_b: number };
}

// Mirrors ProductionReadinessService::evaluate()'s real return shape (read
// fresh from app/Domain/AuditResearch/ProductionReadinessService.php). Each
// category's extra keys vary (sample_size, ratio, backlog, failed_jobs,
// count, total, scenario_key, ...) so they're typed generically rather than
// invented per-category -- rendered as whatever the backend actually sent.
type ReadinessVerdict = "PASS" | "WARNING" | "FAIL" | "INSUFFICIENT_DATA";

interface ReadinessCategory {
  verdict: ReadinessVerdict;
  evidence: string;
  [extra: string]: unknown;
}

interface ProductionReadinessResult {
  workspace_id: string;
  bot_instance_id: string | null;
  generated_at: string;
  categories: Record<string, ReadinessCategory>;
  overall: ReadinessVerdict;
}

const EMPTY_SESSIONS: AuditSession[] = [];
const EMPTY_EVENTS: AuditEvent[] = [];
const EMPTY_DECISIONS: RatioBotDecisionWithSnapshot[] = [];
const EMPTY_INCIDENTS: AuditIncident[] = [];
const EMPTY_BOTS: RatioBotConfigOption[] = [];
const EMPTY_PREDICTION_BOTS: PredictionAccuracyBot[] = [];

// ---------------------------------------------------------------------------
// Status palette -- same convention as ForexGridBotPage/PepperstoneBotPage:
// good/warning/serious/critical hex tokens, identical light/dark.
// ---------------------------------------------------------------------------

const GOOD = "#0ca30c";
const WARNING = "#fab219";
const SERIOUS = "#ec835a";
const CRITICAL = "#d03b3b";
const NEUTRAL = "#94a3b8";

const SESSION_STATUS_META: Record<SessionStatus, { label: string; color: string; Icon: typeof PlayCircle }> = {
  running: { label: "Running", color: GOOD, Icon: PlayCircle },
  completed: { label: "Completed", color: GOOD, Icon: CheckCircle2 },
  failed: { label: "Failed", color: CRITICAL, Icon: XCircle },
  stopped: { label: "Stopped", color: WARNING, Icon: Square },
};

const INCIDENT_STATUS_META: Record<IncidentStatus, { label: string; color: string }> = {
  resolved: { label: "Resolved", color: GOOD },
  recovered: { label: "Recovered", color: GOOD },
  recurring: { label: "Recurring", color: CRITICAL },
  persistent: { label: "Persistent", color: CRITICAL },
  detected: { label: "Detected", color: WARNING },
  active: { label: "Active", color: WARNING },
  recovering: { label: "Recovering", color: WARNING },
};

const SEVERITY_META: Record<EventSeverity, { label: string; color: string }> = {
  info: { label: "Info", color: NEUTRAL },
  low: { label: "Low", color: GOOD },
  medium: { label: "Medium", color: WARNING },
  high: { label: "High", color: SERIOUS },
  critical: { label: "Critical", color: CRITICAL },
};

const READINESS_VERDICT_META: Record<ReadinessVerdict, { label: string; color: string }> = {
  PASS: { label: "Pass", color: GOOD },
  WARNING: { label: "Warning", color: WARNING },
  FAIL: { label: "Fail", color: CRITICAL },
  INSUFFICIENT_DATA: { label: "Insufficient data", color: NEUTRAL },
};

const CONFIDENCE_META: Record<"high" | "medium" | "low", { label: string; color: string }> = {
  high: { label: "High confidence", color: GOOD },
  medium: { label: "Medium confidence", color: WARNING },
  low: { label: "Low confidence", color: SERIOUS },
};

function ColorBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const meta = SESSION_STATUS_META[status] ?? SESSION_STATUS_META.stopped;
  const Icon = meta.Icon;
  return (
    <ColorBadge color={meta.color}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </ColorBadge>
  );
}

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT_STATUS_META[status] ?? INCIDENT_STATUS_META.detected;
  return <ColorBadge color={meta.color}>{meta.label}</ColorBadge>;
}

function SeverityBadge({ severity }: { severity: EventSeverity | string }) {
  const meta = SEVERITY_META[severity as EventSeverity] ?? SEVERITY_META.info;
  return <ColorBadge color={meta.color}>{meta.label}</ColorBadge>;
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" | null }) {
  if (!confidence) return <span className="text-xs text-muted-foreground">Unknown</span>;
  const meta = CONFIDENCE_META[confidence] ?? CONFIDENCE_META.low;
  return <ColorBadge color={meta.color}>{meta.label}</ColorBadge>;
}

function ReadinessVerdictBadge({ verdict }: { verdict: ReadinessVerdict | string }) {
  const meta = READINESS_VERDICT_META[verdict as ReadinessVerdict] ?? READINESS_VERDICT_META.INSUFFICIENT_DATA;
  return <ColorBadge color={meta.color}>{meta.label}</ColorBadge>;
}

// ---------------------------------------------------------------------------
// Formatting helpers -- same conventions as the other three bot pages.
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
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
// File download helper -- reuses this app's established
// createObjectURL-anchor-click pattern (see FutureTradeBotPage.tsx /
// RobotTradingPage.tsx), but fetches the REAL server-generated export
// (CSV/JSON/Markdown from AuditResearchController::exportCsv/exportJson/
// exportMarkdown) rather than building the file client-side.
// ---------------------------------------------------------------------------

async function downloadSessionExport(sessionId: string, format: "csv" | "json" | "markdown" | "pdf") {
  const headers = await authHeaders();
  const base = (getApiBaseUrl() || "").replace(/\/+$/, "");
  const response = await fetch(`${base}/audit-research/sessions/${sessionId}/export/${format}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Export failed (${response.status}).`);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const extension = format === "markdown" ? "md" : format;
  const filename = match?.[1] || `audit-session-${sessionId}.${extension}`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Live Observer -- honest polling, NOT websocket/push. Every "live" panel in
// this app (RatioBrainDecisionCard, TrendWindowBreakdownCard, etc.) is a
// React Query refetchInterval poll; this hook follows the same pattern
// manually so it can track the `since_id` cursor
// (GET .../events?since_id=... -> next_since_id) the backend returns,
// fetching only new rows on each poll instead of the full history.
// ---------------------------------------------------------------------------

function useLiveEvents(sessionId: string | null, isRunning: boolean) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      cursorRef.current = null;
      setEvents([]);
    }
  }, [sessionId]);

  const poll = useMemo(() => {
    return async (targetSessionId: string) => {
      setIsLoading(true);
      try {
        const params = cursorRef.current ? { since_id: cursorRef.current } : undefined;
        const response = await api.get<AuditEventsResponse>(
          `/audit-research/sessions/${targetSessionId}/events`,
          params ? { params } : undefined,
        );
        const data = response.data;
        if (sessionRef.current !== targetSessionId) return; // session switched mid-flight
        if (data.events.length > 0) {
          setEvents((current) => [...current, ...data.events]);
        }
        if (data.next_since_id) {
          cursorRef.current = data.next_since_id;
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to poll audit events.");
      } finally {
        setIsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    void poll(sessionId);

    if (!isRunning) return undefined; // stopped/completed/failed sessions: manual refresh only

    const intervalMs = 4000;
    const interval = window.setInterval(() => {
      void poll(sessionId);
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [sessionId, isRunning, poll]);

  const refresh = () => {
    if (sessionId) void poll(sessionId);
  };

  return { events, isLoading, error, refresh };
}

// ---------------------------------------------------------------------------
// Create-session form
// ---------------------------------------------------------------------------

type SessionForm = {
  name: string;
  bot_type: string;
  bot_instance_id: string;
  environment: SessionEnvironment;
  symbol: string;
  purpose: string;
  mode: SessionMode;
};

const OTHER_BOT_TYPES = [
  { value: "future_trade", label: "Future Trade" },
  { value: "robot_trade", label: "Robot Trade" },
  { value: "quick_trade", label: "Quick Trade" },
];

const INITIAL_FORM: SessionForm = {
  name: "",
  bot_type: "ratio_bot",
  bot_instance_id: "none",
  environment: "sandbox",
  symbol: "",
  purpose: "",
  mode: "standard",
};

// ---------------------------------------------------------------------------
// Rule row -- renders a passed/failed rule item. Real shape from
// RuleEvaluationRecorder::classifyDecision() is always {rule, detail}, but
// this renders generically (any string keys/values) so nothing here can
// silently hide or fabricate a field the backend actually sent.
// ---------------------------------------------------------------------------

function RuleRow({ item, passed }: { item: RuleItem; passed: boolean }) {
  const rule = typeof item.rule === "string" ? item.rule : null;
  const detail = typeof item.detail === "string" ? item.detail : null;
  const extraKeys = Object.keys(item).filter((key) => key !== "rule" && key !== "detail");

  return (
    <div className={cn("rounded-lg border p-2.5 text-sm", passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
      <div className="flex items-center gap-2 font-medium">
        {passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-600" />}
        {rule ? prettyLabel(rule) : "Rule"}
      </div>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      {extraKeys.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {extraKeys.map((key) => (
            <div key={key} className="text-xs text-muted-foreground">
              <span className="font-medium">{prettyLabel(key)}:</span> {String(item[key])}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision row -- expandable explainability view + inline order/fill fields.
// ---------------------------------------------------------------------------

function DecisionRow({
  decision,
  expanded,
  onToggle,
  highlighted,
}: {
  decision: RatioBotDecisionWithSnapshot;
  expanded: boolean;
  onToggle: () => void;
  highlighted: boolean;
}) {
  const snapshot = decision.rule_evaluation;
  return (
    <>
      <TableRow
        className={cn("cursor-pointer", highlighted && "bg-primary/5")}
        onClick={onToggle}
      >
        <TableCell className="whitespace-nowrap text-xs">{formatDateTime(decision.decided_at)}</TableCell>
        <TableCell className="font-medium">{decision.decision}</TableCell>
        <TableCell>{formatNumber(decision.evaluated_price, 8)}</TableCell>
        <TableCell>{decision.execution_status ? prettyLabel(decision.execution_status) : "None"}</TableCell>
        <TableCell className="text-xs">{decision.order_id || "None"}</TableCell>
        <TableCell>{decision.executed_qty ? formatNumber(decision.executed_qty, 8) : "None"}</TableCell>
        <TableCell>{decision.executed_price ? formatNumber(decision.executed_price, 8) : "None"}</TableCell>
        <TableCell>
          {snapshot?.diagnosis_category ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs">{prettyLabel(snapshot.diagnosis_category)}</span>
              <ConfidenceBadge confidence={snapshot.diagnosis_confidence} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No snapshot</span>
          )}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/20">
            <div className="space-y-4 p-2">
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <div><span className="font-medium text-foreground">Correlation ID:</span> {decision.correlation_id || "None"}</div>
                <div><span className="font-medium text-foreground">Client order ID:</span> {decision.client_order_id || "None"}</div>
                <div><span className="font-medium text-foreground">Anchor price:</span> {formatNumber(decision.anchor_price, 8)}</div>
                <div><span className="font-medium text-foreground">Computed ratio:</span> {formatNumber(decision.computed_ratio, 6)}</div>
                <div><span className="font-medium text-foreground">Threshold used:</span> {formatNumber(decision.threshold_used, 6)}</div>
                <div><span className="font-medium text-foreground">Executed at:</span> {formatDateTime(decision.executed_at)}</div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Reason</div>
                <p className="text-sm">{decision.reason || "No reason recorded."}</p>
              </div>

              {snapshot ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase text-muted-foreground">
                        Passed rules ({snapshot.passed_rules?.length ?? 0})
                      </div>
                      {snapshot.passed_rules && snapshot.passed_rules.length > 0 ? (
                        <div className="space-y-1.5">
                          {snapshot.passed_rules.map((item, index) => (
                            <RuleRow key={`passed-${index}`} item={item} passed />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">None.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase text-muted-foreground">
                        Failed rules ({snapshot.failed_rules?.length ?? 0})
                      </div>
                      {snapshot.failed_rules && snapshot.failed_rules.length > 0 ? (
                        <div className="space-y-1.5">
                          {snapshot.failed_rules.map((item, index) => (
                            <RuleRow key={`failed-${index}`} item={item} passed={false} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">None.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-lg border border-border/70 p-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Final decision / reason</div>
                      <p className="text-sm">{snapshot.final_decision || decision.decision} &mdash; {snapshot.final_reason || "No reason recorded."}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground">Diagnosis</div>
                      <p className="text-sm">
                        {snapshot.diagnosis_category ? prettyLabel(snapshot.diagnosis_category) : "Unclassified"}
                        {" "}
                        <ConfidenceBadge confidence={snapshot.diagnosis_confidence} />
                      </p>
                    </div>
                    {snapshot.expected_behavior ? (
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">Expected behavior</div>
                        <p className="text-sm">{snapshot.expected_behavior}</p>
                      </div>
                    ) : null}
                    {snapshot.actual_behavior ? (
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">Actual behavior</div>
                        <p className="text-sm">{snapshot.actual_behavior}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No rule-evaluation snapshot was recorded for this decision.
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Event detail modal-ish inline panel
// ---------------------------------------------------------------------------

function EventDetailPanel({
  event,
  onClose,
  onJumpToDecision,
  hasMatchingDecision,
}: {
  event: AuditEvent;
  onClose: () => void;
  onJumpToDecision: () => void;
  hasMatchingDecision: boolean;
}) {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base">{prettyLabel(event.event_type)}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <div><span className="font-medium">Category:</span> <Badge variant="outline">{prettyLabel(event.event_category)}</Badge></div>
          <div><span className="font-medium">Severity:</span> <SeverityBadge severity={event.severity} /></div>
          <div><span className="font-medium">Occurred at:</span> {formatDateTime(event.occurred_at)}</div>
          <div><span className="font-medium">Received at:</span> {formatDateTime(event.received_at)}</div>
          <div><span className="font-medium">Symbol:</span> {event.symbol || "None"}</div>
          <div><span className="font-medium">Market price:</span> {event.market_price ? formatNumber(event.market_price, 8) : "None"}</div>
          <div><span className="font-medium">Latency:</span> {event.latency_ms != null ? `${event.latency_ms} ms` : "Not measured"}</div>
          <div><span className="font-medium">Correlation ID:</span> {event.correlation_id || "None"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Metadata</div>
          <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
            {event.metadata && Object.keys(event.metadata).length > 0 ? JSON.stringify(event.metadata, null, 2) : "No metadata recorded."}
          </pre>
        </div>
        {event.correlation_id ? (
          <Button size="sm" variant="outline" onClick={onJumpToDecision} disabled={!hasMatchingDecision}>
            {hasMatchingDecision ? "Jump to matching decision" : "No matching decision found"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuditResearchPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<SessionForm>(INITIAL_FORM);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const [highlightedDecisionId, setHighlightedDecisionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [topLevelTab, setTopLevelTab] = useState("explorer");

  const sessionsQuery = useQuery({
    queryKey: ["audit-research-sessions", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as AuditSession[];
      const response = await api.get<AuditSession[]>(`/workspaces/${workspaceId}/audit-research/sessions`);
      return response.data ?? [];
    },
    enabled: !!workspaceId,
    refetchInterval: 20000,
  });
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;

  useEffect(() => {
    if (!selectedSessionId && !isCreating && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, isCreating, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const botsQuery = useQuery({
    queryKey: ["audit-research-ratio-bots", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as RatioBotConfigOption[];
      const response = await api.get<RatioBotConfigOption[]>(`/workspaces/${workspaceId}/ratio-bots`);
      return response.data ?? [];
    },
    enabled: !!workspaceId,
  });
  const ratioBots = botsQuery.data ?? EMPTY_BOTS;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Select a workspace first.");
      if (!form.name.trim()) throw new Error("Session name is required.");
      const payload = {
        name: form.name.trim(),
        bot_type: "ratio_bot",
        bot_instance_id: form.bot_instance_id === "none" ? null : form.bot_instance_id,
        environment: form.environment,
        symbol: form.symbol.trim() || null,
        purpose: form.purpose.trim() || null,
        mode: form.mode,
      };
      const response = await api.post<AuditSession>(`/workspaces/${workspaceId}/audit-research/sessions`, payload);
      return response.data;
    },
    onSuccess: async (session) => {
      toast({ title: "Audit session started", description: `${session.name} is now running.` });
      setIsCreating(false);
      setForm(INITIAL_FORM);
      setSelectedSessionId(session.id);
      await queryClient.invalidateQueries({ queryKey: ["audit-research-sessions", workspaceId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create session", description: error.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await api.post<AuditSession>(`/audit-research/sessions/${sessionId}/stop`, {});
      return response.data;
    },
    onSuccess: async () => {
      toast({ title: "Session stopped", description: "Live polling will fall back to manual refresh." });
      await queryClient.invalidateQueries({ queryKey: ["audit-research-sessions", workspaceId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop session", description: error.message, variant: "destructive" });
    },
  });

  const isRunning = selectedSession?.status === "running";
  const liveEvents = useLiveEvents(selectedSessionId, isRunning);

  const decisionsQuery = useQuery({
    queryKey: ["audit-research-decisions", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [] as RatioBotDecisionWithSnapshot[];
      const response = await api.get<{ decisions: RatioBotDecisionWithSnapshot[] }>(
        `/audit-research/sessions/${selectedSessionId}/decisions`,
      );
      return response.data.decisions ?? [];
    },
    enabled: !!selectedSessionId,
    refetchInterval: isRunning ? 20000 : false,
  });
  const decisions = decisionsQuery.data ?? EMPTY_DECISIONS;

  const incidentsQuery = useQuery({
    queryKey: ["audit-research-session-incidents", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [] as AuditIncident[];
      const response = await api.get<{ incidents: AuditIncident[] }>(
        `/audit-research/sessions/${selectedSessionId}/incidents`,
      );
      return response.data.incidents ?? [];
    },
    enabled: !!selectedSessionId,
    refetchInterval: isRunning ? 30000 : false,
  });
  const sessionIncidents = incidentsQuery.data ?? EMPTY_INCIDENTS;

  const reportQuery = useQuery({
    queryKey: ["audit-research-report", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const response = await api.get<AuditReport>(`/audit-research/sessions/${selectedSessionId}/report`);
      return response.data;
    },
    enabled: !!selectedSessionId && activeTab === "report",
  });

  const workspaceIncidentsQuery = useQuery({
    queryKey: ["audit-research-workspace-incidents", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as AuditIncident[];
      const response = await api.get<{ incidents: AuditIncident[] }>(`/workspaces/${workspaceId}/audit-research/incidents`);
      return response.data.incidents ?? [];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
  const workspaceIncidents = workspaceIncidentsQuery.data ?? EMPTY_INCIDENTS;

  const predictionAccuracyQuery = useQuery({
    queryKey: ["audit-research-prediction-accuracy", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as PredictionAccuracyBot[];
      const response = await api.get<{ bots: PredictionAccuracyBot[] }>(`/workspaces/${workspaceId}/audit-research/prediction-accuracy`);
      return response.data.bots ?? [];
    },
    enabled: !!workspaceId,
  });
  const predictionBots = predictionAccuracyQuery.data ?? EMPTY_PREDICTION_BOTS;

  const [isExporting, setIsExporting] = useState<"csv" | "json" | "markdown" | "pdf" | null>(null);

  async function handleExport(format: "csv" | "json" | "markdown" | "pdf") {
    if (!selectedSessionId) return;
    setIsExporting(format);
    try {
      await downloadSessionExport(selectedSessionId, format);
      toast({ title: "Export downloaded", description: `Session export (${format.toUpperCase()}) saved.` });
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  }

  function handleSelectSession(sessionId: string) {
    setIsCreating(false);
    setSelectedSessionId(sessionId);
    setSelectedEventId(null);
    setExpandedDecisionId(null);
    setHighlightedDecisionId(null);
    setActiveTab("overview");
  }

  function handleJumpToDecision(event: AuditEvent) {
    if (!event.correlation_id) return;
    const matching = decisions.find((decision) => decision.correlation_id === event.correlation_id);
    if (!matching) return;
    setHighlightedDecisionId(matching.id);
    setExpandedDecisionId(matching.id);
    setActiveTab("decisions");
  }

  const selectedEvent = useMemo(
    () => liveEvents.events.find((event) => event.id === selectedEventId) || null,
    [liveEvents.events, selectedEventId],
  );

  const matchingDecisionForSelectedEvent = useMemo(() => {
    if (!selectedEvent?.correlation_id) return null;
    return decisions.find((decision) => decision.correlation_id === selectedEvent.correlation_id) || null;
  }, [selectedEvent, decisions]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <SearchCheck className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Audit Research</h1>
                  <p className="text-sm text-muted-foreground">
                    Session-scoped decision explainability for Ratio Bot: event timeline, rule-level decision
                    breakdowns, incident tracking, and prediction-accuracy reporting.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Ratio Bot only for now</Badge>
                <Badge variant="secondary">Auto-refreshing (polling), not a push/websocket feed</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionsQuery.refetch();
                  liveEvents.refresh();
                  decisionsQuery.refetch();
                  incidentsQuery.refetch();
                }}
                disabled={!selectedSessionId}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" onClick={() => { setIsCreating(true); setSelectedSessionId(null); }}>
                New audit session
              </Button>
            </div>
          </div>
        </div>

        {!workspaceId ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Select a workspace first.</CardContent>
          </Card>
        ) : (
          <Tabs value={topLevelTab} onValueChange={setTopLevelTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="explorer">Session Explorer</TabsTrigger>
              <TabsTrigger value="compare">Build Comparison</TabsTrigger>
              <TabsTrigger value="readiness">Production Readiness</TabsTrigger>
            </TabsList>

            <TabsContent value="explorer" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <Card className="h-fit">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Sessions</CardTitle>
                    <Badge variant="outline">{sessions.length}</Badge>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => { setIsCreating(true); setSelectedSessionId(null); }}>
                    Configure new session
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sessionsQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading sessions...</div> : null}
                  {!sessionsQuery.isLoading && sessions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      No audit sessions yet. Create one to start tracing a Ratio Bot.
                    </div>
                  ) : null}
                  <div className="max-h-[68vh] space-y-3 overflow-auto pr-1">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30",
                          !isCreating && selectedSessionId === session.id ? "border-primary bg-primary/5" : "border-border/70 bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{session.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {prettyLabel(session.bot_type)} &middot; {session.symbol || "any symbol"} &middot; {prettyLabel(session.environment)}
                            </div>
                          </div>
                          <SessionStatusBadge status={session.status} />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Started {relativeTime(session.started_at)}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {isCreating ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Create audit session</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Session name">
                          <Input
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="e.g. BTCUSDT anchor-flip investigation"
                          />
                        </Field>
                        <Field label="Bot type">
                          <div className="space-y-2">
                            <Select value="ratio_bot" onValueChange={() => undefined}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ratio_bot">Ratio Bot</SelectItem>
                                {OTHER_BOT_TYPES.map((bot) => (
                                  <SelectItem key={bot.value} value={bot.value} disabled>
                                    {bot.label} (audit integration not enabled yet)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Ratio Bot instance" hint="Optional -- links decisions/reports to one bot's ledger.">
                          <Select
                            value={form.bot_instance_id}
                            onValueChange={(value) => setForm((current) => ({ ...current, bot_instance_id: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No bot instance (event-only session)</SelectItem>
                              {ratioBots.map((bot) => (
                                <SelectItem key={bot.id} value={bot.id}>
                                  {bot.name} ({bot.symbol})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Environment">
                          <Select
                            value={form.environment}
                            onValueChange={(value: SessionEnvironment) => setForm((current) => ({ ...current, environment: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">Local</SelectItem>
                              <SelectItem value="sandbox">Sandbox</SelectItem>
                              <SelectItem value="testnet">Testnet</SelectItem>
                              <SelectItem value="live">Live</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Symbol" hint="Optional filter, e.g. BTCUSDT.">
                          <Input
                            value={form.symbol}
                            onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                          />
                        </Field>
                        <Field label="Mode">
                          <Select
                            value={form.mode}
                            onValueChange={(value: SessionMode) => setForm((current) => ({ ...current, mode: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="detailed">Detailed</SelectItem>
                              <SelectItem value="deep_diagnostic">Deep diagnostic</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Purpose" hint="Optional -- what are you investigating with this session?">
                        <Input
                          value={form.purpose}
                          onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
                        />
                      </Field>

                      <Button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                        Start session
                      </Button>
                    </CardContent>
                  </Card>
                ) : selectedSession ? (
                  <>
                    <Card>
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-2xl font-semibold">{selectedSession.name}</h2>
                              <SessionStatusBadge status={selectedSession.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {prettyLabel(selectedSession.bot_type)} &middot; {selectedSession.symbol || "any symbol"} &middot;{" "}
                              {prettyLabel(selectedSession.environment)} &middot; {prettyLabel(selectedSession.mode)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedSession.status === "running" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => stopMutation.mutate(selectedSession.id)}
                                disabled={stopMutation.isPending}
                              >
                                <Pause className="mr-2 h-4 w-4" />
                                Stop
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={isExporting !== null}>
                              <Download className="mr-2 h-4 w-4" />
                              CSV
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleExport("json")} disabled={isExporting !== null}>
                              <Download className="mr-2 h-4 w-4" />
                              JSON
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleExport("markdown")} disabled={isExporting !== null}>
                              <FileText className="mr-2 h-4 w-4" />
                              Markdown
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleExport("pdf")} disabled={isExporting !== null}>
                              <FileText className="mr-2 h-4 w-4" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="flex-wrap">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="live">Live Observer</TabsTrigger>
                        <TabsTrigger value="decisions">Decisions</TabsTrigger>
                        <TabsTrigger value="incidents">Incidents</TabsTrigger>
                        <TabsTrigger value="report">Report</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Session metadata</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
                            <div><span className="text-xs text-muted-foreground">Bot type</span><div>{prettyLabel(selectedSession.bot_type)}</div></div>
                            <div><span className="text-xs text-muted-foreground">Environment</span><div>{prettyLabel(selectedSession.environment)}</div></div>
                            <div><span className="text-xs text-muted-foreground">Symbol</span><div>{selectedSession.symbol || "None"}</div></div>
                            <div><span className="text-xs text-muted-foreground">Mode</span><div>{prettyLabel(selectedSession.mode)}</div></div>
                            <div><span className="text-xs text-muted-foreground">Build version</span><div>{selectedSession.build_version || "None"}</div></div>
                            <div><span className="text-xs text-muted-foreground">Purpose</span><div>{selectedSession.purpose || "None"}</div></div>
                            <div><span className="text-xs text-muted-foreground">Started at</span><div>{formatDateTime(selectedSession.started_at)}</div></div>
                            <div><span className="text-xs text-muted-foreground">Ended at</span><div>{formatDateTime(selectedSession.ended_at)}</div></div>
                            <div><span className="text-xs text-muted-foreground">Bot instance ID</span><div className="break-all text-xs">{selectedSession.bot_instance_id || "None"}</div></div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="live" className="space-y-4">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                            <CardTitle className="text-base">Live Observer</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {isRunning ? "Auto-refreshing every 4s (polling)" : "Manual refresh only -- session not running"}
                              </Badge>
                              <Button size="sm" variant="ghost" onClick={liveEvents.refresh} disabled={liveEvents.isLoading}>
                                <RefreshCw className={cn("h-4 w-4", liveEvents.isLoading && "animate-spin")} />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {liveEvents.error ? (
                              <p className="flex items-center gap-1.5 text-sm text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                {liveEvents.error}
                              </p>
                            ) : null}
                            {liveEvents.events.length === 0 ? (
                              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                No events recorded for this session yet.
                              </div>
                            ) : (
                              <div className="max-h-[420px] space-y-2 overflow-auto">
                                {[...liveEvents.events].reverse().map((event) => (
                                  <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => setSelectedEventId(event.id)}
                                    className={cn(
                                      "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/30",
                                      selectedEventId === event.id ? "border-primary bg-primary/5" : "border-border/70",
                                    )}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">{prettyLabel(event.event_category)}</Badge>
                                        <SeverityBadge severity={event.severity} />
                                        <span className="text-sm font-medium">{prettyLabel(event.event_type)}</span>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                      {event.market_price ? <span>Price: {formatNumber(event.market_price, 8)}</span> : null}
                                      {event.latency_ms != null ? <span>Latency: {event.latency_ms} ms</span> : null}
                                      {event.symbol ? <span>{event.symbol}</span> : null}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {selectedEvent ? (
                          <EventDetailPanel
                            event={selectedEvent}
                            onClose={() => setSelectedEventId(null)}
                            onJumpToDecision={() => handleJumpToDecision(selectedEvent)}
                            hasMatchingDecision={!!matchingDecisionForSelectedEvent}
                          />
                        ) : null}
                      </TabsContent>

                      <TabsContent value="decisions" className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Decisions &amp; rule evaluation</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {decisionsQuery.isLoading ? (
                              <div className="text-sm text-muted-foreground">Loading decisions...</div>
                            ) : decisions.length === 0 ? (
                              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                No decisions recorded in this session's time window.
                              </div>
                            ) : (
                              <div className="overflow-auto rounded-xl border border-border/70">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Decided at</TableHead>
                                      <TableHead>Decision</TableHead>
                                      <TableHead>Evaluated price</TableHead>
                                      <TableHead>Execution status</TableHead>
                                      <TableHead>Order ID</TableHead>
                                      <TableHead>Executed qty</TableHead>
                                      <TableHead>Executed price</TableHead>
                                      <TableHead>Diagnosis</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {decisions.map((decision) => (
                                      <DecisionRow
                                        key={decision.id}
                                        decision={decision}
                                        expanded={expandedDecisionId === decision.id}
                                        highlighted={highlightedDecisionId === decision.id}
                                        onToggle={() =>
                                          setExpandedDecisionId((current) => (current === decision.id ? null : decision.id))
                                        }
                                      />
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="incidents" className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Session incidents</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {incidentsQuery.isLoading ? (
                              <div className="text-sm text-muted-foreground">Loading incidents...</div>
                            ) : sessionIncidents.length === 0 ? (
                              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                No incidents detected for this bot in this session's window.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {sessionIncidents.map((incident) => (
                                  <IncidentCard key={incident.id} incident={incident} />
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="report" className="space-y-4">
                        {reportQuery.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading report...</div>
                        ) : reportQuery.data ? (
                          <ReportView report={reportQuery.data} />
                        ) : (
                          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                            No report data available.
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Select a session or create a new one.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Open incidents (workspace-wide)</CardTitle>
                </CardHeader>
                <CardContent>
                  {workspaceIncidentsQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : workspaceIncidents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                      No open incidents across this workspace.
                    </div>
                  ) : (
                    <div className="max-h-[360px] space-y-3 overflow-auto">
                      {workspaceIncidents.map((incident) => (
                        <IncidentCard key={incident.id} incident={incident} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prediction accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  {predictionAccuracyQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : predictionBots.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                      No brain-enabled Ratio Bots with backtested forecasts in this workspace yet.
                    </div>
                  ) : (
                    <div className="max-h-[360px] space-y-4 overflow-auto">
                      {predictionBots.map((bot) => (
                        <div key={bot.ratio_bot_config_id} className="rounded-xl border border-border/70 p-3">
                          <div className="font-medium">{bot.name} <span className="text-xs text-muted-foreground">({bot.symbol})</span></div>
                          {bot.horizons.length === 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">No backtest data yet.</p>
                          ) : (
                            <div className="mt-2 overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Horizon</TableHead>
                                    <TableHead>Hit rate</TableHead>
                                    <TableHead>Sample size</TableHead>
                                    <TableHead>Avg. confidence</TableHead>
                                    <TableHead>Computed at</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bot.horizons.map((horizon) => (
                                    <TableRow key={horizon.horizon_seconds}>
                                      <TableCell>{horizon.horizon_seconds}s</TableCell>
                                      <TableCell>{horizon.hit_rate_pct != null ? `${formatNumber(horizon.hit_rate_pct, 2)}%` : "None"}</TableCell>
                                      <TableCell>{horizon.sample_size}</TableCell>
                                      <TableCell>{horizon.avg_confidence_pct != null ? `${formatNumber(horizon.avg_confidence_pct, 2)}%` : "None"}</TableCell>
                                      <TableCell className="text-xs">{formatDateTime(horizon.computed_at)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            </TabsContent>

            <TabsContent value="compare" className="space-y-6">
              <BuildComparisonSection workspaceId={workspaceId} sessions={sessions} />
            </TabsContent>

            <TabsContent value="readiness" className="space-y-6">
              <ProductionReadinessSection workspaceId={workspaceId} ratioBots={ratioBots} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

function IncidentCard({ incident }: { incident: AuditIncident }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpanded((current) => !current)}>
        <div>
          <div className="font-medium">{incident.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{prettyLabel(incident.root_cause_category)}</span>
            <span>&middot;</span>
            <span>{incident.occurrence_count} occurrence{incident.occurrence_count === 1 ? "" : "s"}</span>
            {incident.self_recovered ? <ColorBadge color={GOOD}>Self-recovered</ColorBadge> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <IncidentStatusBadge status={incident.status} />
          <SeverityBadge severity={incident.severity} />
        </div>
      </button>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
        <div>First detected: {formatDateTime(incident.first_detected_at)}</div>
        <div>Last detected: {formatDateTime(incident.last_detected_at)}</div>
      </div>
      {incident.recommended_action ? (
        <p className="mt-2 text-sm">
          <span className="font-medium">Recommended action:</span> {incident.recommended_action}
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-xs">
          <div><span className="font-medium text-foreground">Recovered at:</span> {formatDateTime(incident.recovered_at)}</div>
          <div><span className="font-medium text-foreground">Symbol:</span> {incident.symbol || "None"}</div>
          <div><span className="font-medium text-foreground">Bot instance ID:</span> {incident.bot_instance_id || "None"}</div>
          <div>
            <span className="font-medium text-foreground">Evidence:</span>
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-border/70 bg-muted/20 p-2">
              {incident.evidence && Object.keys(incident.evidence).length > 0 ? JSON.stringify(incident.evidence, null, 2) : "No evidence recorded."}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportView({ report }: { report: AuditReport }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Executive summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div><span className="text-xs text-muted-foreground">Total events</span><div className="text-lg font-semibold">{report.executive_summary.total_events}</div></div>
          <div><span className="text-xs text-muted-foreground">Total decisions</span><div className="text-lg font-semibold">{report.executive_summary.total_decisions}</div></div>
          <div><span className="text-xs text-muted-foreground">Total trades</span><div className="text-lg font-semibold">{report.executive_summary.total_trades}</div></div>
          <div><span className="text-xs text-muted-foreground">Total blocks</span><div className="text-lg font-semibold">{report.executive_summary.total_blocks}</div></div>
          <div><span className="text-xs text-muted-foreground">Total incidents</span><div className="text-lg font-semibold">{report.executive_summary.total_incidents}</div></div>
          <div><span className="text-xs text-muted-foreground">Realized P&amp;L</span><div className="text-lg font-semibold">{formatNumber(report.executive_summary.realized_pnl, 8)}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trading summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.trading_summary.decision_counts).map(([decision, count]) => (
              <Badge key={decision} variant="outline">{decision}: {count}</Badge>
            ))}
          </div>
          <div>Trade count: {report.trading_summary.trade_count}</div>
          <div>Realized P&amp;L: {formatNumber(report.trading_summary.realized_pnl, 8)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prediction analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {report.prediction_analysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forecast backtest data for this bot yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horizon</TableHead>
                  <TableHead>Hit rate</TableHead>
                  <TableHead>Sample size</TableHead>
                  <TableHead>Avg. confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.prediction_analysis.map((horizon) => (
                  <TableRow key={horizon.horizon_seconds}>
                    <TableCell>{horizon.horizon_seconds}s</TableCell>
                    <TableCell>{horizon.hit_rate_pct != null ? `${formatNumber(horizon.hit_rate_pct, 2)}%` : "None"}</TableCell>
                    <TableCell>{horizon.sample_size}</TableCell>
                    <TableCell>{horizon.avg_confidence_pct != null ? `${formatNumber(horizon.avg_confidence_pct, 2)}%` : "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incident analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {report.incident_analysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents in this session's window.</p>
          ) : (
            <div className="space-y-2">
              {report.incident_analysis.map((incident) => (
                <div key={incident.id} className="rounded-lg border border-border/70 p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{incident.title}</span>
                    <div className="flex items-center gap-2">
                      <IncidentStatusBadge status={incident.status as IncidentStatus} />
                      <SeverityBadge severity={incident.severity} />
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {prettyLabel(incident.root_cause_category)} &middot; {incident.occurrence_count} occurrence{incident.occurrence_count === 1 ? "" : "s"}
                    {incident.self_recovered ? " · self-recovered" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial impact</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Realized P&amp;L: {formatNumber(report.financial_impact.realized_pnl, 8)}
        </CardContent>
      </Card>

      {report.recommendations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {report.recommendations.map((recommendation, index) => (
                <li key={index}>{recommendation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {report.health.blockers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health blockers observed</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {report.health.blockers.map((blocker) => (
              <Badge key={blocker} variant="outline">{prettyLabel(blocker)}</Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build/Version Comparison -- two-session picker + BuildComparisonService
// result rendered side-by-side. Every field rendered below matches a real
// key from BuildComparisonService::compare() (see the interface above); none
// were invented.
// ---------------------------------------------------------------------------

function ComparisonStat({
  label,
  valueA,
  valueB,
}: {
  label: string;
  valueA: ReactNode;
  valueB: ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-2 border-b border-border/50 py-2 text-sm last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-center font-medium">{valueA}</span>
      <span className="text-center font-medium">{valueB}</span>
    </div>
  );
}

function BuildComparisonSection({
  workspaceId,
  sessions,
}: {
  workspaceId: string;
  sessions: AuditSession[];
}) {
  const { toast } = useToast();
  const [sessionAId, setSessionAId] = useState<string>("");
  const [sessionBId, setSessionBId] = useState<string>("");

  const compareMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get<BuildComparisonResult>(
        `/workspaces/${workspaceId}/audit-research/compare`,
        { params: { session_a: sessionAId, session_b: sessionBId } },
      );
      return response.data;
    },
    onError: (error: Error) => {
      toast({ title: "Comparison failed", description: error.message, variant: "destructive" });
    },
  });

  const result = compareMutation.data ?? null;
  const canCompare = !!sessionAId && !!sessionBId && sessionAId !== sessionBId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compare two audit sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Session A">
              <Select value={sessionAId} onValueChange={setSessionAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name} ({session.build_version || "no build version"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Session B">
              <Select value={sessionBId} onValueChange={setSessionBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name} ({session.build_version || "no build version"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button
            type="button"
            onClick={() => compareMutation.mutate()}
            disabled={!canCompare || compareMutation.isPending}
          >
            Compare
          </Button>
          {sessionAId && sessionBId && sessionAId === sessionBId ? (
            <p className="text-xs text-destructive">Select two different sessions.</p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
              <span />
              <span className="text-center">{result.session_a.name}</span>
              <span className="text-center">{result.session_b.name}</span>
            </div>
            <div>
              <ComparisonStat
                label="Build version"
                valueA={result.session_a.build_version || "None"}
                valueB={result.session_b.build_version || "None"}
              />
              <ComparisonStat
                label="Status"
                valueA={prettyLabel(result.session_a.status)}
                valueB={prettyLabel(result.session_b.status)}
              />
              <ComparisonStat
                label="Environment"
                valueA={prettyLabel(result.session_a.environment)}
                valueB={prettyLabel(result.session_b.environment)}
              />
              <ComparisonStat
                label="Avg. hit rate %"
                valueA={result.prediction_accuracy.avg_hit_rate_pct.session_a != null ? `${formatNumber(result.prediction_accuracy.avg_hit_rate_pct.session_a, 2)}%` : "None"}
                valueB={result.prediction_accuracy.avg_hit_rate_pct.session_b != null ? `${formatNumber(result.prediction_accuracy.avg_hit_rate_pct.session_b, 2)}%` : "None"}
              />
              <ComparisonStat
                label="Execution failures"
                valueA={result.execution_failure_count.session_a}
                valueB={result.execution_failure_count.session_b}
              />
              <ComparisonStat
                label="Avg. decision latency (ms)"
                valueA={result.average_decision_latency_ms.session_a != null ? formatNumber(result.average_decision_latency_ms.session_a, 2) : "None"}
                valueB={result.average_decision_latency_ms.session_b != null ? formatNumber(result.average_decision_latency_ms.session_b, 2) : "None"}
              />
              <ComparisonStat
                label="Realized P&L"
                valueA={formatNumber(result.realized_pnl.session_a, 8)}
                valueB={formatNumber(result.realized_pnl.session_b, 8)}
              />
              <ComparisonStat
                label="Total incidents"
                valueA={result.total_incidents.session_a}
                valueB={result.total_incidents.session_b}
              />
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Root cause breakdown</div>
              <div className="grid gap-4 md:grid-cols-2">
                {(["session_a", "session_b"] as const).map((key) => {
                  const breakdown = result.root_cause_breakdown[key];
                  const nonZero = Object.entries(breakdown).filter(([, count]) => count > 0);
                  return (
                    <div key={key} className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="mb-1 font-medium">{key === "session_a" ? result.session_a.name : result.session_b.name}</div>
                      {nonZero.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No categorized incidents.</p>
                      ) : (
                        <div className="space-y-1">
                          {nonZero.map(([category, count]) => (
                            <div key={category} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{prettyLabel(category)}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production-Readiness Dashboard -- workspace-level, real evidence-based
// verdicts from ProductionReadinessService::evaluate(). INSUFFICIENT_DATA is
// an honest "not enough evidence yet" state, not a bad-news color.
// ---------------------------------------------------------------------------

function ReadinessCategoryCard({ categoryKey, category }: { categoryKey: string; category: ReadinessCategory }) {
  const extraEntries = Object.entries(category).filter(([key]) => key !== "verdict" && key !== "evidence");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-sm">{prettyLabel(categoryKey)}</CardTitle>
        <ReadinessVerdictBadge verdict={category.verdict} />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{category.evidence}</p>
        {extraEntries.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {extraEntries.map(([key, value]) => (
              <span key={key}>
                <span className="font-medium text-foreground">{prettyLabel(key)}:</span>{" "}
                {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProductionReadinessSection({
  workspaceId,
  ratioBots,
}: {
  workspaceId: string;
  ratioBots: RatioBotConfigOption[];
}) {
  const [botInstanceId, setBotInstanceId] = useState<string>("all");

  const readinessQuery = useQuery({
    queryKey: ["audit-research-readiness", workspaceId, botInstanceId],
    queryFn: async () => {
      const response = await api.get<ProductionReadinessResult>(
        `/workspaces/${workspaceId}/audit-research/readiness`,
        botInstanceId !== "all" ? { params: { bot_instance_id: botInstanceId } } : undefined,
      );
      return response.data;
    },
    enabled: !!workspaceId,
  });

  const readiness = readinessQuery.data ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Production readiness</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={botInstanceId} onValueChange={setBotInstanceId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Ratio Bot instances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratio Bot instances</SelectItem>
                {ratioBots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name} ({bot.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => readinessQuery.refetch()} disabled={readinessQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4", readinessQuery.isFetching && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {readinessQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading readiness scorecard...</div>
          ) : readiness ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 p-4">
                <span className="text-sm font-medium">Overall verdict:</span>
                <ReadinessVerdictBadge verdict={readiness.overall} />
                {readiness.overall === "INSUFFICIENT_DATA" ? (
                  <p className="text-xs text-muted-foreground">
                    This means most categories don't yet have enough real evidence to judge --
                    it is not a failure, just not enough data yet to call this production-ready.
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Generated at {formatDateTime(readiness.generated_at)}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(readiness.categories).map(([categoryKey, category]) => (
                  <ReadinessCategoryCard key={categoryKey} categoryKey={categoryKey} category={category} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              No readiness data available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
