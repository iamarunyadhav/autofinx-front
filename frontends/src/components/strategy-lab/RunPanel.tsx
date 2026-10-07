import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { ErrorBlock, LoadingBlock } from "@/components/ml-training/MlBits";
import { ToneBadge } from "@/components/strategy-lab/LabShell";
import { ResultView } from "@/components/strategy-lab/ResultView";
import { useNow } from "@/hooks/useMlTrainingLive";
import { useLabCancelRun, useLabDecide, useLabRun } from "@/hooks/useStrategyLab";
import { cn } from "@/lib/utils";
import {
  LAB_ACTIVE_STATUSES,
  LAB_PHASES,
  labAgeSeconds,
  labCodeText,
  labDateTime,
  labDuration,
  labRunTone,
  labVerdictText,
  labWords,
  type LabRun,
} from "@/lib/strategyLab";

/** The runner heartbeats every ~1 s while a run is RUNNING; this long without one is worth a warning. */
const HEARTBEAT_WARN_SECONDS = 60;

function PhaseSteps({ phase }: { phase: string | null }) {
  const at = LAB_PHASES.indexOf((phase ?? "queued") as (typeof LAB_PHASES)[number]);
  return (
    <ol className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Run phase">
      {LAB_PHASES.map((p, i) => (
        <li
          key={p}
          aria-current={i === at ? "step" : undefined}
          className={cn(
            "rounded border px-1.5 py-0.5",
            i < at && "border-success/40 text-success",
            i === at && "border-primary/50 bg-primary/10 font-semibold text-primary",
            i > at && "border-border text-muted-foreground",
          )}
        >
          {labWords(p)}
        </li>
      ))}
    </ol>
  );
}

function ActiveRun({ run, canMutate, workspaceId }: { run: LabRun; canMutate: boolean; workspaceId: string }) {
  const now = useNow(1000);
  const cancel = useLabCancelRun(workspaceId);
  const hb = labAgeSeconds(run.heartbeat_at, now);
  const queuedFor = labAgeSeconds(run.queued_at, now);
  const elapsed = labAgeSeconds(run.started_at, now);
  const pct = run.progress_pct == null ? null : Math.max(0, Math.min(100, Number(run.progress_pct)));
  const quiet = run.status === "RUNNING" && hb != null && hb > HEARTBEAT_WARN_SECONDS;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge tone={labRunTone(run.status)} className={cn(run.status === "RUNNING" && "animate-pulse")}>{run.status}</ToneBadge>
          <span className="text-sm">{labWords(run.phase)}</span>
          {run.cancel_requested && <ToneBadge tone="warn">cancel requested</ToneBadge>}
        </div>
        {canMutate && (
          <ConfirmAction
            destructive
            trigger={
              <Button size="sm" variant="destructive" disabled={run.cancel_requested || cancel.isPending}>
                <Square className="mr-2 h-3.5 w-3.5" />{run.cancel_requested ? "Cancelling..." : "Cancel"}
              </Button>
            }
            title="Cancel this test?"
            description={run.status === "QUEUED" ? "It hasn't started yet, so it's cancelled at once." : "The runner is asked to stop; it ends within a few seconds."}
            confirmLabel="Cancel test"
            pending={cancel.isPending}
            onConfirm={async () => { await cancel.mutateAsync(run.id); toast.info("Cancel requested"); }}
          />
        )}
      </div>
      <PhaseSteps phase={run.phase} />
      <div className="space-y-1">
        <Progress value={pct ?? 0} className="h-2" aria-label="Run progress" />
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{pct == null ? "progress unknown" : `${pct.toFixed(0)}%`}</span>
          <span>
            {run.status === "QUEUED"
              ? `queued ${labDuration(queuedFor)} ago`
              : `running ${labDuration(elapsed)} · heartbeat ${hb == null ? "—" : `${labDuration(hb)} ago`}`}
          </span>
        </div>
      </div>
      {run.status === "QUEUED" && (
        <p className="text-xs text-muted-foreground">Waiting for the research worker to pick it up. Tests only run where the research data set is available.</p>
      )}
      {quiet && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          No heartbeat for {labDuration(hb)}. The worker may have stopped.
        </div>
      )}
    </div>
  );
}

