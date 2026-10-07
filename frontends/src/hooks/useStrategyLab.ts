import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base";
import {
  LAB_ACTIVE_STATUSES,
  LabApiError,
  labUuid,
  type LabApproval,
  type LabCandidateDetail,
  type LabCandidateListItem,
  type LabCandidateSummary,
  type LabChart,
  type LabCreateCandidateInput,
  type LabRun,
  type LabVersion,
} from "@/lib/strategyLab";

/*
 * react-query hooks for the Strategy Lab API (/workspaces/{workspace}/strategy-lab).
 * Same conventions as useMlTraining.ts: requests keep the 422 `code`, the
 * workspace id always comes from the caller's own workspace list, polling is
 * 3 s while a run is QUEUED/RUNNING and 15 s otherwise, and pauses while the
 * tab is hidden. Research only: none of these endpoints can place an order.
 */

interface LabRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function labRequest<T>(workspaceId: string, method: "GET" | "POST", path: string, options: LabRequestOptions = {}): Promise<T> {
  const url = `${getApiBaseUrl().replace(/\/+$/, "")}/workspaces/${encodeURIComponent(workspaceId)}/strategy-lab${path}`;
  const headers: Record<string, string> = { ...(await authHeaders()), ...(options.headers ?? {}) };
  if (method === "GET") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers.Pragma = "no-cache";
  }
  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: method === "GET" ? "no-store" : "default",
    signal: options.signal,
  });

  const raw = await response.text();
  let parsed: { message?: string; code?: string } | null = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!response.ok) {
    throw new LabApiError(parsed?.message || raw || `HTTP ${response.status}`, response.status, parsed?.code ?? null);
  }
  return (parsed ?? {}) as T;
}

const hidden = () => typeof document !== "undefined" && document.hidden;
const isActive = (status?: string | null) => Boolean(status && LAB_ACTIVE_STATUSES.includes(status));
const poll = (active: boolean) => (hidden() ? false : active ? 3_000 : 15_000);

const root = (workspaceId?: string) => ["strategy-lab", workspaceId] as const;

export function useLabCandidates(workspaceId?: string) {
  return useQuery({
    queryKey: [...root(workspaceId), "candidates"],
    queryFn: ({ signal }) => labRequest<{ candidates: LabCandidateListItem[] }>(workspaceId as string, "GET", "/candidates", { signal }),
    enabled: Boolean(workspaceId),
    refetchInterval: (q) => poll((q.state.data?.candidates ?? []).some((c) => isActive(c.quick_test?.status) || isActive(c.deep_test?.status))),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useLabCandidate(workspaceId: string | undefined, candidateId: string | undefined) {
  return useQuery({
    queryKey: [...root(workspaceId), "candidate", candidateId],
    queryFn: ({ signal }) => labRequest<{ candidate: LabCandidateDetail }>(workspaceId as string, "GET", `/candidates/${encodeURIComponent(candidateId as string)}`, { signal }),
    enabled: Boolean(workspaceId && candidateId),
    refetchInterval: (q) => poll((q.state.data?.candidate?.runs ?? []).some((r) => isActive(r.status))),
    placeholderData: keepPreviousData,
    retry: (count, error) => !(error instanceof LabApiError && (error.status === 404 || error.status === 403)) && count < 1,
  });
}

/** Full run (summary + log tail). */
export function useLabRun(workspaceId: string | undefined, runId: string | null | undefined) {
  return useQuery({
    queryKey: [...root(workspaceId), "run", runId],
    queryFn: ({ signal }) => labRequest<{ run: LabRun }>(workspaceId as string, "GET", `/runs/${encodeURIComponent(runId as string)}`, { signal }),
    enabled: Boolean(workspaceId && runId),
    refetchInterval: (q) => poll(isActive(q.state.data?.run?.status)),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

/** chart.json of a COMPLETED quick run; immutable once written, so never polled. 404 NO_CHART is not retried. */
export function useLabChart(workspaceId: string | undefined, runId: string | null | undefined) {
  return useQuery({
    queryKey: [...root(workspaceId), "chart", runId],
    queryFn: ({ signal }) => labRequest<{ chart: LabChart }>(workspaceId as string, "GET", `/runs/${encodeURIComponent(runId as string)}/chart`, { signal }),
    enabled: Boolean(workspaceId && runId),
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof LabApiError && error.status === 404) && count < 1,
  });
}

/** Every mutation refreshes the whole Strategy Lab cache for the workspace. */
function useLabMutation<TInput, TResult>(workspaceId: string | undefined, run: (workspaceId: string, input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, LabApiError | Error, TInput>({
    mutationFn: (input) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return run(workspaceId, input);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: root(workspaceId) }),
  });
}

export function useLabCreateCandidate(workspaceId?: string) {
  return useLabMutation<LabCreateCandidateInput, { candidate: LabCandidateDetail }>(workspaceId, (ws, input) =>
    labRequest(ws, "POST", "/candidates", { body: input }));
}

export function useLabAddVersion(workspaceId?: string) {
  return useLabMutation<{ candidateId: string; source: string; notes?: string }, { version: LabVersion }>(workspaceId, (ws, input) =>
    labRequest(ws, "POST", `/candidates/${encodeURIComponent(input.candidateId)}/versions`, { body: { source: input.source, notes: input.notes || undefined } }));
}

export function useLabArchive(workspaceId?: string) {
  return useLabMutation<string, { candidate: LabCandidateSummary }>(workspaceId, (ws, candidateId) =>
    labRequest(ws, "POST", `/candidates/${encodeURIComponent(candidateId)}/archive`));
}

/**
 * Start a Quick / Deep test. The caller passes a fresh idempotency key per
 * click (labUuid()), so a network retry of the same click can never queue a
 * second run; the server also returns an already-active run instead of a new one.
 */
export function useLabStartRun(workspaceId?: string) {
  return useLabMutation<{ versionId: string; kind: "QUICK" | "DEEP"; idempotencyKey?: string }, { run: LabRun }>(workspaceId, (ws, input) =>
    labRequest(ws, "POST", `/versions/${encodeURIComponent(input.versionId)}/${input.kind === "QUICK" ? "quick-test" : "deep-test"}`, {
      headers: { "Idempotency-Key": input.idempotencyKey ?? labUuid() },
    }));
}

export function useLabCancelRun(workspaceId?: string) {
  return useLabMutation<string, { run: LabRun }>(workspaceId, (ws, runId) =>
    labRequest(ws, "POST", `/runs/${encodeURIComponent(runId)}/cancel`));
}

export function useLabDecide(workspaceId?: string) {
  return useLabMutation<{ runId: string; decision: "APPROVE" | "REJECT"; notes?: string }, { approval: LabApproval }>(workspaceId, (ws, input) =>
    labRequest(ws, "POST", `/runs/${encodeURIComponent(input.runId)}/decision`, { body: { decision: input.decision, notes: input.notes || undefined } }));
}
