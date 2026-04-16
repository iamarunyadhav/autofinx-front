import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Tables']['payment_methods']['Row'];

export function usePaymentMethods(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['payment-methods', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!workspaceId,
  });
}

interface AddPaymentMethodInput {
  workspaceId: string;
  gateway: PaymentMethod['gateway'];
  token?: string;
  last_four?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  metadata?: Record<string, unknown>;
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AddPaymentMethodInput) => {
      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          workspace_id: input.workspaceId,
          gateway: input.gateway,
          token: input.token ?? null,
          last_four: input.last_four ?? null,
          brand: input.brand ?? null,
          expiry_month: input.expiry_month ?? null,
          expiry_year: input.expiry_year ?? null,
          metadata: input.metadata ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return { data, workspaceId: input.workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({
        title: 'Payment method added',
        description: 'Credentials saved securely in Supabase',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to save payment method',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      await supabase.from('payment_methods').update({ is_default: false }).eq('workspace_id', workspaceId);
      const { data, error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({ title: 'Default updated', description: 'Withdrawals will use this method unless overridden.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not update default',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) throw error;
      return { workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({ title: 'Payment method removed' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
