import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { CandleStateBadge, EmptyBlock, ErrorBlock, LoadingBlock, MiniBar, RetryCountdown, RunStateBadge, ToneBadge } from "@/components/ml-training/MlBits";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { MlShell } from "@/components/ml-training/MlShell";
import { RunDrawer } from "@/components/ml-training/RunDrawer";
import { useMlOverview, useMlResumeBackfill, useMlRetryRun, useMlSystem } from "@/hooks/useMlTraining";
import { useNow } from "@/hooks/useMlTrainingLive";
import { cn } from "@/lib/utils";
import {
  ML_TONE_CLASS, mlAgo, mlCoin, mlDateTime, mlDuration, mlEffectiveRun, mlHorizonLabel, mlNumber, mlReasonText, mlWords,
  type MlRunTone,
} from "@/lib/mlTraining";
import type { MlAlert, MlHorizonRow, MlRunSummary, MlSystem } from "@/types/mlTraining";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
const SEVERITY_TONE: Record<string, MlRunTone> = { critical: "bad", warning: "warn", info: "neutral" };

function AlertAction({ alert, onOpenRun }: { alert: MlAlert; onOpenRun: (id: string) => void }) {
  const { workspaceId, canMutate } = useMlCtx();
  const retry = useMlRetryRun(workspaceId);
  const resume = useMlResumeBackfill(workspaceId);
  const action = alert.action;
  if (!action) return null;
  if (action.type === "open_run" && action.run_id) {
    return <Button size="sm" variant="outline" onClick={() => onOpenRun(action.run_id as string)}>Open run</Button>;
  }
  if (!canMutate) return null;
  if (action.type === "retry_run" && action.run_id) {
    return (
      <ConfirmAction
        trigger={<Button size="sm" variant="outline" disabled={retry.isPending}>Retry run</Button>}
        title="Retry this run?"
        description="A new run is queued as the next attempt. The failed one stays in the history."
        confirmLabel="Retry run"
        pending={retry.isPending}
        onConfirm={async () => { await retry.mutateAsync(action.run_id as string); toast.success("Retry queued"); }}
      />
    );
  }
  if (action.type === "resume_backfill" && (action.symbol || alert.symbol)) {
    const symbol = (action.symbol || alert.symbol) as string;
    return (
      <ConfirmAction
        trigger={<Button size="sm" variant="outline" disabled={resume.isPending}>Resume download</Button>}
        title={`Resume the ${mlCoin(symbol)} history download?`}
        description="Continues from the saved checkpoint. It only reads exchange candles and writes them to the database."
        confirmLabel="Resume"
        pending={resume.isPending}
        onConfirm={async () => { await resume.mutateAsync(symbol); toast.success(`${mlCoin(symbol)} download resumed`); }}
      />
    );
  }
  return null;
}

