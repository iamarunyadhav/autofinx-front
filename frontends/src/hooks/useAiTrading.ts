import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type AiTradingConfig = {
  id: string;
  workspace_id: string;
  enabled: boolean;
  mode: 'advisor' | 'manual_approval' | 'restricted_auto';
  exchange: 'binance';
  market_type: 'spot';
  provider: 'heuristic' | 'openai' | 'gemini' | 'anthropic' | 'claude' | 'null' | 'off' | 'disabled';
  provider_model?: string | null;
  enabled_symbols: string[];
  allowed_symbols: string[];
  blocked_symbols: string[];
  max_trade_size_pct?: number | null;
  min_confidence?: number | null;
  cooldown_minutes?: number;
  max_pending_decisions_per_symbol?: number;
  max_decisions_per_hour_per_symbol?: number;
  decision_interval_minutes?: number;
  max_decisions_per_hour?: number;
  cooldown_minutes_after_trade?: number;
  cooldown_minutes_after_loss?: number;
  pause_until?: string | null;
  auto_pause_on_daily_loss: boolean;
  auto_pause_on_drawdown: boolean;
  auto_pause_on_order_failure_streak?: number;
  auto_pause_on_slippage_spike: boolean;
  auto_pause_on_reconciliation_mismatch: boolean;
  manual_resume_required: boolean;
  require_stop_loss: boolean;
  require_take_profit: boolean;
  require_time_stop: boolean;
  auto_trade_enabled: boolean;
  notes?: string | null;
};

export type AiDecision = {
  id: string;
  workspace_id: string;
  symbol: string;
  action?: string | null;
  confidence?: number | null;
  provider_name?: string | null;
  provider_model?: string | null;
  final_status: string;
  requires_approval: boolean;
  rejection_reason?: string | null;
  validated_proposal_json?: Record<string, any> | null;
  policy_result_json?: Record<string, any> | null;
  created_at: string;
  expires_at?: string | null;
};

export type AiDecisionEvent = {
  id: string;
  ai_decision_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_type?: string | null;
  payload_json?: Record<string, any> | null;
  created_at: string;
};

export type AiDecisionResponse = {
  decision: AiDecision;
  message?: string;
  order?: Record<string, any>;
  cycle?: AiDecisionCycle;
};

export type AiDecisionCycle = {
  id: string;
  workspace_id: string;
  ai_decision_id?: string | null;
  symbol: string;
  mode: string;
  trigger_type: string;
  status: string;
  provider_name?: string | null;
  provider_model?: string | null;
  message?: string | null;
  error_code?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  anomalies_json?: Record<string, any> | null;
  policy_result_json?: Record<string, any> | null;
  execution_result_json?: Record<string, any> | null;
};

export type AiTradingStateRow = {
  id: string;
  workspace_id: string;
  symbol?: string | null;
  status: string;
  reason_code?: string | null;
  reason_detail?: string | null;
  pause_until?: string | null;
  cooldown_until?: string | null;
  manual_resume_required: boolean;
  consecutive_order_failures: number;
  anomaly_snapshot_json?: Record<string, any> | null;
};

export type AiTradingStateResponse = {
  effective: {
    allowed: boolean;
    status: string;
    reason_codes: string[];
    workspace_state?: AiTradingStateRow | null;
    symbol_state?: AiTradingStateRow | null;
    config_pause_until?: string | null;
  };
  states: AiTradingStateRow[];
};

export type AiTradingNotification = {
  id: string;
  type: string;
  content: Record<string, any>;
  created_at: string;
  read_at?: string | null;
};

export type AiAnomalyReport = {
  anomalies: Array<{
    code: string;
    severity: string;
    message: string;
    meta?: Record<string, any>;
  }>;
  recommended_action: string;
  severity: string;
};

