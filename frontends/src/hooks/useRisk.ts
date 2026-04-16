import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface RiskProfile {
  id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
  rules: Record<string, unknown>;
  max_trade_percent: number | null;
  max_position_percent: number | null;
  max_daily_loss_percent: number | null;
  max_drawdown_percent: number | null;
  max_leverage: number | null;
  stop_loss_percent: number | null;
  take_profit_percent: number | null;
  trailing_stop_percent: number | null;
  slippage_tolerance: number | null;
  daily_max_orders: number | null;
  max_open_orders: number | null;
  max_open_positions: number | null;
  allowed_symbols: string[];
  blocked_symbols: string[];
  created_at?: string;
  updated_at?: string;
}

interface RawRiskProfile {
  id: string;
  workspace_id: string;
  name: string;
  is_default?: boolean | null;
  rules?: Record<string, unknown> | null;
  max_trade_percent?: number | null;
  max_position_percent?: number | null;
  max_daily_loss_percent?: number | null;
  max_drawdown_percent?: number | null;
  max_leverage?: number | null;
  stop_loss_percent?: number | null;
  take_profit_percent?: number | null;
  trailing_stop_percent?: number | null;
  slippage_tolerance?: number | null;
  daily_max_orders?: number | null;
  max_open_orders?: number | null;
  max_open_positions?: number | null;
  allowed_symbols?: string[] | null;
  blocked_symbols?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

interface SystemSettings {
  id: string;
  workspace_id?: string;
  global_trading_enabled: boolean;
  kill_switch_active?: boolean;
  kill_switch_reason?: string | null;
  kill_switch_activated_at?: string | null;
  default_risk_profile_id?: string | null;
  maintenance_mode?: boolean;
  max_concurrent_strategies?: number | null;
  created_at?: string;
}

interface RiskValidation {
  valid: boolean;
  validations: Array<{
    rule: string;
    valid: boolean;
    reason?: string;
  }>;
  portfolio_value: number;
  daily_pnl: number;
}

export function useRiskProfiles(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['risk-profiles', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ profiles: RawRiskProfile[] }>('risk', {
        action: 'get_profiles',
        workspace_id: workspaceId,
      });
      return (data.profiles || []).map(mapRiskProfile);
    },
    enabled: !!workspaceId,
  });
}

export function useSystemSettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['system-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const data = await callEdgeFunction<{ settings: SystemSettings }>('risk', {
        action: 'get_system_settings',
        workspace_id: workspaceId,
      });
      return data.settings;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateRiskProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      limits,
    }: {
      workspaceId: string;
      name: string;
      limits: {
        is_default?: boolean;
        max_trade_percent?: number;
        max_position_percent?: number;
        max_daily_loss_percent?: number;
        max_drawdown_percent?: number;
        max_leverage?: number;
        stop_loss_percent?: number;
        take_profit_percent?: number;
        trailing_stop_percent?: number;
        slippage_tolerance?: number;
        daily_max_orders?: number;
        max_open_orders?: number;
        max_open_positions?: number;
        allowed_symbols?: string[];
        blocked_symbols?: string[];
      };
    }) => {
      const data = await callEdgeFunction<{ profile: RawRiskProfile }>('risk', {
        action: 'create_profile',
        workspace_id: workspaceId,
        name,
        limits,
      });
      return mapRiskProfile(data.profile);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['risk-profiles', variables.workspaceId] });
      toast({
        title: 'Risk Profile Created',
        description: `${variables.name} has been saved`,
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

export function useUpdateRiskProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      profileId,
      workspaceId,
      updates,
    }: {
      profileId: string;
      workspaceId: string;
      updates: Partial<RiskProfile>;
    }) => {
      const data = await callEdgeFunction<{ profile: RawRiskProfile }>('risk', {
        action: 'update_profile',
        profile_id: profileId,
        workspace_id: workspaceId,
        updates: {
          name: updates.name,
          is_default: updates.is_default,
          max_trade_percent: updates.max_trade_percent,
          max_position_percent: updates.max_position_percent,
          max_daily_loss_percent: updates.max_daily_loss_percent,
          max_drawdown_percent: updates.max_drawdown_percent,
          max_leverage: updates.max_leverage,
          stop_loss_percent: updates.stop_loss_percent,
          take_profit_percent: updates.take_profit_percent,
          trailing_stop_percent: updates.trailing_stop_percent,
          slippage_tolerance: updates.slippage_tolerance,
          daily_max_orders: updates.daily_max_orders,
          max_open_orders: updates.max_open_orders,
          max_open_positions: updates.max_open_positions,
          allowed_symbols: updates.allowed_symbols,
          blocked_symbols: updates.blocked_symbols,
        },
      });
      return mapRiskProfile(data.profile);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['risk-profiles', variables.workspaceId] });
      toast({
        title: 'Risk Profile Updated',
        description: 'Your changes have been saved',
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

export function useValidateOrder() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      orderValue,
      profileId,
    }: {
      workspaceId: string;
      orderValue: number;
      profileId: string;
    }) => {
      const data = await callEdgeFunction<RiskValidation>('risk', {
        action: 'validate_order',
        workspace_id: workspaceId,
        order_value: orderValue,
        profile_id: profileId,
      });
      return data;
    },
  });
}

