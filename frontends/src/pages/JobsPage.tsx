import { AppShell } from "@/components/layout/AppShell";
import type React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClearPendingQueue, useForgetFailedJob, useJobsDashboard, usePruneStalePendingJobs, useRestartWorkers, useRetryFailedJob } from "@/hooks/useJobs";
import { useRepairRuntime } from "@/hooks/useRuntimeHealth";
import { AlertTriangle, CheckCircle2, Gauge, ListRestart, PlayCircle, RefreshCcw, ServerCog, ShieldAlert, Trash2, Workflow, XCircle } from "lucide-react";

const n = (value?: number | null) => Number(value ?? 0).toLocaleString();
const human = (value?: string | null) => String(value || "unknown").replace(/_/g, " ");
const short = (value?: string | null, max = 90) => {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

function stateVariant(state?: string): "default" | "secondary" | "destructive" | "outline" {
  if (["blocked", "failed", "error"].includes(String(state))) return "destructive";
  if (["degraded", "backlog", "warning", "running"].includes(String(state))) return "secondary";
  if (["healthy", "completed", "ok"].includes(String(state))) return "default";
  return "outline";
}

function duration(value?: number | null) {
  const total = Number(value ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "0s";
  if (total >= 3600) return `${Math.floor(total / 3600)}h`;
  if (total >= 60) return `${Math.floor(total / 60)}m`;
  return `${Math.floor(total)}s`;
}

export default function JobsPage() {
  const dashboard = useJobsDashboard();
  const restartWorkers = useRestartWorkers();
  const retryFailed = useRetryFailedJob();
  const forgetFailed = useForgetFailedJob();
  const clearPending = useClearPendingQueue();
  const pruneStale = usePruneStalePendingJobs();
  const repairRuntime = useRepairRuntime();
  const data = dashboard.data;
  const busy = restartWorkers.isPending || retryFailed.isPending || forgetFailed.isPending || clearPending.isPending || pruneStale.isPending || repairRuntime.isPending;

  const confirmAction = (message: string, fn: () => void) => {
    if (window.confirm(message)) fn();
  };

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Workflow className="h-5 w-5 text-cyan-400" />
              <Badge variant={stateVariant(data?.state)}>{human(data?.state)}</Badge>
              <Badge variant="outline">{data?.connection || "queue"} / {data?.driver || "driver"}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Jobs Control Center</h1>
            <p className="text-sm text-muted-foreground">Queue backlog, failed jobs, scheduler runs, worker restart signals, and Redis/Horizon readiness.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => dashboard.refetch()} disabled={dashboard.isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => confirmAction(
                `Prune stale safe jobs older than ${data?.stale_prune?.older_than_minutes ?? 30} minutes? Protected queues and exit-monitor jobs stay untouched.`,
                () => pruneStale.mutate({ older_than_minutes: data?.stale_prune?.older_than_minutes, confirm: true })
              )}
              disabled={busy || !data?.stale_prune?.enabled || (data?.stale_prune?.candidates?.prunable_total ?? 0) <= 0}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Prune Safe Stale Jobs
            </Button>
            <Button onClick={() => restartWorkers.mutate({})} disabled={busy}>
              <ListRestart className="mr-2 h-4 w-4" /> Restart Workers
            </Button>
            <Button onClick={() => repairRuntime.mutate()} disabled={busy} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              <PlayCircle className="mr-2 h-4 w-4" /> Check & Repair
            </Button>
          </div>
        </div>

        {data?.state === "blocked" ? (
          <Alert className="border-red-500/40 bg-red-500/10">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Queue is blocking live automation</AlertTitle>
            <AlertDescription>
              Backlog {n(data.backlog)} is at or above block threshold {n(data.block_threshold)}. Scale/start workers or clear safe stale jobs before trusting live automation.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Queue state" value={human(data?.state)} detail={`${data?.connection || "unknown"} connection`} icon={<Gauge className="h-4 w-4" />} />
          <MetricCard title="Backlog" value={n(data?.backlog)} detail={`warn ${n(data?.warning_threshold)} / block ${n(data?.block_threshold)}`} icon={<AlertTriangle className="h-4 w-4" />} />
          <MetricCard title="Failed jobs" value={n(data?.failed)} detail="retry or forget after review" icon={<XCircle className="h-4 w-4" />} />
          <MetricCard title="Safe stale jobs" value={n(data?.stale_prune?.candidates?.prunable_total)} detail={`older than ${n(data?.stale_prune?.older_than_minutes)} min`} icon={<Trash2 className="h-4 w-4" />} />
          <MetricCard title="Redis/Horizon" value={data?.redis_ready?.configured ? "Redis" : "Not Redis"} detail={data?.horizon?.installed ? "Horizon installed" : "Horizon optional; queue:work fallback OK"} icon={<ServerCog className="h-4 w-4" />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader>
              <CardTitle>Priority Queues</CardTitle>
              <CardDescription>Dedicated queues keep live execution ahead of analytics and notifications.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queue</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.queues ?? []).map((queue) => (
                    <TableRow key={queue.name}>
                      <TableCell className="font-medium">{queue.name}</TableCell>
                      <TableCell className="max-w-[320px] text-muted-foreground">{queue.purpose}</TableCell>
                      <TableCell className="text-right">{queue.priority}</TableCell>
                      <TableCell className="text-right">{n(queue.pending)}</TableCell>
                      <TableCell className="text-right">{n(queue.reserved)}</TableCell>
                      <TableCell className="text-right">{n(queue.failed)}</TableCell>
                      <TableCell><Badge variant={stateVariant(queue.state)}>{human(queue.state)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || queue.pending <= 0 || (data?.protected_queues ?? []).includes(queue.name)}
                          onClick={() => confirmAction(`Clear pending jobs in ${queue.name}? Use only for stale/non-critical backlog.`, () => clearPending.mutate({ queue: queue.name, connection: data?.connection, confirm: true }))}
                        >
                          {(data?.protected_queues ?? []).includes(queue.name) ? "Protected" : "Clear"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Worker Setup</CardTitle>
              <CardDescription>Recommended 3-worker split so live queues stay faster under backlog.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusLine label="Redis queue" ok={Boolean(data?.redis_ready?.configured)} detail={`QUEUE_CONNECTION=${data?.redis_ready?.queue_connection || "unknown"}`} />
              <StatusLine label="Horizon package" ok={true} detail={data?.horizon?.installed ? data?.horizon?.dashboard_url : "Optional: queue:work fallback is supported"} />
              {repairRuntime.data && (
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Runtime repair output</div>
                    <Badge variant={repairRuntime.data.ok ? "default" : "secondary"}>exit {repairRuntime.data.exit_code}</Badge>
                  </div>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-cyan-100">{repairRuntime.data.output || "No output."}</pre>
                </div>
              )}
              {repairRuntime.error && (
                <Alert className="border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{repairRuntime.error.message}</AlertDescription>
                </Alert>
              )}
              <CommandBlock title="Single worker fallback" value={data?.worker?.recommended_command} />
              <CommandBlock title="Supervisor restart" value={data?.worker?.supervisor_command} />
              <CommandBlock title="Horizon command" value={data?.worker?.horizon_command} />
              <CommandBlock title="Protected queues" value={(data?.protected_queues ?? []).join(", ")} />
              {(data?.worker?.profiles ?? []).map((profile) => (
                <div key={profile.key} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{profile.label}</div>
                    <Badge variant="outline">{profile.queues.join(", ")}</Badge>
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">{profile.purpose}</div>
                  <code className="block rounded-lg border border-border bg-background/70 p-3 text-xs text-cyan-100">{profile.command}</code>
                </div>
              ))}
              {(data?.recommendations ?? []).map((item) => (
                <Alert key={item}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{item}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Failed Jobs</CardTitle>
                  <CardDescription>Review exception first, then retry or forget.</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || (data?.failed ?? 0) <= 0}
                  onClick={() => confirmAction("Retry all failed jobs?", () => retryFailed.mutate({ id: "all" }))}
                >
                  <PlayCircle className="mr-2 h-4 w-4" /> Retry All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.failed_jobs ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No failed jobs.</TableCell></TableRow>
                  ) : data?.failed_jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{short(job.display_name, 42)}</div>
                        <div className="text-xs text-muted-foreground">{job.failed_at}</div>
                      </TableCell>
                      <TableCell>{job.queue}</TableCell>
                      <TableCell className="max-w-[360px] text-xs text-red-300">{short(job.exception, 130)}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => retryFailed.mutate({ id: job.id })}>Retry</Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => confirmAction(`Forget failed job ${job.id}?`, () => forgetFailed.mutate({ id: job.id }))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Jobs</CardTitle>
              <CardDescription>Old pending or reserved jobs are the normal cause of backlog blockers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.pending_jobs ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No pending jobs.</TableCell></TableRow>
                  ) : data?.pending_jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{short(job.display_name, 52)}</div>
                        <div className="text-xs text-muted-foreground">{job.prunable ? `safe prune: ${human(job.prune_reason)}` : `reason: ${human(job.prune_reason)}`}</div>
                      </TableCell>
                      <TableCell>{job.queue}</TableCell>
                      <TableCell>{duration(job.age_seconds)}</TableCell>
                      <TableCell>{job.attempts}</TableCell>
                      <TableCell><Badge variant={job.prunable ? "default" : (job.reserved ? "secondary" : "outline")}>{job.prunable ? "prunable" : (job.reserved ? "reserved" : "waiting")}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scheduler History</CardTitle>
            <CardDescription>Recent cron/scheduler commands that feed scanners, market data, and runtime diagnostics.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(data?.scheduler_runs ?? []).map((run) => (
                <div key={run.id} className="rounded-lg border border-border bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{run.command}</div>
                    <Badge variant={stateVariant(run.status)}>{human(run.status)}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{run.started_at} · {n(run.duration_ms)} ms</div>
                </div>
              ))}
              {(data?.scheduler_runs ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No scheduler runs recorded.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function MetricCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-cyan-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
    </div>
  );
}

function CommandBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <code className="block rounded-lg border border-border bg-background/70 p-3 text-xs text-cyan-100">{value || "Not configured"}</code>
    </div>
  );
}
