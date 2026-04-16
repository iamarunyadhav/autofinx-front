import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function usePayout(payoutId?: string) {
  return useQuery({
    queryKey: ['payout', payoutId],
    queryFn: async () => {
      if (!payoutId) return null;
      const res = await fetch(`${API_BASE}/payouts/${payoutId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load payout');
      return res.json();
    },
    enabled: !!payoutId,
    refetchInterval: 10000,
  });
}

export function useRetryPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payoutId: string) => {
      const res = await fetch(`${API_BASE}/payouts/${payoutId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to retry payout');
      return res.json();
    },
    onSuccess: (_, payoutId) => {
      queryClient.invalidateQueries({ queryKey: ['payout', payoutId] });
    },
  });
}
