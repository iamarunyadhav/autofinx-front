import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface RuntimeSafetySettings {
  live_feed_max_age_seconds: number;
  webhook_max_signal_latency_ms: number;
}

const DEFAULT_RUNTIME_SAFETY: RuntimeSafetySettings = {
  live_feed_max_age_seconds: 3,
  webhook_max_signal_latency_ms: 4000,
};

export function useRuntimeSafetySettings(workspaceId?: string) {
  return useQuery({
    queryKey: ["runtime-safety-settings", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return DEFAULT_RUNTIME_SAFETY;
      const data = await authorizedFetch(`/settings?group=runtime_safety&workspace_id=${workspaceId}`) as Partial<RuntimeSafetySettings>;

      return {
        live_feed_max_age_seconds: Number(data.live_feed_max_age_seconds ?? DEFAULT_RUNTIME_SAFETY.live_feed_max_age_seconds),
        webhook_max_signal_latency_ms: Number(data.webhook_max_signal_latency_ms ?? DEFAULT_RUNTIME_SAFETY.webhook_max_signal_latency_ms),
      };
    },
    enabled: !!workspaceId,
    staleTime: 10_000,
  });
}

export function useUpdateRuntimeSafetySettings(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: RuntimeSafetySettings) => {
      if (!workspaceId) throw new Error("Workspace required");

      return authorizedFetch("/settings", "PATCH", {
        workspace_id: workspaceId,
        settings: {
          runtime_safety: payload,
        },
      }) as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runtime-safety-settings", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["runtime-health", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["robot-sessions", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["future-trade", workspaceId] });
      toast({ title: "Safety guards saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Safety save failed", description: error.message, variant: "destructive" });
    },
  });
}
