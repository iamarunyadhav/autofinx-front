import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type PortfolioIntelligenceConfig = {
  id: string;
  workspace_id: string;
  enabled: boolean;
  ranking_mode: 'heuristic' | 'score_based' | 'rule_based';
  allocation_mode: 'equal_weight' | 'score_weighted' | 'capped_score_weighted' | 'conservative_risk_weighted';
  opportunity_score_threshold?: number | null;
  max_total_allocated_pct?: number | null;
  max_symbol_allocated_pct?: number | null;
  max_correlated_group_allocated_pct?: number | null;
  max_simultaneous_new_trades?: number | null;
  reserve_cash_buffer_pct?: number | null;
  max_open_positions?: number | null;
  max_open_decision_count?: number | null;
  max_total_notional?: number | null;
  max_daily_loss_pct?: number | null;
  max_drawdown_pct?: number | null;
  prefer_hold_cash_under_high_uncertainty: boolean;
  reduce_size_under_external_risk: boolean;
  require_approval_for_rotation: boolean;
  enable_reduce_recommendations: boolean;
  enable_rotation_recommendations: boolean;
  score_weights_json?: Record<string, number> | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PortfolioRecommendation = {
  symbol: string;
  score: number;
  confidence: number;
  trend_direction: string;
  recommended_action: string;
  requires_approval: boolean;
  auto_allowed: boolean;
  blocked: boolean;
  blockers: string[];
  strengths: string[];
  cautions: string[];
  score_breakdown: Array<Record<string, any>>;
  suggested_size_cap_pct: number;
  threshold: number;
  portfolio_impact: Record<string, any>;
  market_price?: number;
  exchange_metadata?: Record<string, any>;
  correlation?: Record<string, any>;
  metadata?: Record<string, any>;
  rank?: number;
  selection_status?: string;
  approval_required?: boolean;
};

export type PortfolioIntelligenceSnapshot = {
  workspace_id: string;
  generated_at: string;
  portfolio_context: Record<string, any>;
  risk_budget: Record<string, any>;
  symbol_universe: Array<Record<string, any>>;
  ranked_opportunities: PortfolioRecommendation[];
  selection: Record<string, any>;
  allocation: Record<string, any>;
  recommendations: Record<string, any>;
  summary: Record<string, any>;
  config: PortfolioIntelligenceConfig;
  run?: Record<string, any> | null;
};

export function usePortfolioIntelligenceConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-intelligence-config', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/config`) as Promise<{
        config: PortfolioIntelligenceConfig;
        effective_config: Record<string, any>;
      }>;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdatePortfolioIntelligenceConfig(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/config`, 'PUT', payload) as Promise<{
        config: PortfolioIntelligenceConfig;
        effective_config: Record<string, any>;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-config', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-snapshot', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-runs', workspaceId] });
      toast({ title: 'Portfolio intelligence config updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Portfolio config update failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePortfolioIntelligenceSnapshot(workspaceId: string | undefined, filters?: { symbol?: string; integrationId?: string; timeframe?: string }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-snapshot', workspaceId, filters?.symbol || '', filters?.integrationId || '', filters?.timeframe || ''],
    queryFn: async () => {
      if (!workspaceId) return null;
      const params = new URLSearchParams();
      if (filters?.symbol) params.set('symbol', filters.symbol);
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/context${suffix}`) as Promise<PortfolioIntelligenceSnapshot>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceRankedOpportunities(workspaceId: string | undefined, filters?: { symbol?: string; integrationId?: string; timeframe?: string; limit?: number }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-ranked', workspaceId, filters?.symbol || '', filters?.integrationId || '', filters?.timeframe || '', String(filters?.limit || '')],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams();
      if (filters?.symbol) params.set('symbol', filters.symbol);
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      if (filters?.limit) params.set('limit', String(filters.limit));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/ranked-opportunities${suffix}`) as {
        opportunities: PortfolioRecommendation[];
        summary: Record<string, any>;
      };
      return data;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceSymbolScore(workspaceId: string | undefined, symbol: string | undefined, filters?: { integrationId?: string; timeframe?: string }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-symbol', workspaceId, symbol || '', filters?.integrationId || '', filters?.timeframe || ''],
    queryFn: async () => {
      if (!workspaceId || !symbol) return null;
      const params = new URLSearchParams();
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/symbols/${encodeURIComponent(symbol)}${suffix}`) as Promise<PortfolioRecommendation>;
    },
    enabled: !!workspaceId && !!symbol,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceAllocation(workspaceId: string | undefined, filters?: { symbol?: string; integrationId?: string; timeframe?: string }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-allocation', workspaceId, filters?.symbol || '', filters?.integrationId || '', filters?.timeframe || ''],
    queryFn: async () => {
      if (!workspaceId) return null;
      const params = new URLSearchParams();
      if (filters?.symbol) params.set('symbol', filters.symbol);
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/allocation${suffix}`) as Promise<{ allocation: Record<string, any>; summary: Record<string, any> }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceRiskBudget(workspaceId: string | undefined, filters?: { symbol?: string; integrationId?: string; timeframe?: string }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-risk-budget', workspaceId, filters?.symbol || '', filters?.integrationId || '', filters?.timeframe || ''],
    queryFn: async () => {
      if (!workspaceId) return null;
      const params = new URLSearchParams();
      if (filters?.symbol) params.set('symbol', filters.symbol);
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/risk-budget${suffix}`) as Promise<Record<string, any>>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceRecommendations(workspaceId: string | undefined, filters?: { symbol?: string; integrationId?: string; timeframe?: string }) {
  return useQuery({
    queryKey: ['portfolio-intelligence-recommendations', workspaceId, filters?.symbol || '', filters?.integrationId || '', filters?.timeframe || ''],
    queryFn: async () => {
      if (!workspaceId) return null;
      const params = new URLSearchParams();
      if (filters?.symbol) params.set('symbol', filters.symbol);
      if (filters?.integrationId) params.set('integration_id', filters.integrationId);
      if (filters?.timeframe) params.set('timeframe', filters.timeframe);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/recommendations${suffix}`) as Promise<Record<string, any>>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function usePortfolioIntelligenceRuns(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio-intelligence-runs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/runs`) as Promise<Array<Record<string, any>>>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useRunPortfolioIntelligence(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/portfolio/intelligence/run`, 'POST', payload) as Promise<PortfolioIntelligenceSnapshot>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-snapshot', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-runs', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-ranked', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-allocation', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-risk-budget', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-intelligence-recommendations', workspaceId] });
      toast({ title: 'Portfolio intelligence run completed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Portfolio run failed', description: error.message, variant: 'destructive' });
    },
  });
}