function AlertBanner({ alerts, onOpenRun }: { alerts: MlAlert[]; onOpenRun: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
  const shown = showAll ? sorted : sorted.slice(0, 4);
  if (sorted.length === 0) {
    return <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">No alerts. The pipeline looks healthy.</div>;
  }
  return (
    <section aria-label="Alerts" className="space-y-2">
      {shown.map((a) => {
        const Icon = a.severity === "critical" ? OctagonAlert : a.severity === "warning" ? AlertTriangle : Info;
        return (
          <div key={a.id} role={a.severity === "critical" ? "alert" : "status"} className={cn("flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center", ML_TONE_CLASS[SEVERITY_TONE[a.severity] ?? "neutral"])}>
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{a.title}</div>
              {a.detail && <div className="break-words text-xs opacity-80">{a.detail}</div>}
              {a.since && <div className="text-[11px] opacity-60">since {mlAgo(a.since)}</div>}
            </div>
            <AlertAction alert={a} onOpenRun={onOpenRun} />
          </div>
        );
      })}
      {sorted.length > 4 && (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${sorted.length} alerts`}</Button>
      )}
    </section>
  );
}

function HostStrip({ system }: { system: MlSystem | undefined }) {
  const host = system?.host;
  const level = system?.health?.level;
  const tone: MlRunTone = level === "critical" ? "bad" : level === "warning" ? "warn" : level === "ok" ? "good" : "neutral";
  const cores = host?.cores ?? null;
  const loadPerCore = host?.load?.m1 != null && cores ? host.load.m1 / cores : null;
  const items: Array<[string, string]> = [
    ["Load / core", loadPerCore != null ? loadPerCore.toFixed(2) : "—"],
    ["RAM used", host?.memory?.used_pct != null ? `${host.memory.used_pct.toFixed(0)}%` : "—"],
    ["Swap used", host?.swap?.used_pct != null ? `${host.swap.used_pct.toFixed(0)}%` : "—"],
    ["Disk free", host?.disk?.free_gb != null ? `${host.disk.free_gb.toFixed(1)} GB` : "—"],
  ];
  return (
    <section aria-label="Host health" className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3", ML_TONE_CLASS[tone])}>
      <div className="text-sm font-medium">Host: {level ?? "unknown"}</div>
      {items.map(([k, v]) => (
        <div key={k} className="text-xs"><span className="opacity-70">{k} </span><span className="font-semibold tabular-nums">{v}</span></div>
      ))}
      {(system?.health?.reasons?.length ?? 0) > 0 && <div className="min-w-0 basis-full text-xs opacity-80">{system!.health!.reasons.join(" · ")}</div>}
      <Link to="/ml-training/system" className="ml-auto text-xs underline underline-offset-2">Details</Link>
    </section>
  );
}

function ActiveRunCard({ run, nowMs, fetchedAt, stallSeconds, onOpen }: { run: MlRunSummary; nowMs: number; fetchedAt: number; stallSeconds: number; onOpen: () => void }) {
  const eff = mlEffectiveRun(run, stallSeconds, nowMs, fetchedAt);
  return (
    <button type="button" onClick={onOpen} className={cn("w-full min-w-0 rounded-lg border p-3 text-left transition-colors hover:bg-slate-800/40", eff.stalled ? "border-rose-500/50" : "border-slate-800")}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{mlCoin(run.symbol)} {mlHorizonLabel(run.horizon_minutes)}</span>
        <RunStateBadge eff={eff} />
        <span className="ml-auto text-[11px] text-slate-500">{mlWords(run.phase)}</span>
      </div>
      <div className="mt-2"><MiniBar value={run.progress_pct} tone={eff.stalled ? "bad" : "running"} label="Progress" /></div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-400">
        <span>{run.progress_pct != null ? `${Math.round(run.progress_pct)}%` : "progress n/a"}</span>
        <span>elapsed {mlDuration(eff.elapsed)}</span>
        {run.status === "RUNNING" && <span className={eff.stalled ? "text-rose-300" : ""}>heartbeat {mlDuration(eff.heartbeatAge)} ago</span>}
        {run.status === "QUEUED" && <span>waiting in queue</span>}
      </div>
    </button>
  );
}

function horizonChip(h: MlHorizonRow, stallSeconds: number): { text: string; tone: MlRunTone; title: string; runId: string | null } {
  if (h.active_run) {
    const stalled = h.active_run.status === "RUNNING" && h.active_run.heartbeat_age_seconds != null && h.active_run.heartbeat_age_seconds > stallSeconds;
    return { text: stalled ? "stalled" : h.active_run.status === "QUEUED" ? "queued" : "training", tone: stalled ? "bad" : "running", title: "A run is active", runId: h.active_run.id };
  }
  const last = h.last_run;
  if (h.champion) return { text: "champion", tone: "good", title: `Champion ${h.champion.model_version ?? ""} trained ${mlAgo(h.champion.trained_at)}`, runId: last?.id ?? null };
  if (last?.status === "FINISHED" && last.outcome === "REJECTED") return { text: "rejected", tone: "neutral", title: mlReasonText(last.outcome_reason) ?? "Not promoted", runId: last.id };
  if (last?.status === "FAILED" || last?.status === "INTERRUPTED") return { text: last.status.toLowerCase(), tone: "bad", title: "The last run did not complete", runId: last.id };
  if (last?.status === "STOPPED") return { text: "stopped", tone: "warn", title: "Stopped by an operator", runId: last.id };
  return { text: "no model", tone: "neutral", title: h.retrain?.reason ? mlWords(h.retrain.reason) : "No run yet", runId: last?.id ?? null };
}

function MlOverviewContent() {
  const { workspaceId, stallSeconds } = useMlCtx();
  const overview = useMlOverview(workspaceId);
  const system = useMlSystem(workspaceId);
  const now = useNow(1000);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const data = overview.data;

  if (!data) {
    return overview.isError ? <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} /> : <LoadingBlock rows={5} />;
  }

  const active = data.active_runs ?? [];
  return (
    <div className="space-y-4">
      <AlertBanner alerts={data.alerts ?? []} onOpenRun={setOpenRun} />
      <HostStrip system={system.data} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Active runs ({active.length})</CardTitle></CardHeader>
        <CardContent>
          {active.length === 0 ? <EmptyBlock title="Nothing is training right now" hint="Start a run from Training Runs, or wait for the scheduler." /> : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((r) => <ActiveRunCard key={r.id} run={r} nowMs={now} fetchedAt={overview.dataUpdatedAt} stallSeconds={stallSeconds} onOpen={() => setOpenRun(r.id)} />)}
            </div>
          )}
          {data.queue && <div className="mt-2 text-xs text-slate-500">Queue: {mlNumber(data.queue.pending)} waiting · {mlNumber(data.queue.reserved)} running · {mlNumber(data.queue.failed)} failed</div>}
        </CardContent>
      </Card>

      <section aria-label="Coins" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Coins</h2>
          <span className="text-xs text-slate-500" title="Row counts over millions of rows are cached on the server">
            {data.counts_as_of ? `row counts as of ${mlDateTime(data.counts_as_of)} (cached)` : "row counts not available yet"}
          </span>
        </div>
        {(data.symbols ?? []).length === 0 ? <EmptyBlock title="No coins are configured for ML yet" /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.symbols.map((s) => (
              <Card key={s.symbol} className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {mlCoin(s.symbol)}
                    <CandleStateBadge state={s.candles?.state} />
                    <span className="text-[11px] font-normal text-slate-500">
                      {s.candles?.age_seconds != null ? `newest candle ${mlDuration(s.candles.age_seconds)} old` : "no candles"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                      <span>Candles {mlNumber(s.candles?.collected)} / {mlNumber(s.candles?.target)}</span>
                      <span>{s.candles?.coverage_pct != null ? `${s.candles.coverage_pct.toFixed(1)}%` : "—"}</span>
                    </div>
                    <MiniBar value={s.candles?.coverage_pct} label={`${mlCoin(s.symbol)} candle coverage`} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>Features {mlNumber(s.features?.rows)} <ToneBadge tone={s.features?.state === "ok" ? "good" : s.features?.state === "building" ? "warn" : "neutral"}>{s.features?.state ?? "n/a"}</ToneBadge></span>
                    <span>Labels {mlNumber(s.labels?.mature)} ready · {mlNumber(s.labels?.pending)} pending</span>
                    <span>Funding <ToneBadge tone={s.funding?.state === "ok" ? "good" : s.funding?.state === "stale" ? "warn" : "neutral"}>{s.funding?.state ?? "n/a"}</ToneBadge></span>
                    <span>History download <ToneBadge tone={s.backfill?.status === "COMPLETED" ? "good" : s.backfill?.status === "RUNNING" ? "running" : s.backfill?.status ? "bad" : "neutral"}>{s.backfill?.status ? s.backfill.status.toLowerCase() : "none"}</ToneBadge></span>
                  </div>
                  <div className="flex flex-wrap gap-1.5" aria-label={`${mlCoin(s.symbol)} model verdicts per horizon`}>
                    {(s.horizons ?? []).map((h) => {
                      const chip = horizonChip(h, stallSeconds);
                      return (
                        <button key={h.horizon_minutes} type="button" disabled={!chip.runId} onClick={() => chip.runId && setOpenRun(chip.runId)} title={chip.title}
                          className={cn("rounded-md border px-2 py-1 text-[11px] disabled:cursor-default", ML_TONE_CLASS[chip.tone])}>
                          <span className="font-semibold">{mlHorizonLabel(h.horizon_minutes)}</span> {chip.text}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {(data.pipeline_jobs ?? []).some((j) => j.state !== "ok") && (
        <div className="text-xs text-slate-500">Some scheduled pipeline jobs are late or have never run. See <Link to="/ml-training/system" className="underline">System</Link>.</div>
      )}
      <RunDrawer runId={openRun} onSelect={setOpenRun} />
    </div>
  );
}

export default function MlOverviewPage() {
  return (
    <MlShell title="ML Training" description="What the shadow ML pipeline is doing right now: data, training runs and verdicts per coin.">
      <MlOverviewContent />
    </MlShell>
  );
}
