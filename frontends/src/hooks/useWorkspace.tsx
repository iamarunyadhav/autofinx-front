import { useEffect, useState } from 'react';
import { authHeaders, getAuthToken } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

interface Workspace {
  id: string;
  name: string;
  timezone?: string;
}

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/workspaces`, { headers });
        if (!res.ok) throw new Error('Failed to load workspaces');
        const data = await res.json();
        setWorkspaces(data || []);
        setCurrentWorkspace((prev) => prev || data?.[0] || null);
      } catch {
        setWorkspaces([]);
        setCurrentWorkspace(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    loading,
  };
}
