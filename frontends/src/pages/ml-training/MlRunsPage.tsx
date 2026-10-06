import { useState } from "react";
import { toast } from "sonner";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { EmptyBlock, ErrorBlock, LoadingBlock, MiniBar, RetryCountdown, RunStateBadge } from "@/components/ml-training/MlBits";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { MlShell } from "@/components/ml-training/MlShell";
import { RunDrawer } from "@/components/ml-training/RunDrawer";
import { BatchDialog, StartRunDialog } from "@/components/ml-training/StartDialogs";
import { useMlOverview, useMlRuns, useMlStopBatch } from "@/hooks/useMlTraining";
import { useNow } from "@/hooks/useMlTrainingLive";
import { ML_FALLBACK_HORIZONS, mlCoin, mlDateTime, mlDuration, mlEffectiveRun, mlHorizonLabel, mlWords } from "@/lib/mlTraining";
import type { MlRunStatus } from "@/types/mlTraining";

const ALL = "all";
const STATUSES: MlRunStatus[] = ["QUEUED", "RUNNING", "FINISHED", "FAILED", "STOPPED", "INTERRUPTED"];
const PAGE = 50;
const MAX_LIMIT = 200;

function MlRunsContent() {
  const { workspaceId, canMutate, stallSeconds } = useMlCtx();
  const overview = useMlOverview(workspaceId);
  const stopBatch = useMlStopBatch(workspaceId);
  const now = useNow(1000);
  const [status, setStatus] = useState<string>(ALL);
  const [symbol, setSymbol] = useState<string>(ALL);
  const [horizon, setHorizon] = useState<string>(ALL);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const runs = useMlRuns(workspaceId, {
    status: status === ALL ? "" : (status as MlRunStatus),
    symbol: symbol === ALL ? undefined : symbol,
    horizon_minutes: horizon === ALL ? "" : Number(horizon),
    batch_id: batchId ?? undefined,
    limit,
  });

  const symbols = (overview.data?.symbols ?? []).map((s) => s.symbol);
  const horizons = Array.from(new Set((overview.data?.symbols ?? []).flatMap((s) => (s.horizons ?? []).map((h) => h.horizon_minutes))));
  const horizonOptions = horizons.length > 0 ? horizons.sort((a, b) => a - b) : ML_FALLBACK_HORIZONS;
  const rows = runs.data?.data ?? [];
  const resetLimit = () => setLimit(PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="ml-f-status" className="text-xs text-slate-400">Status</label>
          <Select value={status} onValueChange={(v) => { setStatus(v); resetLimit(); }}>
            <SelectTrigger id="ml-f-status" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ml-f-symbol" className="text-xs text-slate-400">Coin</label>
          <Select value={symbol} onValueChange={(v) => { setSymbol(v); resetLimit(); }}>
            <SelectTrigger id="ml-f-symbol" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {symbols.map((s) => <SelectItem key={s} value={s}>{mlCoin(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ml-f-horizon" className="text-xs text-slate-400">Horizon</label>
          <Select value={horizon} onValueChange={(v) => { setHorizon(v); resetLimit(); }}>
            <SelectTrigger id="ml-f-horizon" className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {horizonOptions.map((h) => <SelectItem key={h} value={String(h)}>{mlHorizonLabel(h)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <StartRunDialog symbols={symbols} horizons={horizonOptions} />
          <BatchDialog symbols={symbols} />
        </div>
      </div>

      {batchId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-xs text-slate-300">
          <span className="min-w-0 break-all">Showing one batch ({batchId.slice(0, 13)}...)</span>
          <Button size="sm" variant="ghost" onClick={() => { setBatchId(null); resetLimit(); }}>Show all runs</Button>
          {canMutate && (
            <ConfirmAction
              destructive
              trigger={<Button size="sm" variant="destructive" disabled={stopBatch.isPending}><Square className="mr-2 h-3.5 w-3.5" />Stop batch</Button>}
              title="Stop every active run in this batch?"
              description="Queued runs are cancelled at once; running ones are asked to stop and end within seconds."
              confirmLabel="Stop batch"
              pending={stopBatch.isPending}
              onConfirm={async () => { const r = await stopBatch.mutateAsync(batchId); toast.info(`Batch stop: ${r?.stopped ?? 0} stopped, ${r?.cancelled ?? 0} cancelled`); }}
            />
          )}
        </div>
      )}

      {!runs.data && runs.isLoading && <LoadingBlock rows={5} />}
      {!runs.data && runs.isError && <ErrorBlock error={runs.error} onRetry={() => void runs.refetch()} />}
      {runs.data && runs.isError && <div role="alert" className="text-xs text-amber-300">Cannot refresh the list; showing the last data received.</div>}
      {runs.data && rows.length === 0 && <EmptyBlock title="No runs match" hint="Change the filters, or start a run." />}
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Progress</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden md:table-cell">Attempt</TableHead>
                  <TableHead className="hidden lg:table-cell">Started</TableHead>
                  <TableHead className="text-right">Elapsed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const eff = mlEffectiveRun(r, stallSeconds, now, runs.dataUpdatedAt);
                  return (
                    <TableRow key={r.id} className={runs.isError ? "opacity-60" : undefined}>
                      <TableCell>
                        <button type="button" onClick={() => setOpenRun(r.id)} className="rounded font-medium text-sky-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {mlCoin(r.symbol)} {mlHorizonLabel(r.horizon_minutes)}
                        </button>
                        {r.batch_id && (
                          <button type="button" onClick={() => { setBatchId(r.batch_id); resetLimit(); }} className="ml-2 text-[10px] text-slate-500 underline-offset-2 hover:underline" title="Show only this batch">batch</button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <RunStateBadge eff={eff} />
                          <span className="text-[10px]"><RetryCountdown iso={r.next_retry_at} nowMs={now} /></span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden w-40 sm:table-cell">
                        {r.status === "RUNNING" || r.status === "QUEUED" ? (
                          <div className="space-y-1"><MiniBar value={r.progress_pct} tone={eff.stalled ? "bad" : "running"} label="Progress" /><span className="text-[10px] text-slate-500">{mlWords(r.phase)}</span></div>
                        ) : <span className="text-xs text-slate-500">—</span>}
                      </TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{r.source ?? "—"}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{r.attempt ?? 1}/{r.max_attempts ?? "—"}</TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">{mlDateTime(r.started_at ?? r.queued_at)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{mlDuration(eff.elapsed)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {runs.data?.next_cursor && limit < MAX_LIMIT && (
        <div className="text-center"><Button variant="outline" size="sm" onClick={() => setLimit((l) => Math.min(MAX_LIMIT, l + PAGE))} disabled={runs.isFetching}>Load more</Button></div>
      )}
      <RunDrawer runId={openRun} onSelect={setOpenRun} />
    </div>
  );
}

export default function MlRunsPage() {
  return (
    <MlShell title="Training Runs" description="Every training attempt, from the UI, the scheduler or the command line. A rejected model is a normal result, not an error.">
      <MlRunsContent />
    </MlShell>
  );
}
