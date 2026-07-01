import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

export interface RuntimeHealth {
  overall: "green" | "yellow" | "red";
  workspace_id?: string | null;
  generated_at: string;
  quick_trade: {
    settler: "green" | "yellow" | "red";
    settler_age_seconds?: number | null;
    open_expired_count: number;
    settler_detail?: Record<string, unknown>;
  };
  robot_trade: {
    evaluator: "green" | "yellow" | "red";
    evaluator_age_seconds?: number | null;
    market_feed: "green" | "yellow" | "red";
    evaluator_detail?: Record<string, unknown>;
    market_feed_detail?: Record<string, unknown>;
  };
  future_trade: {
    live_feed: "green" | "yellow" | "red";
    live_feed_age_seconds?: number | null;
    live_feed_detail?: Record<string, unknown>;
    user_stream: "green" | "yellow" | "red";
    execution_queue: "green" | "yellow" | "red";
    tick: "green" | "yellow" | "red";
    reconcile: "green" | "yellow" | "red";
    daily_loss_lock?: boolean;
    [key: string]: unknown;
  };
  binance: {
    rest: "green" | "yellow" | "red";
    ws: "green" | "yellow" | "red";
    circuit: string;
    message?: string;
  };
  supervisor?: {
    quick_settler: string;
    robot_evaluator: string;
    live_feed: string;
    user_stream: string;
    tick_loop: string;
    queue_critical: string;
  };
  reasons: string[];
}

export function useRuntimeHealth(workspaceId?: string) {
  return useQuery({
    queryKey: ["runtime-health", workspaceId],
    queryFn: async () => {
      const suffix = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";
      return authorizedFetch(`/runtime/health${suffix}`) as Promise<RuntimeHealth>;
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

export interface RuntimeRepairResult {
  ok: boolean;
  method: string;
  exit_code: number;
  output: string;
  health: RuntimeHealth;
  ran_at: string;
}

export function useRepairRuntime(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      authorizedFetch("/runtime/repair", "POST", { workspace_id: workspaceId }) as Promise<RuntimeRepairResult>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runtime-health", workspaceId] });
    },
  });
}

export function runtimeIsRed(health?: RuntimeHealth | null) {
  return health?.overall === "red";
}
