import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type AuditLight = "green" | "yellow" | "red" | "gray";

export interface AuditFlowNode {
  key: string;
  label: string;
  state: AuditLight;
  detail?: string | null;
  at?: string | null;
  latencyMs?: number | null;
  blockerType?: "hard" | "soft" | "none" | string;
  nextAction?: string | null;
  retryable?: boolean;
}

export interface AuditFlow {
  title: string;
  enabled: boolean;
  nodes: AuditFlowNode[];
}

export interface AuditTimelineItem {
  at?: string | null;
  type: "webhook" | "order" | "robot" | string;
  title: string;
  state: AuditLight;
  reason?: string | null;
  latency_ms?: number | null;
}

export interface AuditFlowOverview {
  generated_at: string;
  workspace_id: string;
  flows: Record<string, AuditFlow>;
  runtime?: Record<string, unknown>;
  report?: {
    summary?: string;
    health?: Record<string, string | number | null>;
    hard_blockers?: AuditFlowNode[];
    soft_warnings?: AuditFlowNode[];
    failover?: Array<{ label: string; state: string; detail?: string | null }>;
    operator_actions?: Record<string, string | null>;
    raw_refs?: Record<string, string | number | null>;
  };
  metrics: Record<string, number>;
  latest: Record<string, unknown>;
  queues: Record<string, { pending: number | null; failed: number | null }>;
  scheduler: { latest_runs: unknown[] };
  timeline: AuditTimelineItem[];
  actions: Record<string, string>;
}

export function useAuditFlow(workspaceId?: string) {
  const queryClient = useQueryClient();
  const base = workspaceId ? `/workspaces/${workspaceId}` : "";

  const overview = useQuery({
    queryKey: ["audit-flow", workspaceId],
    enabled: Boolean(workspaceId),
    refetchInterval: 2500,
    queryFn: async () => (await api.get<AuditFlowOverview>(`${base}/audit/flow-overview`)).data,
  });

  const recoverRuntime = useMutation({
    mutationFn: async () => (await api.post(`${base}/future-trade/runtime/recover`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-flow", workspaceId] }),
  });

  const restartLiveFeed = useMutation({
    mutationFn: async () => (await api.post(`${base}/future-trade/live-feed/restart`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-flow", workspaceId] }),
  });

  const restartWorkers = useMutation({
    mutationFn: async () => (await api.post("/jobs/restart-workers", {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-flow", workspaceId] }),
  });

  const retryFailedJobs = useMutation({
    mutationFn: async (queue?: string) => (await api.post("/jobs/failed/retry", { id: "all", queue })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit-flow", workspaceId] }),
  });

  const setOrderTransport = useMutation({
    mutationFn: async (transport: "rest" | "websocket") => (await api.put(`${base}/future-trade/config`, {
      settings: {
        orderTransport: transport,
        orderWebSocketEnabled: transport === "websocket",
      },
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-flow", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["future-trade", workspaceId] });
    },
  });

  return {
    overview,
    recoverRuntime,
    restartLiveFeed,
    restartWorkers,
    retryFailedJobs,
    setOrderTransport,
  };
}
