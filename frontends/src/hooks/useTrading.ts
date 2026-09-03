import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// These used to be aliased from the auto-generated Supabase schema type,
// left over from before this app moved onto the Laravel backend. That type no
// longer matches the real schema — GET /workspaces/{id}/orders|positions|trades
// (TradingController.php) returns Eloquent's raw column set for the
// `orders`/`positions`/`trades` tables (see
// database/migrations/2025_12_31_114501_create_domain_tables.php), which has
// different column names in several places (avg_price/unrealized_pl here vs
// avg_entry_price/unrealized_pnl in the stale generated type). The runtime
// code was already reading the correct (Laravel) field names; only the type
// layer was wrong. Hand-written here to match the real API response shape.
export interface Order {
  id: string;
  workspace_id: string;
  instance_id: string | null;
  symbol_id: string | null;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit' | string;
  quantity: number;
  price: number | null;
  status: 'pending' | 'pending_provider' | 'filled' | 'failed' | 'NEW' | 'PARTIAL' | 'CANCELLED' | 'REJECTED' | 'UNCERTAIN' | string;
  meta: Record<string, any> | null;
  external_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  // Eager-loaded via TradingController::orders()'s ->with('symbol').
  symbol?: { id: string; symbol: string; type: string; exchange: string | null } | null;
}

const TRADING_TABLE_REFRESH_MS = 10000;

export interface Position {
  id: string;
  workspace_id: string;
  symbol_id: string;
  quantity: number;
  avg_price: number;
  unrealized_pl: number;
  created_at: string;
  updated_at: string;
  // Eager-loaded via TradingController::positions()'s ->with('symbol').
  symbol?: { id: string; symbol: string; type: string; exchange: string | null } | null;
}

export interface Trade {
  id: string;
  order_id: string;
  workspace_id: string;
  price: number;
  quantity: number;
  fee: number;
  executed_at: string;
  meta: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

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
    refetchInterval: TRADING_TABLE_REFRESH_MS,
    refetchIntervalInBackground: false,
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
    refetchInterval: TRADING_TABLE_REFRESH_MS,
    refetchIntervalInBackground: false,
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
