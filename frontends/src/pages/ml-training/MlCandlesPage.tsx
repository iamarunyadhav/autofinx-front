import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ml-training/ConfirmAction";
import { CandleStateBadge, EmptyBlock, ErrorBlock, LoadingBlock, MiniBar, ToneBadge } from "@/components/ml-training/MlBits";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { MlShell } from "@/components/ml-training/MlShell";
import { useMlCandles, useMlOverview, useMlResumeBackfill } from "@/hooks/useMlTraining";
import { cn } from "@/lib/utils";
import { mlAgo, mlCoin, mlDuration, mlNumber } from "@/lib/mlTraining";
import type { MlCandle } from "@/types/mlTraining";

const price = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 4 : 2 });

function CandleChart({ candles }: { candles: MlCandle[] }) {
  const points = useMemo(() => candles.filter((c) => Number.isFinite(c.c)).map((c) => ({ t: c.t, close: c.c, high: c.h, low: c.l })), [candles]);
  if (points.length === 0) return <EmptyBlock title="No candles to draw" hint="The collector has not stored any candles for this coin yet." />;
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label="Closing price of the most recent candles">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="#64748b" fontSize={11} minTickGap={32} />
          <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={11} width={56} tickFormatter={(v) => price(v)} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }}
            labelFormatter={(t) => new Date(t as number).toLocaleString()}
            formatter={(v: number, name: string) => [price(v), name]}
          />
          <Line type="monotone" dataKey="close" name="close" stroke="#38bdf8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MlCandlesContent() {
  const { workspaceId, canMutate } = useMlCtx();
  const overview = useMlOverview(workspaceId);
  const resume = useMlResumeBackfill(workspaceId);
  const symbols = overview.data?.symbols ?? [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const symbol = picked && symbols.some((s) => s.symbol === picked) ? picked : symbols[0]?.symbol;
  const candles = useMlCandles(workspaceId, symbol, 120);
  const info = symbols.find((s) => s.symbol === symbol);

  if (!overview.data) {
    return overview.isError ? <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} /> : <LoadingBlock rows={4} />;
  }
  if (symbols.length === 0) return <EmptyBlock title="No coins are configured for ML yet" />;

  const c = candles.data;
  const stats = info?.candles;
  const backfill = info?.backfill;
  const canResume = canMutate && symbol && backfill?.status !== "RUNNING" && backfill?.status !== "COMPLETED";
  // Prefer the fresher of the two sources for the age; both come from the server.
  const age = c?.age_seconds ?? stats?.age_seconds ?? null;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Coins">
        {symbols.map((s) => (
          <button key={s.symbol} role="tab" aria-selected={s.symbol === symbol} onClick={() => setPicked(s.symbol)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              s.symbol === symbol ? "border-sky-500/50 bg-sky-500/10 text-sky-200" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200")}>
            {mlCoin(s.symbol)}
            <span className={cn("h-1.5 w-1.5 rounded-full", s.candles?.state === "live" ? "bg-emerald-400" : s.candles?.state === "lagging" ? "bg-amber-400" : s.candles?.state === "stale" ? "bg-rose-400" : "bg-slate-600")} />
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {mlCoin(symbol)} {c?.timeframe ?? "1m"} candles
            <CandleStateBadge state={c?.state ?? stats?.state} />
            <span className="text-xs font-normal text-slate-400">last close {price(c?.latest_close ?? stats?.latest_close)}</span>
            <span className="text-xs font-normal text-slate-500">newest candle {age != null ? `${mlDuration(age)} old` : "n/a"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(candles.isError && "opacity-60")}>
          {candles.isError && c && <div role="alert" className="mb-2 text-xs text-amber-300">Cannot refresh the chart; showing the last candles received.</div>}
          {!c && candles.isLoading && <LoadingBlock rows={2} />}
          {!c && candles.isError && <ErrorBlock error={candles.error} onRetry={() => void candles.refetch()} />}
          {c && <CandleChart candles={c.candles ?? []} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Coverage</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{mlNumber(stats?.collected)} of {mlNumber(stats?.target)} target candles</span>
              <span>{stats?.coverage_pct != null ? `${stats.coverage_pct.toFixed(1)}%` : "—"}</span>
            </div>
            <MiniBar value={stats?.coverage_pct} label="Candle coverage" />
            <div className="text-xs text-slate-400">Rejected candles (failed quality checks): <span className="tabular-nums text-slate-200">{mlNumber(stats?.rejected)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">History download</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!backfill || !backfill.status ? <div className="text-xs text-slate-500">No history download has been started for this coin.</div> : (
              <>
                <div className="flex items-center gap-2">
                  <ToneBadge tone={backfill.status === "COMPLETED" ? "good" : backfill.status === "RUNNING" ? "running" : "bad"}>{backfill.status}</ToneBadge>
                  <span className="text-xs text-slate-500">updated {mlAgo(backfill.updated_at)}</span>
                </div>
                <div className="text-xs text-slate-400">{mlNumber(backfill.pages)} pages · {mlNumber(backfill.rows_written)} rows written · at {backfill.cursor ? new Date(backfill.cursor).toLocaleDateString() : "—"}</div>
                {backfill.status === "STALLED" && <div className="text-xs text-rose-300">The checkpoint has not moved for 10 minutes.</div>}
                {backfill.last_error && <div role="alert" className="break-words rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">{backfill.last_error}</div>}
              </>
            )}
            {canResume && (
              <ConfirmAction
                trigger={<Button size="sm" variant="outline" disabled={resume.isPending}>Resume backfill</Button>}
                title={`Resume the ${mlCoin(symbol)} history download?`}
                description="Continues from the saved checkpoint. It only reads exchange candles and writes them to the database; one download per coin at a time."
                confirmLabel="Resume"
                pending={resume.isPending}
                onConfirm={async () => { await resume.mutateAsync(symbol as string); toast.success(`${mlCoin(symbol)} download resumed`); }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MlCandlesPage() {
  return (
    <MlShell title="Candles & Data" description="Live candle collection, coverage and history download per coin. The model can only learn from data that is fresh and complete.">
      <MlCandlesContent />
    </MlShell>
  );
}