function FailedRun({ run }: { run: LabRun }) {
  const friendly = labCodeText(run.error_code);
  const cancelled = run.status === "CANCELLED";
  return (
    <div className="space-y-3">
      <div role={cancelled ? "status" : "alert"} className={cn("rounded-lg border p-4 text-sm", cancelled ? "border-warning/40 bg-warning/10" : "border-error/40 bg-error/10")}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <ToneBadge tone={labRunTone(run.status)}>{run.status}</ToneBadge>
          {run.error_code && <span className="font-mono text-xs">{run.error_code}</span>}
        </div>
        {friendly && <p>{friendly}</p>}
        {run.error_message && run.error_message !== friendly && <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{run.error_message}</p>}
      </div>
      {run.log_tail && (
        <div>
          <div className="mb-1 text-xs font-semibold">Log tail</div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">{run.log_tail}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Owner decision under a completed run. Worded as permission to continue
 * research — never as "accuracy X%, use it?". Decisions are immutable.
 */
function DecisionBox({ run, workspaceId }: { run: LabRun; workspaceId: string }) {
  const decide = useLabDecide(workspaceId);
  const [notes, setNotes] = useState("");
  const approveLabel = run.kind === "QUICK" ? "Approve Deep Test" : "Approve Research Experiment";
  const verdict = run.verdict ?? run.summary?.verdict ?? null;

  const submit = async (decision: "APPROVE" | "REJECT") => {
    await decide.mutateAsync({ runId: run.id, decision, notes: notes.trim() || undefined });
    toast.success(decision === "APPROVE" ? `Recorded: ${approveLabel.toLowerCase()}` : "Recorded: candidate rejected");
    setNotes("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm">
        Development evidence suggests: <strong>{verdict ?? "UNKNOWN"}</strong>
        {verdict && <span className="text-muted-foreground"> ({labVerdictText(verdict)})</span>}. Approve this candidate for the next research stage?
      </p>
      <div className="space-y-1">
        <Label htmlFor={`sl-decision-notes-${run.id}`}>Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id={`sl-decision-notes-${run.id}`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={decide.isPending} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmAction
          destructive
          trigger={<Button variant="outline" disabled={decide.isPending}>Reject</Button>}
          title="Reject this candidate?"
          description="The candidate is closed as REJECTED. Decisions are permanent and can't be changed."
          confirmLabel="Reject"
          pending={decide.isPending}
          onConfirm={() => submit("REJECT")}
        />
        <ConfirmAction
          trigger={<Button disabled={decide.isPending}>{approveLabel}</Button>}
          title={`${approveLabel}?`}
          description={
            run.kind === "QUICK"
              ? "This records permission to run a Deep Test of this version. Decisions are permanent."
              : "This records permission to use the candidate in a research experiment. It changes no model and no trading. Decisions are permanent."
          }
          confirmLabel={approveLabel}
          pending={decide.isPending}
          onConfirm={() => submit("APPROVE")}
        />
      </div>
      <p className="text-xs text-muted-foreground">Approval = permission to continue research, not proof and not production use.</p>
    </div>
  );
}

function RecordedDecision({ run }: { run: LabRun }) {
  const d = run.decision;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>Owner decision:</span>
        <ToneBadge tone={d.decision === "APPROVE" ? "good" : "bad"}>{d.decision}</ToneBadge>
        <span className="text-muted-foreground">scope {labWords(d.scope)} · {labDateTime(d.created_at)}</span>
      </div>
      {d.notes && <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{d.notes}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Approval = permission to continue research, not proof and not production use.</p>
    </div>
  );
}

interface RunPanelProps {
  runId: string;
  workspaceId: string;
  canMutate: boolean;
  candidateClosed: boolean;
}

/** One run: live progress while active, then the result / failure, then the owner decision. */
export function RunPanel({ runId, workspaceId, canMutate, candidateClosed }: RunPanelProps) {
  const q = useLabRun(workspaceId, runId);
  const run = q.data?.run;

  if (!run && q.isLoading) return <LoadingBlock rows={3} />;
  if (!run && q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  if (!run) return null;

  const active = LAB_ACTIVE_STATUSES.includes(run.status);

  return (
    <div className="space-y-4">
      {q.isError && <div role="alert" className="text-xs text-warning">Can't refresh this run; showing the last data received.</div>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Run <span className="font-mono">{run.id.slice(0, 8)}</span></span>
        {run.sample_policy && <span>Policy <span className="font-mono">{run.sample_policy}</span></span>}
        {run.adapter && <span>Adapter <span className="font-mono">{run.adapter}</span></span>}
        <span>Queued {labDateTime(run.queued_at)}</span>
        {run.finished_at && <span>Finished {labDateTime(run.finished_at)}</span>}
        {run.result_sha256 && <span className="break-all">Result sha256 <span className="font-mono">{run.result_sha256.slice(0, 16)}…</span></span>}
      </div>

      {active && <ActiveRun run={run} canMutate={canMutate} workspaceId={workspaceId} />}
      {(run.status === "FAILED" || run.status === "CANCELLED") && <FailedRun run={run} />}
      {run.status === "COMPLETED" && (
        <>
          {run.summary ? (
            <ResultView result={run.summary} kind={run.kind} verdict={run.verdict} />
          ) : (
            <p className="text-sm text-muted-foreground">The run completed but no result summary was stored.</p>
          )}
          {run.decision ? (
            <RecordedDecision run={run} />
          ) : canMutate && !candidateClosed ? (
            <DecisionBox run={run} workspaceId={workspaceId} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {candidateClosed ? "The candidate is closed, so no decision can be recorded." : "Waiting for a workspace owner or admin to decide."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
