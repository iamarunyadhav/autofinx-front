import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface LiveBot {
  id: string;
  workspace_id: string;
  name: string;
  exchange: string;
  symbol: string;
  asset_class?: 'CRYPTO' | 'METALS';
  asset_code?: string;
  quote_currency?: 'USD' | 'LKR' | 'USDT';
  provider?: string;
  metal_type?: 'GOLD' | 'SILVER' | 'BRONZE' | null;
  interval_sec: number;
  is_live: boolean;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  risk_profile_id?: string | null;
  strategy_type: string;
  strategy_params?: Record<string, unknown>;
  allocation_mode?: 'FIXED' | 'PERCENT_WALLET' | 'STRATEGY';
  allocation_percent?: number | null;
  trade_allocation_amount?: number | null;
  trade_allocation_currency?: 'USD' | 'LKR' | 'USDT' | null;
  last_evaluated_at?: string | null;
  last_started_at?: string | null;
  cooldown_until?: string | null;
}

export interface AiRecommendation {
  id: string;
  bot_id: string;
  mode: 'OFF' | 'ADVISORY' | 'AUTO_TUNE' | string;
  applied: boolean;
  applied_at?: string | null;
  payload_json: {
    stats?: Record<string, unknown>;
    suggestion?: {
      posture?: string;
      reason?: string;
      params?: Record<string, unknown>;
      can_auto_apply?: boolean;
    };
    generated_at?: string;
  };
  created_at?: string;
}

export function useLiveBots(
  workspaceId: string | undefined,
  filters?: { assetClass?: 'CRYPTO' | 'METALS'; metalType?: 'GOLD' | 'SILVER' | 'BRONZE' }
) {
  return useQuery({
    queryKey: ['live-bots', workspaceId, filters?.assetClass, filters?.metalType],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ bots: LiveBot[] }>('live-bots', {
        action: 'get_bots',
        workspace_id: workspaceId,
        asset_class: filters?.assetClass,
        metal_type: filters?.metalType,
      });
      return data.bots || [];
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

export function useBotMonitor(botId: string | undefined) {
  return useQuery({
    queryKey: ['bot-monitor', botId],
    queryFn: async () => {
      if (!botId) return null;
      return callEdgeFunction<any>('live-bots', { action: 'monitor_bot', bot_id: botId });
    },
    enabled: !!botId,
    refetchInterval: 3000,
  });
}

export function useCreateLiveBot(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!workspaceId) throw new Error('Workspace required');
      const data = await callEdgeFunction<{ bot: LiveBot }>('live-bots', {
        action: 'create_bot',
        workspace_id: workspaceId,
        payload,
      });
      return data.bot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-bots', workspaceId] });
      toast({ title: 'Bot created', description: 'Live bot has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    },
  });
}

function createBotActionMutation(
  action: 'start_bot' | 'pause_bot' | 'stop_bot' | 'emergency_stop' | 'close_position',
  successTitle: string
) {
  return function useAction(workspaceId: string | undefined) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
      mutationFn: async ({ botId, payload }: { botId: string; payload?: Record<string, unknown> }) => {
        return callEdgeFunction<any>('live-bots', {
          action,
          bot_id: botId,
          payload,
        });
      },
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: ['live-bots', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['bot-monitor', vars.botId] });
        toast({ title: successTitle });
      },
      onError: (error: Error) => {
        toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
      },
    });
  };
}

export const useStartBot = createBotActionMutation('start_bot', 'Bot started');
export const usePauseBot = createBotActionMutation('pause_bot', 'Bot paused');
export const useStopBot = createBotActionMutation('stop_bot', 'Bot stopped');
export const useEmergencyStopBot = createBotActionMutation('emergency_stop', 'Emergency stop sent');
export const useClosePositionNow = createBotActionMutation('close_position', 'Close position signal queued');

export function useAssetRegistry() {
  return useQuery({
    queryKey: ['asset-registry'],
    queryFn: async () => {
      return callEdgeFunction<any>('live-bots', { action: 'get_assets' });
    },
    staleTime: 60_000,
  });
}

export function useMetalsRates(provider = 'metal_broker') {
  return useQuery({
    queryKey: ['metals-rates', provider],
    queryFn: async () => {
      return callEdgeFunction<any>('live-bots', { action: 'metals_rates', provider });
    },
    refetchInterval: 5000,
  });
}

export function useLiveMarketPrice(params: {
  asset_class: 'CRYPTO' | 'METALS';
  asset_code: string;
  provider?: string;
  quote?: 'USD' | 'LKR' | 'USDT';
}) {
  return useQuery({
    queryKey: ['market-price', params.asset_class, params.asset_code, params.provider, params.quote],
    queryFn: async () => {
      return callEdgeFunction<any>('live-bots', { action: 'market_price', ...params });
    },
    enabled: !!params.asset_code,
    refetchInterval: 4000,
  });
}

export function useAiRecommendations(botId: string | undefined, refresh = false) {
  return useQuery({
    queryKey: ['bot-ai-recommendations', botId, refresh],
    queryFn: async () => {
      if (!botId) return { mode: 'OFF', recommendations: [] as AiRecommendation[] };
      const qs = refresh ? '?refresh=1' : '';
      return callEdgeFunction<{ mode: string; recommendations: AiRecommendation[] }>('live-bots', {
        action: 'ai_recommendations',
        bot_id: botId,
        query: qs,
      });
    },
    enabled: !!botId,
    refetchInterval: 15000,
  });
}

export function useApplyAiRecommendation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ botId, recommendationId }: { botId: string; recommendationId?: string }) => {
      return callEdgeFunction<any>('live-bots', {
        action: 'ai_apply_recommendation',
        bot_id: botId,
        recommendation_id: recommendationId,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['live-bots', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['bot-monitor', vars.botId] });
      queryClient.invalidateQueries({ queryKey: ['bot-ai-recommendations', vars.botId] });
      toast({ title: 'AI recommendation applied' });
    },
    onError: (error: Error) => {
      toast({ title: 'AI apply failed', description: error.message, variant: 'destructive' });
    },
  });
}
