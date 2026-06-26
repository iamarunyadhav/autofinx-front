import { useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

export interface RuntimeHealth {
  overall: "green" | "yellow" | "red";
  workspace_id?: string | null;
  generated_at: string;
  quick_trade: {
    settler: "green" | "yellow" | "red";
    open_expired_count: number;
    settler_detail?: Record<string, unknown>;
  };
  robot_trade: {
    evaluator: "green" | "yellow" | "red";
    market_feed: "green" | "yellow" | "red";
    evaluator_detail?: Record<string, unknown>;
    market_feed_detail?: Record<string, unknown>;
  };
  future_trade: {
    live_feed: "green" | "yellow" | "red";
    user_stream: "green" | "yellow" | "red";
    execution_queue: "green" | "yellow" | "red";
    tick: "green" | "yellow" | "red";
    reconcile: "green" | "yellow" | "red";
    [key: string]: unknown;
  };
  binance: {
    rest: "green" | "yellow" | "red";
    ws: "green" | "yellow" | "red";
    circuit: string;
    message?: string;
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

export function runtimeIsRed(health?: RuntimeHealth | null) {
  return health?.overall === "red";
}