export function useAiTradingConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ai-trading-config', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/config`) as Promise<AiTradingConfig>;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateAiTradingConfig(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Partial<AiTradingConfig>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/config`, 'PUT', payload) as Promise<AiTradingConfig>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-config', workspaceId] });
      toast({ title: 'AI trading config updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Config update failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAiDecisions(workspaceId: string | undefined, filters?: { status?: string; symbol?: string }) {
  return useQuery({
    queryKey: ['ai-trading-decisions', workspaceId, filters?.status || '', filters?.symbol || ''],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.symbol) params.set('symbol', filters.symbol);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/decisions${suffix}`) as Promise<AiDecision[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useAiDecisionEvents(decisionId: string | undefined) {
  return useQuery({
    queryKey: ['ai-trading-decision-events', decisionId],
    queryFn: async () => {
      if (!decisionId) return [];
      return authorizedFetch(`/ai-trading/decisions/${decisionId}/events`) as Promise<AiDecisionEvent[]>;
    },
    enabled: !!decisionId,
    refetchInterval: 15000,
  });
}

export function useAiTradingState(workspaceId: string | undefined, symbol?: string) {
  return useQuery({
    queryKey: ['ai-trading-state', workspaceId, symbol || ''],
    queryFn: async () => {
      if (!workspaceId) return null;
      const suffix = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/state${suffix}`) as Promise<AiTradingStateResponse>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useAiDecisionCycles(workspaceId: string | undefined, symbol?: string) {
  return useQuery({
    queryKey: ['ai-trading-cycles', workspaceId, symbol || ''],
    queryFn: async () => {
      if (!workspaceId) return [];
      const suffix = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/cycles${suffix}`) as Promise<AiDecisionCycle[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useAiTradingNotifications(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ai-trading-notifications', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/notifications`) as Promise<AiTradingNotification[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useAiTradingAnomalies(workspaceId: string | undefined, symbol: string | undefined, integrationId?: string) {
  return useQuery({
    queryKey: ['ai-trading-anomalies', workspaceId, symbol || '', integrationId || ''],
    queryFn: async () => {
      if (!workspaceId || !symbol) return null;
      const params = new URLSearchParams({ symbol });
      if (integrationId) params.set('integration_id', integrationId);
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/anomalies?${params.toString()}`) as Promise<AiAnomalyReport>;
    },
    enabled: !!workspaceId && !!symbol,
    refetchInterval: 15000,
  });
}

export function useBuildAiContext(workspaceId: string | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol, integrationId }: { symbol: string; integrationId?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/context`, 'POST', {
        symbol,
        integration_id: integrationId || undefined,
      }) as Promise<Record<string, any>>;
    },
    onError: (error: Error) => {
      toast({ title: 'Context build failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRequestAiProposal(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol, integrationId }: { symbol: string; integrationId?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/proposals`, 'POST', {
        symbol,
        integration_id: integrationId || undefined,
      }) as Promise<AiDecisionResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decisions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-cycles', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-state', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI proposal created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Proposal failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunAiDecisionCycle(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol, integrationId }: { symbol: string; integrationId?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/cycles/run`, 'POST', {
        symbol,
        integration_id: integrationId || undefined,
      }) as Promise<{ cycle: AiDecisionCycle; decision?: AiDecision | null; order?: Record<string, any> | null; message?: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-cycles', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decisions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-state', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI cycle run complete' });
    },
    onError: (error: Error) => {
      toast({ title: 'Cycle run failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePauseAiTrading(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol, reason }: { symbol?: string; reason?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/pause`, 'POST', {
        symbol: symbol || undefined,
        reason: reason || undefined,
      }) as Promise<AiTradingStateRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-state', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI trading paused' });
    },
    onError: (error: Error) => {
      toast({ title: 'Pause failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useResumeAiTrading(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol }: { symbol?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/resume`, 'POST', {
        symbol: symbol || undefined,
      }) as Promise<AiTradingStateRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-state', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI trading resumed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Resume failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useApproveAiDecision(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ decisionId, executeNow = true }: { decisionId: string; executeNow?: boolean }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/approvals/${decisionId}/approve`, 'POST', {
        execute_now: executeNow,
      }) as Promise<AiDecisionResponse & { executed?: boolean }>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decisions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decision-events', variables.decisionId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-cycles', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-state', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI decision approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRejectAiDecision(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ decisionId, reason }: { decisionId: string; reason?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ai-trading/approvals/${decisionId}/reject`, 'POST', {
        reason: reason || 'operator_rejected',
      }) as Promise<AiDecisionResponse>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decisions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-decision-events', variables.decisionId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-cycles', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-trading-notifications', workspaceId] });
      toast({ title: 'AI decision rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Reject failed', description: error.message, variant: 'destructive' });
    },
  });
}
