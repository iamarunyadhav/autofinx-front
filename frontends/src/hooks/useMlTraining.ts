import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base";
import { ACTIVE_STATUSES, MlApiError } from "@/lib/mlTraining";
import type {
  MlBatchResult,
  MlCandlesResponse,
  MlModelsResponse,
  MlOverview,
  MlRunDetail,
  MlRunSummary,
  MlRunsPage,
  MlRunsQuery,
  MlStartBatchInput,
  MlStartRunInput,
  MlSystem,
} from "@/types/mlTraining";

/*
 * Typed react-query hooks for every ML Training endpoint
 * (/workspaces/{workspace}/ml-training, see docs/ML_TRAINING_DASHBOARD_PLAN.md).
 *
 * - authorizedFetch drops the 422 `code`, so requests go through mlRequest here.
 * - The workspace id always comes from the caller's own workspace list
 *   (useWorkspace); every hook is disabled until one is known.
 * - Polling pauses while the tab is hidden; keepPreviousData plus react-query's
 *   keep-data-on-error means a failed poll never blanks the screen.
 * - VITE_ML_TRAINING_MOCK=true swaps the network for src/lib/mlTrainingMock.ts
 *   (dev only; the branch is dead code in a normal build).
 */

const MOCK = import.meta.env.VITE_ML_TRAINING_MOCK === "true";

interface MlRequestOptions {
  params?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
}

async function mlRequest<T>(workspaceId: string, method: "GET" | "POST", path: string, options: MlRequestOptions = {}): Promise<T> {
  if (MOCK) {
    const mock = await import("@/lib/mlTrainingMock");
    return mock.mockMlRequest(method, path, options.params ?? {}, options.body) as Promise<T>;
  }

  const url = new URL(`${getApiBaseUrl().replace(/\/+$/, "")}/workspaces/${encodeURIComponent(workspaceId)}/ml-training${path}`);
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  const headers: Record<string, string> = await authHeaders();
  if (method === "GET") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers.Pragma = "no-cache";
  }
  const response = await fetch(url.toString(), {
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
    throw new MlApiError(parsed?.message || raw || `HTTP ${response.status}`, response.status, parsed?.code ?? null);
  }
  return (parsed ?? {}) as T;
}

const hidden = () => typeof document !== "undefined" && document.hidden;
const every = (ms: number) => () => (hidden() ? false : ms);
const hasActiveRun = (runs?: MlRunSummary[] | null) => (runs ?? []).some((r) => ACTIVE_STATUSES.includes(r.status));

const root = (workspaceId?: string) => ["ml-training", workspaceId] as const;

export function useMlOverview(workspaceId?: string) {
  return useQuery({
    queryKey: [...root(workspaceId), "overview"],
    queryFn: ({ signal }) => mlRequest<MlOverview>(workspaceId as string, "GET", "/overview", { signal }),
    enabled: Boolean(workspaceId),
    refetchInterval: every(10_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMlRuns(workspaceId: string | undefined, query: MlRunsQuery = {}) {
  return useQuery({
    queryKey: [...root(workspaceId), "runs", query],
    queryFn: ({ signal }) => mlRequest<MlRunsPage>(workspaceId as string, "GET", "/runs", {
      params: { status: query.status, symbol: query.symbol, horizon_minutes: query.horizon_minutes, batch_id: query.batch_id, limit: query.limit ?? 50, cursor: query.cursor },
      signal,
    }),
    enabled: Boolean(workspaceId),
    refetchInterval: (q) => (hidden() ? false : hasActiveRun(q.state.data?.data) ? 3_000 : 15_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMlRunDetail(workspaceId: string | undefined, runId: string | null) {
  return useQuery({
    queryKey: [...root(workspaceId), "run", runId],
    queryFn: ({ signal }) => mlRequest<MlRunDetail>(workspaceId as string, "GET", `/runs/${encodeURIComponent(runId as string)}`, { signal }),
    enabled: Boolean(workspaceId && runId),
    refetchInterval: (q) => (hidden() ? false : ACTIVE_STATUSES.includes(q.state.data?.run?.status as never) ? 3_000 : 15_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMlCandles(workspaceId: string | undefined, symbol: string | undefined, limit = 120) {
  return useQuery({
    queryKey: [...root(workspaceId), "candles", symbol, limit],
    queryFn: ({ signal }) => mlRequest<MlCandlesResponse>(workspaceId as string, "GET", `/candles/${encodeURIComponent(symbol as string)}`, { params: { limit }, signal }),
    enabled: Boolean(workspaceId && symbol),
    refetchInterval: every(15_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMlModels(workspaceId: string | undefined, filter: { symbol?: string; horizon_minutes?: number | ""; limit?: number } = {}) {
  return useQuery({
    queryKey: [...root(workspaceId), "models", filter],
    queryFn: ({ signal }) => mlRequest<MlModelsResponse>(workspaceId as string, "GET", "/models", {
      params: { symbol: filter.symbol, horizon_minutes: filter.horizon_minutes, limit: filter.limit ?? 50 },
      signal,
    }),
    enabled: Boolean(workspaceId),
    refetchInterval: every(30_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMlSystem(workspaceId?: string) {
  return useQuery({
    queryKey: [...root(workspaceId), "system"],
    queryFn: ({ signal }) => mlRequest<MlSystem>(workspaceId as string, "GET", "/system", { signal }),
    enabled: Boolean(workspaceId),
    refetchInterval: every(10_000),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

/** Every mutation refreshes the whole ML Training cache for the workspace (runs, detail, overview). */
function useMlMutation<TInput, TResult>(workspaceId: string | undefined, run: (workspaceId: string, input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, MlApiError | Error, TInput>({
    mutationFn: (input) => {
      if (!workspaceId) throw new Error("No workspace selected.");
      return run(workspaceId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: root(workspaceId) }),
  });
}

export function useMlStartRun(workspaceId?: string) {
  return useMlMutation<MlStartRunInput, { run: MlRunSummary }>(workspaceId, (ws, input) => mlRequest(ws, "POST", "/runs", { body: input }));
}

export function useMlStartBatch(workspaceId?: string) {
  return useMlMutation<MlStartBatchInput, MlBatchResult>(workspaceId, (ws, input) => mlRequest(ws, "POST", "/batches", { body: input }));
}

export function useMlStopRun(workspaceId?: string) {
  return useMlMutation<string, { run: MlRunSummary }>(workspaceId, (ws, id) => mlRequest(ws, "POST", `/runs/${encodeURIComponent(id)}/stop`));
}

export function useMlRetryRun(workspaceId?: string) {
  return useMlMutation<string, { run: MlRunSummary }>(workspaceId, (ws, id) => mlRequest(ws, "POST", `/runs/${encodeURIComponent(id)}/retry`));
}

export function useMlStopBatch(workspaceId?: string) {
  return useMlMutation<string, { stopped: number; cancelled: number }>(workspaceId, (ws, id) => mlRequest(ws, "POST", `/batches/${encodeURIComponent(id)}/stop`));
}

export function useMlResumeBackfill(workspaceId?: string) {
  return useMlMutation<string, { job: unknown }>(workspaceId, (ws, symbol) => mlRequest(ws, "POST", `/backfill/${encodeURIComponent(symbol)}/resume`));
}
