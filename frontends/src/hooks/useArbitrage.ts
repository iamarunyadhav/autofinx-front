import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { authHeaders } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface ArbitrageOpp {
  symbol: string;
  buy: { connection: string; connection_id: string; provider: string; price: number };
  sell: { connection: string; connection_id: string; provider: string; price: number };
  spread: number;
  spread_percent: number;
}

export function useArbitrage(workspaceId: string | undefined, symbols: string[] = ['BTCUSDT', 'ETHUSDT']) {
  return useQuery({
    queryKey: ['arbitrage', workspaceId, symbols],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/arbitrage?symbols[]=` + symbols.join('&symbols[]='), {
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load arbitrage');
      }
      return res.json() as Promise<ArbitrageOpp[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useExecuteArbitrage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      symbol,
      buyConnectionId,
      sellConnectionId,
      quantity,
    }: {
      workspaceId: string;
      symbol: string;
      buyConnectionId: string;
      sellConnectionId: string;
      quantity: number;
    }) => {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/arbitrage/execute`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          symbol,
          buy_connection_id: buyConnectionId,
          sell_connection_id: sellConnectionId,
          quantity,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to execute arbitrage');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['arbitrage', variables.workspaceId] });
    },
  });
}