export function useGlobalKillSwitch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      enabled,
    }: {
      workspaceId: string;
      enabled: boolean;
    }) => {
      const data = await callEdgeFunction<{ success: boolean; global_trading_enabled: boolean }>('risk', {
        action: 'global_kill_switch',
        workspace_id: workspaceId,
        enabled,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['strategy-instances', variables.workspaceId] });
      toast({
        title: data.global_trading_enabled ? 'Trading Enabled' : 'Trading Disabled',
        description: data.global_trading_enabled
          ? 'All strategies can now execute trades'
          : 'KILL SWITCH ACTIVATED - All trading stopped',
        variant: data.global_trading_enabled ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Kill Switch Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

function mapRiskProfile(profile: RawRiskProfile): RiskProfile {
  const rules = profile.rules ?? {};

  return {
    id: profile.id,
    workspace_id: profile.workspace_id,
    name: profile.name,
    is_default: Boolean(profile.is_default),
    rules,
    max_trade_percent: profile.max_trade_percent ?? numberOrNull(rules.max_trade_pct),
    max_position_percent: profile.max_position_percent ?? numberOrNull(rules.max_position_pct),
    max_daily_loss_percent: profile.max_daily_loss_percent ?? numberOrNull(rules.daily_loss_pct),
    max_drawdown_percent: profile.max_drawdown_percent ?? numberOrNull(rules.max_drawdown_pct ?? rules.drawdown_pct),
    max_leverage: profile.max_leverage ?? numberOrNull(rules.max_leverage),
    stop_loss_percent: profile.stop_loss_percent ?? numberOrNull(rules.stop_loss_pct),
    take_profit_percent: profile.take_profit_percent ?? numberOrNull(rules.take_profit_pct),
    trailing_stop_percent: profile.trailing_stop_percent ?? numberOrNull(rules.trailing_stop_pct),
    slippage_tolerance: profile.slippage_tolerance ?? slippageToleranceFromRules(rules),
    daily_max_orders: profile.daily_max_orders ?? integerOrNull(rules.daily_max_orders),
    max_open_orders: profile.max_open_orders ?? integerOrNull(rules.max_open_orders),
    max_open_positions: profile.max_open_positions ?? integerOrNull(rules.max_open_positions),
    allowed_symbols: arrayOrEmpty(profile.allowed_symbols ?? rules.allowed_symbols),
    blocked_symbols: arrayOrEmpty(profile.blocked_symbols ?? rules.blocked_symbols),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value: unknown): number | null {
  const numeric = numberOrNull(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function arrayOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function slippageToleranceFromRules(rules: Record<string, unknown>): number | null {
  const bps = numberOrNull(rules.slippage_bps);
  if (bps !== null) {
    return bps / 10000;
  }

  return null;
}
