import { toast } from "sonner";
import { Check, Circle, Loader2, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { ErrorBlock, LoadingBlock, MiniBar, RetryCountdown, RunStateBadge, ToneBadge } from "@/components/ml-training/MlBits";
import { DecisionReason, FoldsTable, KeyValueGrid } from "@/components/ml-training/ModelMetrics";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { useMlRetryRun, useMlRunDetail, useMlStopRun } from "@/hooks/useMlTraining";
import { useNow } from "@/hooks/useMlTrainingLive";
import { cn } from "@/lib/utils";
import {
  ML_TONE_CLASS, PHASES, mlCoin, mlDateTime, mlDuration, mlEffectiveRun, mlHorizonLabel, mlNumber, mlVerdict, mlWords,
  type MlEffectiveRun,
} from "@/lib/mlTraining";
import type { MlRunSummary } from "@/types/mlTraining";

function PhaseTimeline({ run, eff }: { run: MlRunSummary; eff: MlEffectiveRun }) {
  const current = run.phase ? PHASES.indexOf(run.phase) : -1;
  const ended = run.status !== "QUEUED" && run.status !== "RUNNING";
  const diedHere = ended && run.status !== "FINISHED";
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Run phases">
      {PHASES.map((phase, i) => {
        const done = run.status === "FINISHED" ? true : i < current;
        const now = i === current && !(run.status === "FINISHED");
        return (
          <li key={phase} className={cn("flex items-center gap-1", done ? "text-emerald-300" : now ? (diedHere || eff.stalled ? "text-rose-300" : "text-sky-300") : "text-slate-600")}>
            {done ? <Check className="h-3.5 w-3.5" /> : now && !diedHere && !eff.stalled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Circle className="h-3 w-3" />}
            {phase}
            {now && diedHere && <span className="text-[10px]">(stopped here)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-800 bg-slate-900/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="truncate text-sm tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

/** Stop and Retry for one run, each behind a confirm dialog. Hidden for read-only members. */
export function RunActionButtons({ run, onRetried }: { run: MlRunSummary; onRetried?: (newRunId: string) => void }) {
  const { workspaceId, canMutate } = useMlCtx();
  const stop = useMlStopRun(workspaceId);
  const retry = useMlRetryRun(workspaceId);
  const name = `${mlCoin(run.symbol)} ${mlHorizonLabel(run.horizon_minutes)}`;
  if (!canMutate) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {run.can_stop && (
        <ConfirmAction
          destructive
          trigger={<Button size="sm" variant="destructive" disabled={stop.isPending}><Square className="mr-2 h-3.5 w-3.5" />Stop</Button>}
          title={`Stop the ${name} run?`}
          description={run.status === "QUEUED" ? "It is still queued and will be cancelled at once." : "The worker is asked to stop; it ends within a few seconds. Nothing is traded either way."}
          confirmLabel="Stop run"
          pending={stop.isPending}
          onConfirm={async () => { await stop.mutateAsync(run.id); toast.info(`${name}: stop requested`); }}
        />
      )}
      {run.can_retry && (
        <ConfirmAction
          trigger={<Button size="sm" disabled={retry.isPending}><RotateCcw className="mr-2 h-3.5 w-3.5" />Retry</Button>}
          title={`Retry the ${name} run?`}
          description="A new run is queued as the next attempt. This one stays in the history."
          confirmLabel="Retry run"
          pending={retry.isPending}
          onConfirm={async () => { const r = await retry.mutateAsync(run.id); toast.success(`${name}: retry queued`); if (r?.run?.id) onRetried?.(r.run.id); }}
        />
      )}
    </div>
  );
}

interface RunDrawerProps {
  runId: string | null;
  onSelect: (id: string | null) => void;
}

export function RunDrawer({ runId, onSelect }: RunDrawerProps) {
  const { workspaceId, stallSeconds } = useMlCtx();
  const detail = useMlRunDetail(workspaceId, runId);
  const now = useNow(1000);
  const data = detail.data;
  const run = data?.run;
  const eff = run ? mlEffectiveRun(run, stallSeconds, now, detail.dataUpdatedAt) : null;
  const verdict = run && eff ? mlVerdict(run, eff) : null;

  return (
    <Sheet open={Boolean(runId)} onOpenChange={(open) => { if (!open) onSelect(null); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>{run ? `${mlCoin(run.symbol)} ${mlHorizonLabel(run.horizon_minutes)} run` : "Run"}</SheetTitle>
          <SheetDescription>Shadow training run. It never places an order.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!run && detail.isLoading && <LoadingBlock rows={4} />}
          {!run && detail.isError && <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />}
          {run && eff && verdict && (
            <div className={cn("space-y-4", detail.isError && "opacity-60")}>
              {detail.isError && <div role="alert" className="text-xs text-amber-300">Cannot refresh this run right now; showing the last data.</div>}
              <div className="flex flex-wrap items-center gap-2">
                <RunStateBadge eff={eff} />
                <span className="text-xs text-slate-400">{run.model_type ?? "model"} · source {run.source ?? "—"} · attempt {run.attempt ?? 1}/{run.max_attempts ?? "—"}</span>
                {run.next_retry_at && <span className="text-xs"><RetryCountdown iso={run.next_retry_at} nowMs={now} /></span>}
              </div>

              <div className={cn("rounded-md border p-3 text-sm", ML_TONE_CLASS[verdict.tone])}>{verdict.text}</div>

              {(run.status === "RUNNING" || run.status === "QUEUED") && (
                <div className="space-y-1">
                  <MiniBar value={run.progress_pct} tone={eff.stalled ? "bad" : "running"} label="Run progress" />
                  <div className="text-xs text-slate-500">{run.progress_pct != null ? `${Math.round(run.progress_pct)}% · ` : "progress unknown · "}phase {mlWords(run.phase)}</div>
                </div>
              )}

              <PhaseTimeline run={run} eff={eff} />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Elapsed" value={mlDuration(eff.elapsed)} />
                <Stat label="Heartbeat age" value={run.status === "RUNNING" ? mlDuration(eff.heartbeatAge) : "—"} />
                <Stat label="ETA" value={run.status === "RUNNING" ? (run.eta_seconds != null ? mlDuration(run.eta_seconds) : "no history yet") : "—"} />
                <Stat label="Rows exported" value={mlNumber(run.rows_exported)} />
                <Stat label="Queued" value={mlDateTime(run.queued_at)} />
                <Stat label="Finished" value={mlDateTime(run.finished_at)} />
              </div>

              {run.error_code || run.error_message ? (
                <div role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
                  <div className="font-medium">{run.error_code ? mlWords(run.error_code) : "error"}</div>
                  {run.error_message && <div className="break-words">{run.error_message}</div>}
                </div>
              ) : null}

              <RunActionButtons run={run} onRetried={(id) => onSelect(id)} />

              {(data?.attempts?.length ?? 0) > 1 && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Retry chain</div>
                  <ul className="space-y-1">
                    {data!.attempts.map((a) => {
                      const ae = mlEffectiveRun(a, stallSeconds, now, detail.dataUpdatedAt);
                      return (
                        <li key={a.id}>
                          <button type="button" onClick={() => onSelect(a.id)} disabled={a.id === run.id}
                            className="flex w-full items-center gap-2 rounded-md border border-slate-800 px-2 py-1.5 text-left text-xs hover:bg-slate-800/40 disabled:border-sky-500/40">
                            <span className="text-slate-400">attempt {a.attempt ?? "?"}</span>
                            <RunStateBadge eff={ae} />
                            <span className="ml-auto truncate text-slate-500">{mlDateTime(a.finished_at ?? a.queued_at)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {data?.model && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">Model</span>
                    <span className="break-all text-slate-200">{data.model.model_version ?? "—"}</span>
                    {data.model.status && <ToneBadge tone="neutral">{data.model.status}</ToneBadge>}
                  </div>
                  <DecisionReason code={data.model.decision_reason ?? run.outcome_reason} />
                  <KeyValueGrid title="Holdout (unseen data)" data={data.model.holdout} />
                  <KeyValueGrid title="Comparison with champion" data={data.model.comparison} />
                  <FoldsTable folds={data.model.folds} />
                </div>
              )}

              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Log (last lines, redacted)</div>
                {(data?.log_tail?.length ?? 0) > 0 ? (
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-slate-950 p-2 text-[11px] leading-snug text-slate-300" tabIndex={0}>
                    {data!.log_tail.join("\n")}
                  </pre>
                ) : <div className="text-xs text-slate-500">No log lines yet.</div>}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
