import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyBlock, ErrorBlock, LoadingBlock, ToneBadge } from "@/components/ml-training/MlBits";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { MlShell } from "@/components/ml-training/MlShell";
import { DecisionReason, FoldsTable, KeyValueGrid } from "@/components/ml-training/ModelMetrics";
import { useMlModels, useMlOverview, useMlRunDetail } from "@/hooks/useMlTraining";
import { cn } from "@/lib/utils";
import { ML_TONE_CLASS, mlAgo, mlCoin, mlDateTime, mlHorizonLabel, mlNumber, type MlRunTone } from "@/lib/mlTraining";
import type { MlHorizonRow } from "@/types/mlTraining";

function cell(h: MlHorizonRow | undefined): { text: string; sub: string; tone: MlRunTone } {
  if (!h) return { text: "—", sub: "", tone: "neutral" };
  if (h.champion) return { text: "champion", sub: mlAgo(h.champion.trained_at), tone: "good" };
  if (h.active_run) return { text: "training", sub: "", tone: "running" };
  const last = h.last_run;
  if (last?.status === "FINISHED" && last.outcome === "REJECTED") return { text: "rejected", sub: mlAgo(last.finished_at), tone: "neutral" };
  if (last?.status === "FAILED" || last?.status === "INTERRUPTED") return { text: last.status.toLowerCase(), sub: mlAgo(last.finished_at), tone: "bad" };
  if (last?.status === "STOPPED") return { text: "stopped", sub: mlAgo(last.finished_at), tone: "warn" };
  return { text: "no model", sub: "", tone: "neutral" };
}

function MlModelsContent() {
  const { workspaceId } = useMlCtx();
  const overview = useMlOverview(workspaceId);
  const [sel, setSel] = useState<{ symbol: string; horizon: number } | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const symbols = overview.data?.symbols ?? [];
  const horizons = Array.from(new Set(symbols.flatMap((s) => (s.horizons ?? []).map((h) => h.horizon_minutes)))).sort((a, b) => a - b);
  const models = useMlModels(workspaceId, { symbol: sel?.symbol, horizon_minutes: sel?.horizon, limit: 20 });
  const list = sel ? models.data?.data ?? [] : [];
  const model = list.find((m) => m.model_version === version) ?? list[0];

  // Folds are not part of the /models rows; they come with the run that trained the model.
  const selCell = sel ? symbols.find((s) => s.symbol === sel.symbol)?.horizons?.find((h) => h.horizon_minutes === sel.horizon) : undefined;
  const runDetail = useMlRunDetail(workspaceId, selCell?.last_run?.id ?? null);
  const folds = runDetail.data?.model && runDetail.data.model.model_version === model?.model_version ? runDetail.data.model.folds : null;

  if (!overview.data) {
    return overview.isError ? <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} /> : <LoadingBlock rows={4} />;
  }
  if (symbols.length === 0) return <EmptyBlock title="No coins are configured for ML yet" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Champion or last verdict per coin and horizon</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2" style={{ gridTemplateColumns: `minmax(3rem, auto) repeat(${Math.max(horizons.length, 1)}, minmax(0, 1fr))` }} role="grid" aria-label="Model matrix">
            <div />
            {horizons.map((h) => <div key={h} className="text-center text-xs font-semibold text-slate-400">{mlHorizonLabel(h)}</div>)}
            {symbols.map((s) => (
              <div key={s.symbol} className="contents">
                <div className="flex items-center text-sm font-semibold text-slate-200">{mlCoin(s.symbol)}</div>
                {horizons.map((h) => {
                  const c = cell((s.horizons ?? []).find((x) => x.horizon_minutes === h));
                  const active = sel?.symbol === s.symbol && sel.horizon === h;
                  return (
                    <button key={h} type="button" onClick={() => { setSel({ symbol: s.symbol, horizon: h }); setVersion(null); }} aria-pressed={active}
                      className={cn("min-w-0 rounded-md border px-1 py-2 text-center text-[11px] transition-colors", ML_TONE_CLASS[c.tone], active && "ring-2 ring-sky-400")}>
                      <div className="truncate font-semibold">{c.text}</div>
                      {c.sub && <div className="truncate text-[10px] opacity-70">{c.sub}</div>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!sel && <EmptyBlock title="Pick a cell to see its models" hint="Metrics, the verdict in plain words and walk-forward folds appear here." />}
      {sel && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{mlCoin(sel.symbol)} {mlHorizonLabel(sel.horizon)} models</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!models.data && models.isLoading && <LoadingBlock rows={2} />}
            {!models.data && models.isError && <ErrorBlock error={models.error} onRetry={() => void models.refetch()} />}
            {models.data && list.length === 0 && <EmptyBlock title="No model has been trained for this pair yet" />}
            {list.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Model versions">
                  {list.map((m) => (
                    <button key={m.model_version} role="tab" aria-selected={m.model_version === model?.model_version} onClick={() => setVersion(m.model_version)}
                      className={cn("max-w-full truncate rounded-md border px-2 py-1 text-[11px]", m.model_version === model?.model_version ? "border-sky-500/50 bg-sky-500/10 text-sky-200" : "border-slate-800 text-slate-400 hover:text-slate-200")}>
                      {m.model_version}
                    </button>
                  ))}
                </div>
                {model && (
                  <div className={cn("space-y-3", models.isError && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <ToneBadge tone={model.status === "CHAMPION" ? "good" : "neutral"}>{model.status}</ToneBadge>
                      <span>{model.model_type ?? "model"}</span>
                      <span>trained {mlDateTime(model.trained_at)}</span>
                      {model.promoted_at && <span>promoted {mlDateTime(model.promoted_at)}</span>}
                    </div>
                    <DecisionReason code={model.decision_reason} />
                    <div className="text-xs text-slate-400">
                      Samples: {mlNumber(model.samples?.total)} total · {mlNumber(model.samples?.train)} train · {mlNumber(model.samples?.holdout)} unseen holdout
                    </div>
                    <KeyValueGrid title="Holdout (unseen data, after costs)" data={model.holdout_summary} />
                    <KeyValueGrid title="Comparison with the previous champion" data={model.comparison} />
                    {folds ? <FoldsTable folds={folds} /> : <div className="text-xs text-slate-500">Walk-forward folds are shown for the most recent run of this pair when it trained this model version.</div>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MlModelsPage() {
  return (
    <MlShell title="Models" description="Which coin and horizon has a champion model, and how each model performed on data it never saw.">
      <MlModelsContent />
    </MlShell>
  );
}
