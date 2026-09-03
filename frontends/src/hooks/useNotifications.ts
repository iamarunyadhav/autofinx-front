import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/auth';

// Was previously aliased from the auto-generated (and since-stale) Supabase
// Database type, which described a much richer notifications shape
// (title/body/channel/severity/action_url/is_read/metadata) that does not
// exist in the real Laravel schema. NotificationController::index() returns
// a raw Eloquent dump of the `notifications` table (see
// database/migrations/2025_12_31_114501_create_domain_tables.php): just
// id/workspace_id/user_id/type/content(json)/read_at/created_at/updated_at
// — the title/body/etc. fields consumers want live inside the `content` JSON
// blob, not as top-level columns.
export interface Notification {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  type: string;
  content: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  preferences: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export function useNotifications(workspaceId: string | undefined, unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', workspaceId, unreadOnly],
    queryFn: async () => {
      if (!workspaceId) return [];
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        unread_only: String(unreadOnly),
        limit: '50',
      });
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/notifications?${params.toString()}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      return data.notifications as Notification[];
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useUnreadCount(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['unread-count', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const params = new URLSearchParams({
        workspace_id: workspaceId,
      });
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/notifications/unread-count?${params.toString()}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load unread count');
      const data = await res.json();
      return data.count as number;
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useNotificationSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const data = await callEdgeFunction<{ settings: NotificationSettings | null }>('notifications', {
        action: 'get_settings',
      });
      return data.settings;
    },
    enabled,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/notifications/mark-read`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: notificationIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      toast({
        title: 'All Caught Up',
        description: 'All notifications marked as read',
      });
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (preferences: Record<string, any>) => {
      const data = await callEdgeFunction<{ settings: NotificationSettings }>('notifications', {
        action: 'update_settings',
        preferences,
      });
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: 'Settings Saved',
        description: 'Notification preferences updated',
      });
    },
  });
}
