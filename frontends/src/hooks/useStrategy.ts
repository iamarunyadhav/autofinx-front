import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Strategy = Database['public']['Tables']['strategies']['Row'];
type StrategyInstance = Database['public']['Tables']['strategy_instances']['Row'];

interface StrategyInstanceWithRelations extends StrategyInstance {
  strategies: Strategy;
  strategy_schedules: Array<Database['public']['Tables']['strategy_schedules']['Row']>;
  instance_risk_profiles: Array<{
    risk_profiles: Database['public']['Tables']['risk_profiles']['Row'];
  }>;
}

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const data = await callEdgeFunction<{ strategies: Strategy[] }>('strategy', {
        action: 'get_strategies',
      });
      return data.strategies;
    },
  });
}

export function useStrategyInstances(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['strategy-instances', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ instances: StrategyInstanceWithRelations[] }>('strategy', {
        action: 'get_instances',
        workspace_id: workspaceId,
      });
      return data.instances;
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      strategyId,
      name,
      mode = 'paper',
      params = {},
      connectionId,
    }: {
      workspaceId: string;
      strategyId: string;
      name: string;
      mode?: 'paper' | 'live';
      params?: Record<string, unknown>;
      connectionId?: string;
    }) => {
      const data = await callEdgeFunction<{ instance: StrategyInstance }>('strategy', {
        action: 'create_instance',
        workspace_id: workspaceId,
        strategy_id: strategyId,
        name,
        mode,
        params,
        connection_id: connectionId,
      });
      return data.instance;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: 'Strategy Created',
        description: `${variables.name} has been created in ${variables.mode} mode`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useToggleInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      workspaceId,
      isEnabled,
    }: {
      instanceId: string;
      workspaceId: string;
      isEnabled: boolean;
    }) => {
      const data = await callEdgeFunction<{ instance: StrategyInstance }>('strategy', {
        action: 'toggle_instance',
        instance_id: instanceId,
        workspace_id: workspaceId,
        is_enabled: isEnabled,
      });
      return data.instance;
    },
    onSuccess: (instance, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: variables.isEnabled ? 'Strategy Started' : 'Strategy Stopped',
        description: `${instance.name} is now ${variables.isEnabled ? 'running' : 'paused'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateParams() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      workspaceId,
      params,
    }: {
      instanceId: string;
      workspaceId: string;
      params: Record<string, unknown>;
    }) => {
      const data = await callEdgeFunction<{ instance: StrategyInstance }>('strategy', {
        action: 'update_params',
        instance_id: instanceId,
        workspace_id: workspaceId,
        params,
      });
      return data.instance;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: 'Parameters Updated',
        description: 'Strategy parameters have been saved',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSetMode() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      workspaceId,
      mode,
      connectionId,
    }: {
      instanceId: string;
      workspaceId: string;
      mode: 'paper' | 'live';
      connectionId?: string;
    }) => {
      const data = await callEdgeFunction<{ instance: StrategyInstance }>('strategy', {
        action: 'set_mode',
        instance_id: instanceId,
        workspace_id: workspaceId,
        mode,
        connection_id: connectionId,
      });
      return data.instance;
    },
    onSuccess: (instance, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: `Switched to ${variables.mode.toUpperCase()}`,
        description: `${instance.name} is now in ${variables.mode} trading mode`,
        variant: variables.mode === 'live' ? 'default' : 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Mode Switch Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      instanceId,
      workspaceId,
    }: {
      instanceId: string;
      workspaceId: string;
    }) => {
      await callEdgeFunction<{ success: boolean }>('strategy', {
        action: 'delete_instance',
        instance_id: instanceId,
        workspace_id: workspaceId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: 'Strategy Deleted',
        description: 'The strategy instance has been removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
