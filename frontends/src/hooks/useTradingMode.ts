import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type TradingMode = "paper" | "live";

export interface TradingSettingsPayload {
  trading_mode: TradingMode;
  live_enabled: boolean;
  venue_environment: "sandbox" | "live";
  preferred_provider: string;
  preferred_integration_id?: string | null;
  auto_trading_enabled?: boolean;
  bot_default_interval_seconds?: number;
}

export function useTradingSettings(workspaceId?: string) {
  return useQuery({
    queryKey: ["trading-settings", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/settings?group=trading&workspace_id=${workspaceId}`) as Promise<Partial<TradingSettingsPayload>>;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useUpdateTradingSettings(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: TradingSettingsPayload) => {
      if (!workspaceId) throw new Error("Workspace required");

      return authorizedFetch("/settings", "PATCH", {
        workspace_id: workspaceId,
        settings: {
          trading: payload,
        },
      }) as Promise<{ ok: boolean }>;
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["trading-settings", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-metadata", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-chart", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-active", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-history", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["robot-sessions", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["robot-session-status"] });
      queryClient.invalidateQueries({ queryKey: ["balances", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", workspaceId] });
      toast({
        title: "Trading mode updated",
        description: `${payload.trading_mode.toUpperCase()} mode updated${payload.auto_trading_enabled === false ? " and auto trading is disabled." : payload.auto_trading_enabled === true ? " and auto trading is enabled." : "."}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Trading mode update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
