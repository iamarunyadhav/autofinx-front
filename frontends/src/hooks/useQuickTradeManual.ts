import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import type { ManualClosePreview, ManualPosition, ManualPreview, ManualStatus } from "@/lib/manualTrade";

/**
 * Data hooks for Quick Trade "Manual SL/TP". Positions are server-side objects: these hooks only READ and ASK.
 * Closing the tab, refreshing or changing the chart timeframe changes nothing about a position; protection lives
 * on the exchange and the backend reconciler owns state. Polling is for display freshness only.
 */

const base = (workspaceId: string) => `/workspaces/${workspaceId}/quick-trade-manual`;

export function useManualStatus(workspaceId?: string) {
  return useQuery({
    queryKey: ["qtm-status", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => authorizedFetch(`${base(workspaceId!)}/status`) as Promise<ManualStatus>,
    staleTime: 15_000,
  });
}

export function useManualExchangeBalance(workspaceId: string | undefined, integrationId: string | undefined) {
  return useQuery({
    queryKey: ["qtm-exchange-balance", workspaceId, integrationId],
    enabled: Boolean(workspaceId && integrationId),
    queryFn: () => authorizedFetch(`/workspaces/${workspaceId!}/wallet/exchange-balance?asset=USDT&integration_id=${encodeURIComponent(integrationId!)}`) as Promise<{ available: number | null; balance?: number | null; error?: string | null; environment?: string | null }>,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useSetManualEnabled(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => authorizedFetch(`${base(workspaceId!)}/enabled`, "PUT", { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qtm-status", workspaceId] }),
  });
}

export function useManualPreview(workspaceId?: string) {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authorizedFetch(`${base(workspaceId!)}/preview`, "POST", body) as Promise<ManualPreview>,
  });
}

export function useOpenManualPosition(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authorizedFetch(`${base(workspaceId!)}/positions`, "POST", body) as Promise<ManualPosition>,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["qtm-positions", workspaceId] });
      qc.invalidateQueries({ queryKey: ["balances", workspaceId] });
    },
  });
}

export function useManualPositions(workspaceId: string | undefined, scope: "active" | "history") {
  return useQuery({
    queryKey: ["qtm-positions", workspaceId, scope],
    enabled: Boolean(workspaceId),
    queryFn: async () => ((await authorizedFetch(`${base(workspaceId!)}/positions?scope=${scope}&limit=50`)) as { positions: ManualPosition[] }).positions,
    refetchInterval: scope === "active" ? 6_000 : 30_000,
  });
}

export function useManualPosition(workspaceId: string | undefined, positionId: string | null) {
  return useQuery({
    queryKey: ["qtm-position", workspaceId, positionId],
    enabled: Boolean(workspaceId && positionId),
    queryFn: () => authorizedFetch(`${base(workspaceId!)}/positions/${positionId}`) as Promise<ManualPosition>,
    refetchInterval: 5_000,
  });
}

export function useRefreshManualPosition(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positionId: string) => authorizedFetch(`${base(workspaceId!)}/positions/${positionId}/refresh`, "POST") as Promise<ManualPosition>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qtm-positions", workspaceId] });
      qc.invalidateQueries({ queryKey: ["qtm-position", workspaceId] });
    },
  });
}

export function useManualClosePreview(workspaceId?: string) {
  return useMutation({
    mutationFn: (positionId: string) => authorizedFetch(`${base(workspaceId!)}/positions/${positionId}/close-preview`, "POST") as Promise<ManualClosePreview>,
  });
}

export function useCloseManualPosition(workspaceId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positionId: string) => authorizedFetch(`${base(workspaceId!)}/positions/${positionId}/close`, "POST") as Promise<ManualPosition>,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["qtm-positions", workspaceId] });
      qc.invalidateQueries({ queryKey: ["qtm-position", workspaceId] });
      qc.invalidateQueries({ queryKey: ["balances", workspaceId] });
    },
  });
}
