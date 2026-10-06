import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, LoadingBlock, MiniBar, ToneBadge } from "@/components/ml-training/MlBits";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { MlShell } from "@/components/ml-training/MlShell";
import { useMlOverview, useMlSystem } from "@/hooks/useMlTraining";
import { ML_TONE_CLASS, mlAgo, mlCoin, mlDuration, mlHorizonLabel, mlNumber, type MlRunTone } from "@/lib/mlTraining";
import { cn } from "@/lib/utils";

/** Higher is worse; null thresholds or values give a neutral tone (never a guessed one). */
function toneHigh(value: number | null | undefined, warn: number | null | undefined, critical: number | null | undefined): MlRunTone {
  if (value == null) return "neutral";
  if (critical != null && value >= critical) return "bad";
  if (warn != null && value >= warn) return "warn";
  return warn != null || critical != null ? "good" : "neutral";
}

function Gauge({ label, value, display, tone, hint }: { label: string; value: number | null | undefined; display: string; tone: MlRunTone; hint?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border p-3", ML_TONE_CLASS[tone])}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{display}</div>
      <div className="mt-1"><MiniBar value={value} tone={tone} label={label} /></div>
      {hint && <div className="mt-1 text-[11px] opacity-70">{hint}</div>}
    </div>
  );
}

function MlSystemContent() {
  const { workspaceId } = useMlCtx();
  const system = useMlSystem(workspaceId);
  const overview = useMlOverview(workspaceId);
  const data = system.data;

  if (!data) {
    return system.isError ? <ErrorBlock error={system.error} onRetry={() => void system.refetch()} /> : <LoadingBlock rows={4} />;
  }

  const host = data.host;
  const th = data.thresholds;
  const cores = host?.cores ?? null;
  const perCore = host?.load?.m1 != null && cores ? host.load.m1 / cores : null;
  const level = data.health?.level;
  const levelTone: MlRunTone = level === "critical" ? "bad" : level === "warning" ? "warn" : level === "ok" ? "good" : "neutral";
  const diskFree = host?.disk?.free_gb ?? null;
  const diskTone: MlRunTone = diskFree == null ? "neutral" : th?.disk_free_gb_warn != null && diskFree < th.disk_free_gb_warn ? "warn" : "good";
  // Bar fill for load: fraction of the critical threshold when known, else a plain 2-per-core scale.
  const loadFill = perCore == null ? null : th?.load_per_core_critical ? (perCore / th.load_per_core_critical) * 100 : Math.min(100, perCore * 50);

  return (
    <div className="space-y-4">
      <div className={cn("rounded-lg border p-3", ML_TONE_CLASS[levelTone], system.isError && "opacity-60")}>
        <div className="text-sm font-medium">Host health: {level ?? "unknown"}</div>
        {(data.health?.reasons ?? []).map((r) => <div key={r} className="break-words text-xs opacity-80">{r}</div>)}
        {system.isError && <div role="alert" className="text-xs text-amber-300">Cannot refresh; showing the last reading.</div>}
      </div>

      {!host || (host.cores == null && host.load == null && host.memory == null) ? (
        <EmptyBlock title="Host numbers are not available" hint="The server only reports them on Linux. Everything else on this page still works." />
      ) : (
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", system.isError && "opacity-60")}>
          <Gauge label="Load per core (1 min)" value={loadFill} display={perCore != null ? perCore.toFixed(2) : "—"} tone={toneHigh(perCore, th?.load_per_core_warn, th?.load_per_core_critical)}
            hint={`load ${host.load?.m1 ?? "—"} / ${host.load?.m5 ?? "—"} / ${host.load?.m15 ?? "—"} on ${cores ?? "?"} cores`} />
          <Gauge label="Memory used" value={host.memory?.used_pct} display={host.memory?.used_pct != null ? `${host.memory.used_pct.toFixed(0)}%` : "—"} tone="neutral"
            hint={`${mlNumber(host.memory?.available_mb)} MB free of ${mlNumber(host.memory?.total_mb)} MB`} />
          <Gauge label="Swap used" value={host.swap?.used_pct} display={host.swap?.used_pct != null ? `${host.swap.used_pct.toFixed(0)}%` : "—"} tone={toneHigh(host.swap?.used_pct, th?.swap_used_pct_warn, th?.swap_used_pct_critical)}
            hint="Heavy swap makes training many times slower" />
          <Gauge label="Disk used" value={host.disk?.used_pct} display={diskFree != null ? `${diskFree.toFixed(1)} GB free` : "—"} tone={diskTone} hint={host.disk?.path ?? undefined} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Training queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.queue ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>Waiting <strong className="tabular-nums">{mlNumber(data.queue.pending)}</strong></span>
                  <span>Running <strong className="tabular-nums">{mlNumber(data.queue.reserved)}</strong></span>
                  <span className="text-xs text-slate-500">{data.queue.connection ?? "—"} / {data.queue.name ?? "—"}</span>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Recent failed jobs</div>
                  {(data.queue.failed_recent ?? []).length === 0 ? <div className="text-xs text-slate-500">No recent failures.</div> : (
                    <ul className="space-y-1">
                      {data.queue.failed_recent.map((f) => (
                        <li key={f.id} className="rounded-md border border-slate-800 p-2 text-xs">
                          <div className="flex flex-wrap gap-x-2 text-slate-400">
                            {f.symbol && <span className="font-semibold text-slate-200">{mlCoin(f.symbol)} {mlHorizonLabel(f.horizon_minutes)}</span>}
                            <span>{mlAgo(f.failed_at)}</span>
                          </div>
                          <div className="break-words text-slate-300">{f.summary}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : <div className="text-xs text-slate-500">Queue details are not available.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Training limits</CardTitle></CardHeader>
          <CardContent>
            {data.training ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-400">Time limit per model</dt><dd className="tabular-nums">{mlDuration(data.training.timeout_seconds)}</dd>
                <dt className="text-slate-400">Marked stalled after</dt><dd className="tabular-nums">{mlDuration(data.training.stall_seconds)} without heartbeat</dd>
                <dt className="text-slate-400">Auto-retry</dt><dd>{data.training.auto_retry == null ? "—" : data.training.auto_retry ? "on" : "off"}</dd>
                <dt className="text-slate-400">Max attempts</dt><dd className="tabular-nums">{mlNumber(data.training.max_attempts)}</dd>
              </dl>
            ) : <div className="text-xs text-slate-500">Limits are not available.</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Scheduler heartbeats</CardTitle></CardHeader>
        <CardContent>
          {!overview.data && overview.isLoading && <LoadingBlock rows={2} />}
          {!overview.data && overview.isError && <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} />}
          {overview.data && (overview.data.pipeline_jobs ?? []).length === 0 && <EmptyBlock title="No pipeline jobs reported" />}
          {(overview.data?.pipeline_jobs ?? []).length > 0 && (
            <ul className="divide-y divide-slate-800">
              {overview.data!.pipeline_jobs.map((j) => (
                <li key={j.command} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <code className="min-w-0 break-all text-xs text-slate-200">{j.command}</code>
                  <ToneBadge tone={j.state === "ok" ? "good" : j.state === "late" ? "warn" : "neutral"}>{j.state}</ToneBadge>
                  <span className="ml-auto text-xs text-slate-500">{j.last_started_at ? `last ran ${mlAgo(j.last_started_at)}${j.last_status ? ` (${j.last_status})` : ""}` : "never ran"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MlSystemPage() {
  return (
    <MlShell title="System" description="Server load, queue and limits. On a slow or overloaded host a model can take hours instead of minutes; this is where that shows.">
      <MlSystemContent />
    </MlShell>
  );
}
