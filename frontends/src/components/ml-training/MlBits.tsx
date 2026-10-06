import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ML_TONE_CLASS, mlDuration, mlErrorMessage, mlSecondsUntil, type MlEffectiveRun, type MlRunTone } from "@/lib/mlTraining";
import type { MlCandleState } from "@/types/mlTraining";

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 sm:flex-row sm:items-center">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">Could not load this data: {mlErrorMessage(error)}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}><RefreshCcw className="mr-2 h-3.5 w-3.5" />Retry</Button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-700 p-6 text-center">
      <Inbox className="h-5 w-5 text-slate-500" />
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function ToneBadge({ tone, children, className, title }: { tone: MlRunTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <Badge variant="outline" title={title} className={cn("px-1.5 text-[10px] font-bold", ML_TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}

export function RunStateBadge({ eff }: { eff: MlEffectiveRun }) {
  return (
    <ToneBadge tone={eff.tone} className={cn(eff.label === "RUNNING" && "animate-pulse")}>
      {eff.label}
    </ToneBadge>
  );
}

const CANDLE_TONE: Record<MlCandleState, MlRunTone> = { live: "good", lagging: "warn", stale: "bad", missing: "neutral" };

export function CandleStateBadge({ state }: { state: MlCandleState | null | undefined }) {
  if (!state) return <ToneBadge tone="neutral">unknown</ToneBadge>;
  return <ToneBadge tone={CANDLE_TONE[state] ?? "neutral"}>{state}</ToneBadge>;
}

const BAR_TONE: Record<MlRunTone, string> = {
  neutral: "bg-slate-500", running: "bg-sky-500", good: "bg-emerald-500", bad: "bg-rose-500", warn: "bg-amber-500",
};

/** Thin bar; `value` null means "no data", drawn empty rather than as a fake 0%. */
export function MiniBar({ value, tone = "good", label }: { value: number | null | undefined; tone?: MlRunTone; label?: string }) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={label} aria-valuenow={v ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", BAR_TONE[tone])} style={{ width: `${v ?? 0}%` }} />
    </div>
  );
}

/** "retry in 1m 28s" counting down against the wall clock; empty once the time has passed. */
export function RetryCountdown({ iso, nowMs }: { iso: string | null | undefined; nowMs: number }) {
  const left = mlSecondsUntil(iso, nowMs);
  if (left === null) return null;
  return left > 0
    ? <span className="text-amber-300">auto-retry in {mlDuration(left)}</span>
    : <span className="text-slate-400">auto-retry due now</span>;
}
