import { useCallback, useEffect, useState } from 'react';
import { authHeaders, getAuthToken } from '@/lib/auth';
import { initializeApiBase } from '@/lib/api-base';

// Keeps the workspace load from hanging indefinitely on a slow/dead origin —
// callers (ModuleRoute) show a loading state while `loading` is true, so an
// unbounded hang here would block route content forever.
const WORKSPACES_TIMEOUT_MS = 12000;

interface Workspace {
  id: string;
  name: string;
  timezone?: string;
}

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WORKSPACES_TIMEOUT_MS);
      try {
        // Awaits the same shared API-base readiness signal every other
        // API-calling module uses (see lib/api-base.ts) instead of reading
        // import.meta.env.VITE_API_BASE_URL directly, so workspace loads
        // never resolve against a different origin than the rest of the app.
        const base = await initializeApiBase();
        const headers = await authHeaders();
        const res = await fetch(`${base}/workspaces`, { headers, signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load workspaces');
        const data = await res.json();
        setWorkspaces(data || []);
        setCurrentWorkspace((prev) => prev || data?.[0] || null);
      } catch {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setError(true);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    loading,
    error,
    retry: load,
  };
}
