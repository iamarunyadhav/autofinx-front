import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { DEFAULT_STALL_SECONDS, mlCoin, mlDuration, mlEffectiveRun, mlHorizonLabel, mlReasonText, mlSecondsUntil } from "@/lib/mlTraining";
import type { MlRunSummary } from "@/types/mlTraining";

/** Wall clock that re-renders every `intervalMs`, so elapsed time and countdowns tick between polls. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The caller's own workspace plus whether they may change anything. The role
 * comes from the `members` the /workspaces list already returns; when it is
 * not there we do not hide the buttons (the server still enforces owner/admin
 * and answers 403), but a known non-owner/admin is read-only.
 */
export function useMlAccess() {
  const { currentWorkspace, loading, error, retry } = useWorkspace();
  const { user } = useAuth();
  const members = (currentWorkspace as { members?: Array<{ user_id?: string; role?: string }> } | null)?.members;
  const role = useMemo(() => {
    const mine = Array.isArray(members) && user?.id ? members.find((m) => m.user_id === user.id) : undefined;
    return mine?.role ? String(mine.role).toLowerCase() : null;
  }, [members, user?.id]);
  const canMutate = role === null ? true : role === "owner" || role === "admin";
  return { workspaceId: currentWorkspace?.id, loading, error, retry, role, canMutate };
}

/**
 * Toasts for run state transitions seen between two polls: finished (champion
 * or neutral rejected), failed, interrupted, stopped, newly stalled, and an
 * auto-retry being scheduled with its countdown. The first batch only seeds
 * the baseline so opening the page never replays old history.
 */
export function useMlRunToasts(runs: MlRunSummary[] | undefined, stallSeconds: number | null | undefined, fetchedAtMs: number) {
  const seen = useRef<Map<string, { status: string; retryAt: string | null; stalled: boolean }> | null>(null);
  const now = useNow(5000);
  const stall = stallSeconds ?? DEFAULT_STALL_SECONDS;

  useEffect(() => {
    if (!runs) return;
    const next = new Map<string, { status: string; retryAt: string | null; stalled: boolean }>();
    const prev = seen.current;
    for (const run of runs) {
      const eff = mlEffectiveRun(run, stall, now, fetchedAtMs);
      next.set(run.id, { status: run.status, retryAt: run.next_retry_at, stalled: eff.stalled });
      const before = prev?.get(run.id);
      if (!prev || !before) continue;
      const name = `${mlCoin(run.symbol)} ${mlHorizonLabel(run.horizon_minutes)}`;
      if (before.status !== run.status) {
        if (run.status === "FINISHED") {
          if (run.outcome === "CHAMPION") toast.success(`${name} finished: new champion`);
          else toast.info(`${name} finished: not promoted`, { description: mlReasonText(run.outcome_reason) ?? undefined });
        } else if (run.status === "FAILED") {
          toast.error(`${name} failed`, { description: run.error_message ?? mlReasonText(run.error_code) ?? undefined });
        } else if (run.status === "INTERRUPTED") {
          toast.warning(`${name} was interrupted`, { description: "The worker stopped heartbeating." });
        } else if (run.status === "STOPPED") {
          toast.info(`${name} stopped`);
        }
      }
      if (eff.stalled && !before.stalled) toast.warning(`${name} looks stalled`, { description: "No heartbeat from the worker." });
      const wait = mlSecondsUntil(run.next_retry_at, now);
      if (run.next_retry_at && run.next_retry_at !== before.retryAt && wait !== null && wait > 0) {
        toast.info(`${name}: auto-retry scheduled`, { description: `Next attempt in ${mlDuration(wait)}.` });
      }
    }
    seen.current = next;
    // `now` is intentionally not a trigger on its own beyond the 5 s stall re-check.
  }, [runs, stall, now, fetchedAtMs]);
}
