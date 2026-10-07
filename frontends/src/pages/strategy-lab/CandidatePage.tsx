import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Archive, ArrowLeft, Check, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/ml-training/MlBits";
import { LabChart } from "@/components/strategy-lab/LabChart";
import { LabShell, ToneBadge, type LabAccess } from "@/components/strategy-lab/LabShell";
import { RunPanel } from "@/components/strategy-lab/RunPanel";
import { SourceInput } from "@/components/strategy-lab/SourceInput";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLabAddVersion, useLabArchive, useLabCandidate, useLabChart, useLabStartRun } from "@/hooks/useStrategyLab";
import { cn } from "@/lib/utils";
import {
  LAB_ACTIVE_STATUSES,
  LAB_AUDIT_BLOCKING,
  LAB_CLOSED_STATUSES,
  LAB_LIFECYCLE,
  LAB_MAX_SOURCE_BYTES,
  LabApiError,
  labAuditTone,
  labByteLength,
  labCodeText,
  labDateTime,
  labErrorMessage,
  labRunTone,
  labStatusTone,
  labUuid,
  labVerdictTone,
  labWords,
  type LabCandidateDetail,
  type LabRun,
  type LabRunKind,
  type LabVersion,
} from "@/lib/strategyLab";

type TabKey = "overview" | "source" | "audit" | "quick" | "deep" | "chart" | "history";

const runLabel = (run: LabRun, versionNo: (id: string) => string) =>
  `${versionNo(run.version_id)} · ${run.status === "COMPLETED" && run.verdict ? run.verdict : run.status} · ${labDateTime(run.queued_at)}`;

/* ------------------------------------------------------------ lifecycle */

