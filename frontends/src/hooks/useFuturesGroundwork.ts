import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type FuturesConfig = {
  id: string;
  workspace_id: string;
  futures_enabled: boolean;
  futures_mode: 'disabled' | 'testnet_only' | 'review_only' | 'restricted_testnet_auto';
  allowed_futures_symbols: string[];
  blocked_futures_symbols: string[];
  max_futures_trade_size_pct?: number | null;
  max_futures_notional?: number | null;
  max_leverage?: number | null;
  allowed_margin_modes: string[];
  allowed_position_modes: string[];
  max_open_futures_positions?: number | null;
  max_futures_daily_loss_pct?: number | null;
  max_futures_drawdown_pct?: number | null;
  min_liquidation_buffer_pct?: number | null;
  require_reduce_only_for_protective_exit: boolean;
  require_manual_approval_for_futures: boolean;
  futures_confidence_threshold?: number | null;
  futures_force_testnet: boolean;
  notes?: string | null;
};

export type FuturesReadiness = {
  state: string;
  reasons: string[];
  supports_manual_test_order: boolean;
  supports_auto_testnet: boolean;
  live_ready: boolean;
  environment?: string;
  integration_display_name?: string | null;
};

export type FuturesPosition = Record<string, any>;
export type FuturesOrder = Record<string, any>;
export type FuturesAnomaly = Record<string, any>;

export function useFuturesConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['futures-config', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/futures/config`) as Promise<FuturesConfig>;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateFuturesConfig(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Partial<FuturesConfig>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/futures/config`, 'PUT', payload) as Promise<FuturesConfig>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['futures-config', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['futures-readiness', workspaceId] });
      toast({ title: 'Futures config updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Futures config failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useFuturesReadiness(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['futures-readiness', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/futures/readiness`) as Promise<FuturesReadiness>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useFuturesPositions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['futures-positions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/futures/positions`) as Promise<FuturesPosition[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useFuturesOrders(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['futures-orders', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/futures/orders`) as Promise<FuturesOrder[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useFuturesAnomalies(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['futures-anomalies', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/futures/anomalies`) as Promise<FuturesAnomaly[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

function useWorkspaceMutation(
  workspaceId: string | undefined,
  suffix: string,
  successTitle: string,
  errorTitle: string
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/futures/${suffix}`, 'POST', payload) as Promise<any>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['futures-positions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['futures-orders', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['futures-anomalies', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['futures-readiness', workspaceId] });
      toast({ title: successTitle });
    },
    onError: (error: Error) => {
      toast({ title: errorTitle, description: error.message, variant: 'destructive' });
    },
  });
}

export function useEvaluateFutures(workspaceId: string | undefined) {
  return useWorkspaceMutation(workspaceId, 'evaluate', 'Futures evaluation complete', 'Futures evaluation failed');
}

export function usePlaceFuturesOrder(workspaceId: string | undefined) {
  return useWorkspaceMutation(workspaceId, 'orders', 'Testnet futures order submitted', 'Futures order failed');
}

export function useSyncFutures(workspaceId: string | undefined) {
  return useWorkspaceMutation(workspaceId, 'sync', 'Futures sync complete', 'Futures sync failed');
}
