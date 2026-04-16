import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { authHeaders } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface StakingPosition {
  id: string;
  asset: string;
  principal: number;
  apy: number;
  accrued: number;
  status: string;
  started_at?: string;
  ends_at?: string;
  meta?: Record<string, any>;
}

export function useStaking(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['staking', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/staking`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load staking');
      return res.json() as Promise<StakingPosition[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useSimulateStaking() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      asset,
      principal,
      apy,
      durationDays,
    }: {
      workspaceId: string;
      asset: string;
      principal: number;
      apy: number;
      durationDays: number;
    }) => {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/staking/simulate`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          asset,
          principal,
          apy,
          duration_days: durationDays,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Simulation failed');
      }
      return res.json();
    },
  });
}

export function useStartStaking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      asset,
      principal,
      apy,
      durationDays,
    }: {
      workspaceId: string;
      asset: string;
      principal: number;
      apy: number;
      durationDays: number;
    }) => {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/staking/start`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          asset,
          principal,
          apy,
          duration_days: durationDays,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to start staking');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staking', variables.workspaceId] });
    },
  });
}
