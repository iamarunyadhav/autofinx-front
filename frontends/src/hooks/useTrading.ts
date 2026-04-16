import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Position = Database['public']['Tables']['positions']['Row'];
type Trade = Database['public']['Tables']['trades']['Row'];

interface PlaceOrderParams {
  workspace_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  stop_price?: number;
  mode?: 'paper' | 'live';
  integration_id?: string;
  instance_id?: string;
  idempotency_key?: string;
}

export function useOrders(workspaceId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['orders', workspaceId, status],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ orders: Order[] }>('trading', {
        action: 'get_orders',
        workspace_id: workspaceId,
        status,
        limit: 100,
      });
      return data.orders;
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

export function usePositions(workspaceId: string | undefined, mode: 'paper' | 'live' = 'paper') {
  return useQuery({
    queryKey: ['positions', workspaceId, mode],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ positions: Position[] }>('trading', {
        action: 'get_positions',
        workspace_id: workspaceId,
        mode,
      });
      return data.positions;
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

export function useTrades(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['trades', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ trades: Trade[] }>('trading', {
        action: 'get_trades',
        workspace_id: workspaceId,
        limit: 100,
      });
      return data.trades;
    },
    enabled: !!workspaceId,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: PlaceOrderParams) => {
      const data = await callEdgeFunction<{ order: Order }>('trading', {
        action: 'place_order',
        ...params,
      });
      return data.order;
    },
    onSuccess: (order, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders', variables.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['positions', variables.workspace_id] });
      toast({
        title: 'Order Placed',
        description: `${order.side.toUpperCase()} ${variables.mode === 'live' ? 'live' : 'paper'} order submitted`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Order Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, workspaceId }: { orderId: string; workspaceId: string }) => {
      const data = await callEdgeFunction<{ order: Order }>('trading', {
        action: 'cancel_order',
        order_id: orderId,
        workspace_id: workspaceId,
      });
      return data.order;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-orders', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-order-detail', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-events', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-health', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['live-execution-anomalies', variables.workspaceId] });
      toast({
        title: 'Order Cancelled',
        description: 'Your order has been cancelled',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
