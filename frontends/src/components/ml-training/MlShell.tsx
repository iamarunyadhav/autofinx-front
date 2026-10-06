import { useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCcw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ml-training/MlBits";
import { MlContext } from "@/components/ml-training/mlContext";
import { useMlOverview, useMlRuns, useMlSystem } from "@/hooks/useMlTraining";
import { useMlAccess, useMlRunToasts, useNow } from "@/hooks/useMlTrainingLive";
import { DEFAULT_STALL_SECONDS, ML_SHADOW_NOTE, MlApiError, mlDuration } from "@/lib/mlTraining";

function UpdatedIndicator({ updatedAt, fetching, offline }: { updatedAt: number; fetching: boolean; offline: boolean }) {
  const now = useNow(1000);
  if (!updatedAt) return <span className="text-xs text-slate-500">{fetching ? "loading..." : "not loaded yet"}</span>;
  return (
    <span className="text-xs text-slate-500" aria-live="off">
      {offline ? "last updated" : "updated"} {mlDuration(Math.max(0, (now - updatedAt) / 1000))} ago
    </span>
  );
}

interface MlShellProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Frame shared by the five ML Training pages: workspace + role resolution,
 * the ML-disabled state, the offline banner, the "updated Ns ago" indicator,
 * and the run-transition toasts. Children render only with a workspace id the
 * user actually has.
 */
export function MlShell({ title, description, actions, children }: MlShellProps) {
  const queryClient = useQueryClient();
  const access = useMlAccess();
  const overview = useMlOverview(access.workspaceId);
  const system = useMlSystem(access.workspaceId);
  const recentRuns = useMlRuns(access.workspaceId, { limit: 30 });
  const stallSeconds = system.data?.training?.stall_seconds ?? DEFAULT_STALL_SECONDS;
  useMlRunToasts(recentRuns.data?.data, stallSeconds, recentRuns.dataUpdatedAt);

  const ctx = useMemo(
    () => (access.workspaceId ? { workspaceId: access.workspaceId, canMutate: access.canMutate, stallSeconds } : null),
    [access.workspaceId, access.canMutate, stallSeconds],
  );

  const disabled = overview.data?.enabled === false || (overview.error instanceof MlApiError && overview.error.code === "ml_disabled");
  const offline = overview.isError && !disabled;

  const refresh = () => {
    if (access.workspaceId) void queryClient.invalidateQueries({ queryKey: ["ml-training", access.workspaceId] });
  };

  let body: ReactNode;
  if (access.loading) {
    body = <LoadingBlock rows={4} />;
  } else if (!ctx) {
    body = <ErrorBlock error={new Error(access.error ? "Could not load your workspaces." : "No workspace available.")} onRetry={access.retry} />;
  } else if (disabled) {
    body = (
      <div role="status" className="rounded-lg border border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-300">
        <div className="mb-1 text-base font-semibold text-slate-100">ML shadow learning is switched off</div>
        The server reports the ML module as disabled, so there is nothing to show or control. Turn it on in the server configuration, then refresh.
      </div>
    );
  } else {
    body = (
      <MlContext.Provider value={ctx}>
        {offline && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span>
              Cannot reach the server. {overview.data ? "Showing the last data we received (greyed out); it is retried automatically." : "Retrying automatically."}
            </span>
          </div>
        )}
        {access.role !== null && !access.canMutate && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
            You have read-only access here. Only a workspace owner or admin can start, stop or retry runs.
          </div>
        )}
        <div className={offline ? "opacity-60 transition-opacity" : "transition-opacity"}>{children}</div>
      </MlContext.Provider>
    );
  }

  return (
    <AppShell>
      <div className="min-w-0 space-y-4 overflow-x-hidden p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300" title={ML_SHADOW_NOTE}>
                <ShieldCheck className="h-3 w-3" />shadow only
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UpdatedIndicator updatedAt={overview.dataUpdatedAt} fetching={overview.isFetching} offline={offline} />
            {actions}
            <Button size="sm" variant="outline" onClick={refresh} disabled={!access.workspaceId || overview.isFetching} aria-label="Refresh ML Training data">
              <RefreshCcw className="mr-2 h-3.5 w-3.5" />Refresh
            </Button>
          </div>
        </div>
        {body}
      </div>
    </AppShell>
  );
}