function LifecycleStepper({ status }: { status: string }) {
  const closed = LAB_CLOSED_STATUSES.includes(status);
  const at = LAB_LIFECYCLE.indexOf(status as (typeof LAB_LIFECYCLE)[number]);
  return (
    <div className="space-y-2">
      <ol className={cn("grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6", closed && "opacity-50")} aria-label="Candidate lifecycle">
        {LAB_LIFECYCLE.map((s, i) => {
          const done = !closed && i < at;
          const current = !closed && i === at;
          return (
            <li
              key={s}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                done && "border-success/40 text-success",
                current && "border-primary/60 bg-primary/10 font-semibold text-primary",
                !done && !current && "border-border text-muted-foreground",
              )}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]", current ? "border-primary" : "border-current")}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="min-w-0 break-words">{labWords(s)}</span>
            </li>
          );
        })}
      </ol>
      {closed && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ToneBadge tone={labStatusTone(status)}>{status}</ToneBadge>
          <span className="text-muted-foreground">This candidate is closed. Its history stays readable; nothing more can be run or decided.</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- helpers */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

function VersionSelect({ versions, value, onChange }: { versions: LabVersion[]; value: string | undefined; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sl-version" className="text-xs text-muted-foreground">Version</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="sl-version" className="h-8 w-[min(16rem,70vw)]"><SelectValue placeholder="Choose a version" /></SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              v{v.version} · {v.audit_status ?? "no audit"}{v.testable ? " · testable" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---------------------------------------------------------------- tabs */

function SourceTab({ c, version, access, onAdded }: { c: LabCandidateDetail; version: LabVersion | undefined; access: LabAccess; onAdded: (versionId: string) => void }) {
  const add = useLabAddVersion(access.workspaceId);
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closed = LAB_CLOSED_STATUSES.includes(c.status);
  const ready = source.trim().length > 0 && labByteLength(source) <= LAB_MAX_SOURCE_BYTES;

  const submit = async () => {
    setError(null);
    try {
      const res = await add.mutateAsync({ candidateId: c.id, source, notes: notes.trim() || undefined });
      toast.success(`Version ${res?.version?.version ?? ""} saved and audited as text`);
      setSource("");
      setNotes("");
      if (res?.version?.id) onAdded(res.version.id);
    } catch (e) {
      setError(labErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      {version ? (
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Version {version.version}</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="sha256"><span className="break-all font-mono text-xs">{version.sha256}</span></Field>
              <Field label="Created">{labDateTime(version.created_at)}</Field>
              <Field label="Translation (adapter)">{version.adapter_label ?? <span className="text-muted-foreground">none — not testable</span>}</Field>
              <Field label="Notes">{version.notes || "—"}</Field>
            </dl>
            {/* Rendered as a text node: React escapes it. Never dangerouslySetInnerHTML. */}
            <pre className="max-h-[32rem] overflow-auto whitespace-pre rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed" aria-label="Source code (read-only)">
              {version.source ?? ""}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <EmptyBlock title="No version" />
      )}

      {access.canMutate && !closed && (
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Add a new version</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <p className="text-xs text-muted-foreground">The new source is stored and statically audited as text; it is never executed.</p>
            <SourceInput id="sl-new-version" value={source} onChange={setSource} disabled={add.isPending} rows={10} />
            <div className="space-y-1">
              <Label htmlFor="sl-new-version-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="sl-new-version-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} disabled={add.isPending} />
            </div>
            {error && <div role="alert" className="rounded-md border border-error/40 bg-error/10 p-2 text-sm text-error">{error}</div>}
            <Button onClick={() => void submit()} disabled={!ready || add.isPending}>
              {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save new version
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuditTab({ version }: { version: LabVersion | undefined }) {
  const audit = version?.audit;
  if (!version || !audit) return <EmptyBlock title="No audit for this version" />;
  const findings = audit.findings ?? [];
  const indicators = audit.indicators ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Classification</span>
            <ToneBadge tone={labAuditTone(audit.classification)} className="px-2 py-1 text-xs">{audit.classification}</ToneBadge>
            {LAB_AUDIT_BLOCKING.includes(audit.classification) && <span className="text-xs text-error">blocks testing</span>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Pine version">{audit.pine_version ?? "—"}</Field>
            <Field label="Script type">{audit.script_type ?? "—"}</Field>
            <Field label="Lines">{audit.lines ?? "—"}</Field>
            <Field label="Inputs">{audit.inputs_count ?? "—"}</Field>
            <Field label="Overfit risk">
              {audit.overfit_risk ? <ToneBadge tone={audit.overfit_risk === "HIGH" ? "bad" : audit.overfit_risk === "MEDIUM" ? "warn" : "good"}>{audit.overfit_risk}</ToneBadge> : "—"}
            </Field>
            <Field label="Higher-timeframe reads">{audit.htf_reads == null ? "—" : String(audit.htf_reads)}</Field>
          </dl>
          <p className="text-xs text-muted-foreground">Static text audit only — the script was not executed.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Findings</CardTitle></CardHeader>
        <CardContent className="p-0">
          {findings.length === 0 ? (
            <p className="p-4 pt-0 text-sm text-muted-foreground">No findings.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Construct</TableHead><TableHead>Classification</TableHead><TableHead>Detail</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="break-all align-top font-mono text-xs">{f.construct}</TableCell>
                      <TableCell className="align-top"><ToneBadge tone={labAuditTone(f.classification)}>{f.classification}</ToneBadge></TableCell>
                      <TableCell className="min-w-[12rem] align-top text-xs">{f.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Indicators</CardTitle></CardHeader>
        <CardContent className="p-0">
          {indicators.length === 0 ? (
            <p className="p-4 pt-0 text-sm text-muted-foreground">No ta.* indicator calls found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Function</TableHead><TableHead className="text-right">Calls</TableHead><TableHead>Existing V4 equivalent</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.map((x) => (
                    <TableRow key={x.function}>
                      <TableCell className="font-mono text-xs">{x.function}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{x.calls}</TableCell>
                      <TableCell className="text-xs">{x.existing_v4_equivalent ?? <ToneBadge tone="running">new</ToneBadge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunTab({
  kind, runs, selected, onSelect, versionNo, access, closed, startButton,
}: {
  kind: LabRunKind;
  runs: LabRun[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  versionNo: (id: string) => string;
  access: LabAccess;
  closed: boolean;
  startButton: ReactNode;
}) {
  const title = kind === "QUICK" ? "quick test" : "deep test";
  if (runs.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyBlock title={`No ${title} yet`} hint={kind === "QUICK" ? "Run a quick test on a testable version." : "A deep test needs an owner approval on a completed quick test of the same version."} />
        {startButton}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`sl-run-${kind}`} className="text-xs text-muted-foreground">Run</Label>
          <Select value={selected} onValueChange={onSelect}>
            <SelectTrigger id={`sl-run-${kind}`} className="h-8 w-[min(22rem,75vw)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {runs.map((r) => <SelectItem key={r.id} value={r.id}>{runLabel(r, versionNo)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {startButton}
      </div>
      {selected && <RunPanel key={selected} runId={selected} workspaceId={access.workspaceId} canMutate={access.canMutate} candidateClosed={closed} />}
    </div>
  );
}

function ChartTab({ runs, selected, onSelect, versionNo, workspaceId }: {
  runs: LabRun[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  versionNo: (id: string) => string;
  workspaceId: string;
}) {
  const isMobile = useIsMobile();
  const q = useLabChart(workspaceId, selected);
  if (runs.length === 0) return <EmptyBlock title="No chart yet" hint="A chart is produced by a completed quick test." />;
  const noChart = q.error instanceof LabApiError && (q.error.code === "NO_CHART" || q.error.status === 404);
  return (
    <div className="space-y-3">
      {runs.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="sl-chart-run" className="text-xs text-muted-foreground">Quick test</Label>
          <Select value={selected} onValueChange={onSelect}>
            <SelectTrigger id="sl-chart-run" className="h-8 w-[min(22rem,75vw)]"><SelectValue /></SelectTrigger>
            <SelectContent>{runs.map((r) => <SelectItem key={r.id} value={r.id}>{runLabel(r, versionNo)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {q.isLoading && <LoadingBlock rows={3} />}
      {noChart && <EmptyBlock title="No chart for this run" hint="The runner didn't write a chart for it." />}
      {q.isError && !noChart && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data?.chart && (
        (q.data.chart.candles ?? []).length === 0
          ? <EmptyBlock title="The chart has no candles" />
          : <Card><CardContent className="p-3 sm:p-4"><LabChart chart={q.data.chart} height={isMobile ? 300 : 440} /></CardContent></Card>
      )}
    </div>
  );
}

function HistoryTab({ c, versionNo, openRun }: { c: LabCandidateDetail; versionNo: (id: string) => string; openRun: (run: LabRun) => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Runs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c.runs.length === 0 ? <p className="p-4 pt-0 text-sm text-muted-foreground">No runs yet.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="hidden md:table-cell">Queued</TableHead>
                    <TableHead className="hidden lg:table-cell">Finished</TableHead>
                    <TableHead className="hidden sm:table-cell">Decision</TableHead>
                    <TableHead><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.kind}</TableCell>
                      <TableCell className="font-mono text-xs">{versionNo(r.version_id)}</TableCell>
                      <TableCell>
                        {r.status === "COMPLETED" && r.verdict
                          ? <ToneBadge tone={labVerdictTone(r.verdict)}>{r.verdict}</ToneBadge>
                          : <ToneBadge tone={labRunTone(r.status)}>{r.status}</ToneBadge>}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{labDateTime(r.queued_at)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">{labDateTime(r.finished_at)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {r.decision ? <ToneBadge tone={r.decision.decision === "APPROVE" ? "good" : "bad"}>{r.decision.decision}</ToneBadge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openRun(r)}>Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Owner decisions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c.approvals.length === 0 ? <p className="p-4 pt-0 text-sm text-muted-foreground">No decisions yet.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="hidden sm:table-cell">Version</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.approvals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{labDateTime(a.created_at)}</TableCell>
                      <TableCell><ToneBadge tone={a.decision === "APPROVE" ? "good" : "bad"}>{a.decision}</ToneBadge></TableCell>
                      <TableCell className="text-xs">{labWords(a.scope)}</TableCell>
                      <TableCell className="hidden font-mono text-xs sm:table-cell">{a.version_id ? versionNo(a.version_id) : "—"}</TableCell>
                      <TableCell className="min-w-[10rem] whitespace-pre-wrap break-words text-xs">{a.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="p-4 pt-2 text-xs text-muted-foreground">Approval = permission to continue research, not proof and not production use.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

function CandidateView({ candidateId, access }: { candidateId: string; access: LabAccess }) {
  const navigate = useNavigate();
  const q = useLabCandidate(access.workspaceId, candidateId);
  const start = useLabStartRun(access.workspaceId);
  const archive = useLabArchive(access.workspaceId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [versionId, setVersionId] = useState<string | undefined>();
  const [picked, setPicked] = useState<{ QUICK?: string; DEEP?: string; chart?: string }>({});
  const [startError, setStartError] = useState<{ kind: LabRunKind; text: string } | null>(null);

  const c = q.data?.candidate;
  const versions = useMemo(() => [...(c?.versions ?? [])].sort((a, b) => b.version - a.version), [c?.versions]);
  const runs = useMemo(() => c?.runs ?? [], [c?.runs]);
  const versionNo = useMemo(() => {
    const map = new Map(versions.map((v) => [v.id, `v${v.version}`]));
    return (id: string) => map.get(id) ?? "v?";
  }, [versions]);

  if (!c && q.isLoading) return <LoadingBlock rows={5} />;
  if (!c && q.error instanceof LabApiError && q.error.status === 404) {
    return <EmptyBlock title="Candidate not found" hint={<Link to="/strategy-lab" className="text-primary hover:underline">Back to Strategy Lab</Link>} />;
  }
  if (!c && q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  if (!c) return null;

  const version = versions.find((v) => v.id === versionId) ?? versions[0];
  const closed = LAB_CLOSED_STATUSES.includes(c.status);
  const runsOf = (kind: LabRunKind) => runs.filter((r) => r.kind === kind);
  const defaultRun = (kind: LabRunKind) => runsOf(kind).find((r) => r.version_id === version?.id)?.id ?? runsOf(kind)[0]?.id;
  const selectedRun = (kind: LabRunKind) => {
    const p = picked[kind];
    return p && runs.some((r) => r.id === p) ? p : defaultRun(kind);
  };
  const completedQuick = runsOf("QUICK").filter((r) => r.status === "COMPLETED");
  const chartRun = (() => {
    const p = picked.chart;
    if (p && completedQuick.some((r) => r.id === p)) return p;
    const sel = selectedRun("QUICK");
    return completedQuick.some((r) => r.id === sel) ? sel : completedQuick[0]?.id;
  })();
  const anyActive = runs.some((r) => LAB_ACTIVE_STATUSES.includes(r.status));

  /** Why a run button is disabled (null = allowed). RUNNER_UNAVAILABLE / DISABLED are only known after the server answers. */
  const blockReason = (kind: LabRunKind): string | null => {
    if (!access.canMutate) return "Only a workspace owner or admin can start tests.";
    if (closed) return labCodeText("CANDIDATE_CLOSED");
    if (!version) return "There is no version to test.";
    if (version.audit_status && LAB_AUDIT_BLOCKING.includes(version.audit_status)) return labCodeText("AUDIT_BLOCKED");
    if (!version.testable) return labCodeText("NEEDS_TRANSLATION");
    if (runs.some((r) => r.kind === kind && r.version_id === version.id && LAB_ACTIVE_STATUSES.includes(r.status))) {
      return `A ${kind === "QUICK" ? "quick" : "deep"} test of v${version.version} is already queued or running.`;
    }
    if (kind === "DEEP") {
      const approved = c.approvals.some((a) => a.scope === "DEEP_TEST" && a.decision === "APPROVE"
        && (a.version_id === version.id || runs.find((r) => r.id === a.run_id)?.version_id === version.id));
      if (!approved) return labCodeText("APPROVAL_REQUIRED");
    }
    return null;
  };

  const startRun = async (kind: LabRunKind) => {
    if (!version) return;
    setStartError(null);
    try {
      // A fresh key per click: a retried request for this click can never queue a second run.
      const res = await start.mutateAsync({ versionId: version.id, kind, idempotencyKey: labUuid() });
      toast.success(`${kind === "QUICK" ? "Quick" : "Deep"} test of v${version.version} queued`);
      if (res?.run?.id) setPicked((p) => ({ ...p, [kind]: res.run.id }));
      setTab(kind === "QUICK" ? "quick" : "deep");
    } catch (e) {
      const text = labErrorMessage(e);
      setStartError({ kind, text });
      toast.error(text);
    }
  };

  const runButton = (kind: LabRunKind) => {
    const reason = blockReason(kind);
    const pending = start.isPending && start.variables?.kind === kind;
    return (
      <div className="space-y-1">
        <Button onClick={() => void startRun(kind)} disabled={Boolean(reason) || start.isPending} title={reason ?? undefined}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run {kind === "QUICK" ? "Quick" : "Deep"} Test{version ? ` (v${version.version})` : ""}
        </Button>
        {reason && <p className="max-w-md text-xs text-muted-foreground">{reason}</p>}
        {!reason && startError?.kind === kind && <p role="alert" className="max-w-md text-xs text-error">{startError.text}</p>}
      </div>
    );
  };

  const openRun = (r: LabRun) => {
    setPicked((p) => ({ ...p, [r.kind]: r.id }));
    setTab(r.kind === "QUICK" ? "quick" : "deep");
  };

  return (
    <div className="space-y-4">
      {q.isError && <div role="alert" className="text-xs text-warning">Can't refresh this candidate; showing the last data received.</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-lg font-semibold">{c.name}</h2>
            <ToneBadge tone={labStatusTone(c.status)}>{c.status}</ToneBadge>
          </div>
          {c.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.description}</p>}
        </div>
        {versions.length > 0 && <VersionSelect versions={versions} value={version?.id} onChange={setVersionId} />}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="quick">Quick test</TabsTrigger>
          <TabsTrigger value="deep">Deep test</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Lifecycle</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0"><LifecycleStepper status={c.status} /></CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Source type">{c.source_type}</Field>
                <Field label="Intended purpose">{labWords(c.intended_purpose)}</Field>
                <Field label="Original timeframe">{c.original_timeframe || "—"}</Field>
                <Field label="Versions">{versions.length}</Field>
                <Field label="Selected version">{version ? `v${version.version}` : "—"}</Field>
                <Field label="Audit">{version?.audit_status ? <ToneBadge tone={labAuditTone(version.audit_status)}>{version.audit_status}</ToneBadge> : "—"}</Field>
                <Field label="Created">{labDateTime(c.created_at)}</Field>
                <Field label="Updated">{labDateTime(c.updated_at)}</Field>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Tests</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <p className="text-xs text-muted-foreground">
                Tests run the reviewed translation on development data only, on the research PC where the 5-year data lives. A deep test needs an owner approval on a completed quick test of the same version.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                {runButton("QUICK")}
                {runButton("DEEP")}
              </div>
            </CardContent>
          </Card>
          {access.canMutate && !closed && (
            <div className="flex justify-end">
              <ConfirmAction
                destructive
                trigger={<Button variant="outline" size="sm" disabled={archive.isPending || anyActive} title={anyActive ? labCodeText("RUN_ACTIVE") ?? undefined : undefined}><Archive className="mr-2 h-3.5 w-3.5" />Archive</Button>}
                title="Archive this candidate?"
                description="An archived candidate is closed: no new versions, tests or decisions. Its history stays readable."
                confirmLabel="Archive"
                pending={archive.isPending}
                onConfirm={async () => { await archive.mutateAsync(c.id); toast.info("Candidate archived"); }}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="source"><SourceTab c={c} version={version} access={access} onAdded={setVersionId} /></TabsContent>
        <TabsContent value="audit"><AuditTab version={version} /></TabsContent>
        <TabsContent value="quick">
          <RunTab kind="QUICK" runs={runsOf("QUICK")} selected={selectedRun("QUICK")} onSelect={(id) => setPicked((p) => ({ ...p, QUICK: id }))}
            versionNo={versionNo} access={access} closed={closed} startButton={runButton("QUICK")} />
        </TabsContent>
        <TabsContent value="deep">
          <RunTab kind="DEEP" runs={runsOf("DEEP")} selected={selectedRun("DEEP")} onSelect={(id) => setPicked((p) => ({ ...p, DEEP: id }))}
            versionNo={versionNo} access={access} closed={closed} startButton={runButton("DEEP")} />
        </TabsContent>
        <TabsContent value="chart">
          <ChartTab runs={completedQuick} selected={chartRun} onSelect={(id) => setPicked((p) => ({ ...p, chart: id }))} versionNo={versionNo} workspaceId={access.workspaceId} />
        </TabsContent>
        <TabsContent value="history"><HistoryTab c={c} versionNo={versionNo} openRun={openRun} /></TabsContent>
      </Tabs>

      <Button variant="ghost" size="sm" onClick={() => navigate("/strategy-lab")}><ArrowLeft className="mr-2 h-3.5 w-3.5" />All candidates</Button>
    </div>
  );
}

export default function CandidatePage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  return (
    <LabShell
      title="Strategy Lab"
      description={<Link to="/strategy-lab" className="inline-flex items-center text-primary hover:underline"><ArrowLeft className="mr-1 h-3.5 w-3.5" />All candidates</Link>}
    >
      {(access) => (candidateId ? <CandidateView key={candidateId} candidateId={candidateId} access={access} /> : <EmptyBlock title="No candidate selected" />)}
    </LabShell>
  );
}
