import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type ExitPolicy = {
  id: string;
  workspace_id: string;
  default_stop_loss_pct?: string | number | null;
  default_take_profit_pct?: string | number | null;
  default_time_stop_minutes?: number | null;
  trailing_stop_enabled: boolean;
  trailing_stop_pct?: string | number | null;
  partial_take_profit_enabled: boolean;
  partial_take_profit_levels: number[];
  partial_take_profit_sizes: number[];
  break_even_after_partial: boolean;
  emergency_exit_on_breaker: boolean;
  force_exit_on_pause: boolean;
  force_exit_on_max_daily_loss: boolean;
  minimum_position_value_for_partial?: string | number | null;
  native_protection_mode: 'disabled' | 'simple_oco';
};

export type ManagedExitPosition = {
  id: string;
  position_id: string;
  symbol: string;
  status: string;
  managed_mode: string;
  effective_state: string;
  stop_loss_price?: string | number | null;
  take_profit_price?: string | number | null;
  time_stop_at?: string | null;
  trailing_high_water_mark?: string | number | null;
  trailing_stop_price?: string | number | null;
  partial_progress?: Record<string, any> | null;
  blocked_reason?: string | null;
  uncertainty_reason?: string | null;
  last_evaluated_at?: string | null;
  position?: Record<string, any> | null;
  active_exit_order?: Record<string, any> | null;
};

export type ExitEvent = {
  id: string;
  position_id: string;
  symbol: string;
  event_type: string;
  severity: string;
  source?: string | null;
  payload_json?: Record<string, any> | null;
  occurred_at: string;
};

export function useExitPolicy(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['exit-policy', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/exit-policy`) as Promise<{
        policy: ExitPolicy;
        effective_policy: Record<string, any>;
      }>;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateExitPolicy(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/exit-policy`, 'PUT', payload) as Promise<{
        policy: ExitPolicy;
        effective_policy: Record<string, any>;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exit-policy', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['managed-exit-positions', workspaceId] });
      toast({ title: 'Exit policy updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Exit policy update failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useManagedExitPositions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['managed-exit-positions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/managed-positions`) as { positions: ManagedExitPosition[] };
      return data.positions || [];
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useExitEvents(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['exit-events', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/exit-events`) as { events: ExitEvent[] };
      return data.events || [];
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

function createPositionMutation(
  workspaceId: string | undefined,
  pathBuilder: (positionId: string) => string,
  successTitle: string,
  errorTitle: string
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ positionId, payload }: { positionId: string; payload?: Record<string, any> }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(pathBuilder(positionId), 'POST', payload) as Promise<any>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-exit-positions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['exit-events', workspaceId] });
      toast({ title: successTitle });
    },
    onError: (error: Error) => {
      toast({ title: errorTitle, description: error.message, variant: 'destructive' });
    },
  });
}

export function useArmManagedPosition(workspaceId: string | undefined) {
  return createPositionMutation(workspaceId, (positionId) => `/live/positions/${positionId}/exit/arm`, 'Exit automation armed', 'Failed to arm exit automation');
}

export function usePauseManagedPosition(workspaceId: string | undefined) {
  return createPositionMutation(workspaceId, (positionId) => `/live/positions/${positionId}/exit/pause`, 'Exit automation paused', 'Failed to pause exit automation');
}

export function useResumeManagedPosition(workspaceId: string | undefined) {
  return createPositionMutation(workspaceId, (positionId) => `/live/positions/${positionId}/exit/resume`, 'Exit automation resumed', 'Failed to resume exit automation');
}

export function useEvaluateManagedPosition(workspaceId: string | undefined) {
  return createPositionMutation(workspaceId, (positionId) => `/live/positions/${positionId}/exit/evaluate`, 'Exit evaluation completed', 'Exit evaluation failed');
}

export function useFlattenManagedPosition(workspaceId: string | undefined) {
  return createPositionMutation(workspaceId, (positionId) => `/live/positions/${positionId}/exit/flatten`, 'Protective flatten submitted', 'Failed to flatten position');
}
