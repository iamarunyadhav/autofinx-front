import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Was previously aliased from the auto-generated (stale) Supabase Database
// type. StrategyController::instances() (backend) returns a raw Eloquent
// dump of `strategy_instances` eager-loaded with ->with(['strategy', 'params',
// 'connection']) — see app/Models/StrategyInstance.php and
// database/migrations/2025_12_31_114501_create_domain_tables.php +
// 2026_01_04_020000_add_connection_to_strategy_instances.php. The stale type
// had a completely different relation shape (`strategies`/`strategy_schedules`/
// `instance_risk_profiles`, none of which the backend actually returns) and
// no `connection_id` at all (added by a later migration) — several consumers
// were silently reading fields that never existed on the real response.
export interface Strategy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  params_schema: Record<string, any> | null;
  enabled: boolean;
  category: string | null;
  created_at: string;
  updated_at: string;
  // Not currently returned by the backend (no such columns on `strategies`)
  // — kept optional so existing frontend fallbacks stay forward-compatible.
  is_public?: boolean;
  version?: string;
}

export interface StrategyParam {
  id: string;
  instance_id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export interface StrategyInstance {
  id: string;
  workspace_id: string;
  strategy_id: string;
  name: string;
  mode: 'paper' | 'live';
  // No fixed enum enforced server-side (StrategyController validates it as
  // 'sometimes|string'); 'idle' is the DB default, 'running'/'stopped' are
  // what useToggleInstance() actually sends.
  status: 'idle' | 'running' | 'stopped' | string;
  performance: Record<string, any> | null;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
  // Not currently returned by the backend (no such column on
  // strategy_instances) — kept optional so the "N symbols / All symbols"
  // frontend fallback stays forward-compatible if this is ever added.
  allowed_symbols?: string[] | null;
}

export interface StrategyInstanceWithRelations extends StrategyInstance {
  strategy?: Strategy;
  params?: StrategyParam[];
  connection?: { id: string; name: string; provider: string } | null;
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
