import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { authHeaders } from '@/lib/auth';

type ExchangeConnection = Database['public']['Tables']['exchange_connections']['Row'];

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function useConnections(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['connections', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/connections`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load connections');
      return res.json() as Promise<ExchangeConnection[]>;
    },
    enabled: !!workspaceId,
  });
}

interface CreateConnectionParams {
  workspace_id: string;
  name: string;
  provider: string;
  api_key: string;
  api_secret: string;
  passphrase?: string;
  is_testnet?: boolean;
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: CreateConnectionParams) => {
      const res = await fetch(`${API_BASE}/workspaces/${params.workspace_id}/connections`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          name: params.name,
          provider: params.provider,
          api_key: params.api_key,
          api_secret: params.api_secret,
          passphrase: params.passphrase,
          is_testnet: params.is_testnet ?? false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create connection');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['connections', variables.workspace_id] });
      toast({
        title: 'Connection Created',
        description: 'Exchange connection has been added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      workspaceId, 
      ...updates 
    }: { 
      id: string; 
      workspaceId: string; 
      name?: string;
      is_enabled?: boolean;
      is_testnet?: boolean;
      api_key?: string;
      api_secret?: string;
      passphrase?: string;
    }) => {
      const res = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update connection');
      }
      const data = await res.json();
      return { data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connections', result.workspaceId] });
      toast({
        title: 'Connection Updated',
        description: 'Exchange connection has been updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const res = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to delete');
      }
      return { workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connections', result.workspaceId] });
      toast({
        title: 'Connection Deleted',
        description: 'Exchange connection has been removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRotateConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const res = await fetch(`${API_BASE}/connections/${id}/rotate`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Rotate failed');
      }
      const data = await res.json();
      return { data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connections', result.workspaceId] });
      toast({ title: 'Secrets rotated', description: 'API keys were re-encrypted in the vault.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Rotate failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useTestConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      const res = await fetch(`${API_BASE}/connections/${connectionId}/test`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Connection test failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Connection Successful',
        description: 'Exchange API credentials are valid',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

interface SyncResult {
  success: boolean;
  balances: Array<{
    currency: string;
    available: number;
    locked: number;
    total: number;
  }>;
  syncedAt: string;
}

export function useSyncConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ connectionId, workspaceId }: { connectionId: string; workspaceId: string }) => {
      const { data, error } = await supabase.functions.invoke<SyncResult>('sync-connection', {
        body: { connectionId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Sync failed');
      
      return { ...data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connections', result.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      toast({
        title: 'Sync Complete',
        description: `Retrieved ${result.balances.length} balances from exchange`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
