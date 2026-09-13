import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/auth';

// Mirrors ServerConnectionController::present() exactly (app/Http/Controllers/
// Api/ServerConnectionController.php) -- the credential is NEVER returned by
// the API, so there is intentionally no field for it here.
export type ServerConnectionStatus =
  | 'unknown'
  | 'connected'
  | 'disconnected'
  | 'degraded'
  | 'unauthorized'
  | 'not_configured';

export type ServerAuthMethod = 'key' | 'password';

export interface ServerConnection {
  id: string;
  workspace_id: string;
  name: string;
  host: string;
  port: number;
  ssh_username: string;
  auth_method: ServerAuthMethod;
  status: ServerConnectionStatus;
  last_checked_at: string | null;
  last_check_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function useServerConnections(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['server-connections', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/server-connections`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load server connections');
      return res.json() as Promise<ServerConnection[]>;
    },
    enabled: !!workspaceId,
  });
}

interface CreateServerConnectionParams {
  workspace_id: string;
  name: string;
  host: string;
  port?: number;
  ssh_username: string;
  auth_method: ServerAuthMethod;
  credential: string;
}

export function useCreateServerConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: CreateServerConnectionParams) => {
      const res = await fetch(`${API_BASE}/workspaces/${params.workspace_id}/server-connections`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          name: params.name,
          host: params.host,
          port: params.port,
          ssh_username: params.ssh_username,
          auth_method: params.auth_method,
          credential: params.credential,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create server connection');
      }
      return res.json() as Promise<ServerConnection>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['server-connections', variables.workspace_id] });
      toast({ title: 'Server connection added', description: 'Diagnostic SSH connection saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add server connection', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteServerConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const res = await fetch(`${API_BASE}/server-connections/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to delete server connection');
      }
      return { workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['server-connections', result.workspaceId] });
      toast({ title: 'Server connection deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useTestServerConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const res = await fetch(`${API_BASE}/server-connections/${id}/test`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Connection test failed');
      }
      return { data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['server-connections', result.workspaceId] });
      toast({
        title: 'Connection test complete',
        description: `Status: ${String(result.data?.status ?? 'unknown')}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Connection test failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useServerConnectionChecks(connectionId: string | null) {
  return useQuery({
    queryKey: ['server-connection-checks', connectionId],
    queryFn: async () => {
      if (!connectionId) return [] as string[];
      const res = await fetch(`${API_BASE}/server-connections/${connectionId}/checks`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load available diagnostic checks');
      const data = (await res.json()) as { checks: string[] };
      return data.checks ?? [];
    },
    enabled: !!connectionId,
  });
}

export function useRunServerCheck() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      workspaceId,
      checkKey,
    }: {
      id: string;
      workspaceId: string;
      checkKey: string;
    }) => {
      const res = await fetch(`${API_BASE}/server-connections/${id}/run-check`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ check_key: checkKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Diagnostic check failed');
      }
      return { data, workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['server-connections', result.workspaceId] });
      toast({ title: 'Diagnostic check complete' });
    },
    onError: (error: Error) => {
      toast({ title: 'Diagnostic check failed', description: error.message, variant: 'destructive' });
    },
  });
}
