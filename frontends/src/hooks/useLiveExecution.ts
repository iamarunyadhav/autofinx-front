import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type LiveExecutionOrder = {
  id: string;
  asset_code: string;
  side: string;
  type: string;
  status: string;
  provider_status?: string | null;
  exchange_order_id?: string | null;
  client_order_id?: string | null;
  filled_qty?: number | null;
  avg_fill_price?: number | null;
  slippage_pct?: number | null;
  latency_ms?: number | null;
  reconciliation_state?: string | null;
  created_at: string;
  execution_attempts_count?: number;
  execution_events_count?: number;
  fills_count?: number;
  meta?: Record<string, any> | null;
};

export type LiveExecutionEvent = {
  id: string;
  order_id?: string | null;
  symbol?: string | null;
  event_type: string;
  severity: string;
  source?: string | null;
  payload_json?: Record<string, any> | null;
  occurred_at: string;
};

export type LiveExecutionAnomaly = {
  id: string;
  type: string;
  severity: string;
  reason_json?: Record<string, any> | null;
  triggered_at: string;
};

export type LiveExecutionHealth = {
  provider_breaker: Record<string, any>;
  stale_feed_breaker: Record<string, any>;
  rest_health: Record<string, any>;
  open_orders: number;
  uncertain_orders: number;
  stale_open_orders: number;
  avg_slippage_pct_24h: number;
  avg_submission_latency_ms_24h: number;
  connections: Array<Record<string, any>>;
};

export type LiveExecutionOrderDetail = {
  order: LiveExecutionOrder;
  fills: Array<Record<string, any>>;
  attempts: Array<Record<string, any>>;
  events: LiveExecutionEvent[];
};

export function useLiveExecutionHealth(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['live-execution-health', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/live/execution/health`) as Promise<LiveExecutionHealth>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useLiveOrders(workspaceId: string | undefined, symbol?: string, status?: string) {
  return useQuery({
    queryKey: ['live-orders', workspaceId, symbol || '', status || ''],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      if (status) params.set('status', status);
      return authorizedFetch(`/workspaces/${workspaceId}/live/orders${params.toString() ? `?${params.toString()}` : ''}`) as Promise<LiveExecutionOrder[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useLiveOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ['live-order-detail', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      return authorizedFetch(`/live/orders/${orderId}`) as Promise<LiveExecutionOrderDetail>;
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });
}

export function useLiveExecutionEvents(workspaceId: string | undefined, orderId?: string) {
  return useQuery({
    queryKey: ['live-execution-events', workspaceId, orderId || ''],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams();
      if (orderId) params.set('order_id', orderId);
      return authorizedFetch(`/workspaces/${workspaceId}/live/execution/events${params.toString() ? `?${params.toString()}` : ''}`) as Promise<LiveExecutionEvent[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useLiveExecutionAnomalies(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['live-execution-anomalies', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/live/execution/anomalies`) as Promise<LiveExecutionAnomaly[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useWorkspaceLiveSync(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ symbol, integrationId }: { symbol?: string; integrationId?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/live/execution/sync`, 'POST', {
        symbol: symbol || undefined,
        integration_id: integrationId || undefined,
      }) as Promise<{ synced: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-health', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-events', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-anomalies', workspaceId] });
      toast({ title: 'Live sync triggered' });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReconcileLiveOrder(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/live/orders/${orderId}/reconcile`, 'POST', {
        workspace_id: workspaceId,
      }) as Promise<{ order: LiveExecutionOrder }>;
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['live-orders', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-events', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-anomalies', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-health', workspaceId] });
      toast({ title: 'Order reconciled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Reconcile failed', description: error.message, variant: 'destructive' });
    },
  });
}
