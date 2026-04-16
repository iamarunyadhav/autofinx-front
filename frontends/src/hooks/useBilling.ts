import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/billing/plans`);
      if (!res.ok) throw new Error('Failed to load plans');
      return res.json();
    },
  });
}

export function useSubscription(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await fetch(`${API_BASE}/billing/invoices?workspace_id=${workspaceId}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load invoices');
      const invoices = await res.json();
      const latest = invoices?.[0] || null;
      return latest
        ? {
            plan_id: latest.metadata?.plan ?? null,
            status: latest.status ?? 'paid',
            amount: latest.amount,
            currency: latest.currency || 'USD',
            current_period_end: latest.due_date,
            invoice: latest,
          }
        : null;
    },
    enabled: !!workspaceId,
  });
}

export function useInvoices(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`${API_BASE}/billing/invoices?workspace_id=${workspaceId}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load invoices');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

export function useSubscribePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workspaceId, planId }: { workspaceId: string; planId: string }) => {
      const res = await fetch(`${API_BASE}/billing/subscribe`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ workspace_id: workspaceId, plan_id: planId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Subscribe failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Subscribed', description: 'Subscription updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Subscribe failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      const res = await fetch(`${API_BASE}/billing/cancel`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Cancel failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: 'Subscription canceled' });
    },
    onError: (error: any) => {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
    },
  });
}
