import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { QuickTradeRecord } from "@/hooks/useQuickTrade";

export interface RobotSessionRecord {
  id: string;
  workspace_id: string;
  wallet_account_id?: string | null;
  risk_profile_id?: string | null;
  name: string;
  symbol: string;
  asset_class: string;
  timeframe: string;
  expiry_seconds: number;
  indicator_set: string[];
  strategy_profile: string;
  base_stake: number;
  profit_target?: number | null;
  loss_limit?: number | null;
  max_consecutive_losses?: number | null;
  max_active_trades: number;
  confidence_threshold: number;
  mode: string;
  provider_key?: string | null;
  integration_id?: string | null;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  total_pnl: number;
  win_count: number;
  loss_count: number;
  consecutive_losses: number;
  last_signal_at?: string | null;
  last_trade_at?: string | null;
  last_error?: string | null;
  runtime_json?: Record<string, unknown> | null;
  bot_mode?: "candle_direction" | "timed_expiry";
  stop_loss_pct?: number;
  take_profit_pct?: number | null;
  multi_symbol?: boolean;
  symbol_list?: string[] | null;
  peak_profit?: number;
  active_side?: "BUY" | "SELL" | null;
  active_entry_price?: number | null;
  active_since?: string | null;
}

export interface RobotLivePosition {
  side: "BUY" | "SELL";
  entry_price: number;
  current_price: number;
  stake: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  peak_excursion: number;
  peak_pct: number;
  stop_price: number;
  active_since?: string | null;
  seconds_in_trade: number;
}

export interface RobotLiveStats {
  session_id: string;
  status: RobotSessionRecord["status"];
  symbol: string;
  timeframe: string;
  bot_mode: string;
  current_price: number;
  position: RobotLivePosition | null;
  performance: {
    total_pnl: number;
    win_count: number;
    loss_count: number;
    win_rate: number;
  };
  last_decision?: { action?: string; reason?: string; confidence?: number } | null;
  as_of: string;
}

interface SessionStatusPayload {
  session: RobotSessionRecord;
  active_trades: number;
  recent_trades: QuickTradeRecord[];
}

type SessionPayload = {
  name: string;
  wallet_account_id?: string;
  risk_profile_id?: string;
  symbol: string;
  timeframe: string;
  expiry_seconds: number;
  indicator_set: string[];
  strategy_profile: string;
  base_stake: number;
  profit_target?: number | null;
  loss_limit?: number | null;
  max_consecutive_losses?: number | null;
  max_active_trades?: number;
  confidence_threshold?: number;
  provider?: string;
  integration_id?: string;
  bot_mode?: "candle_direction" | "timed_expiry";
  stop_loss_pct?: number;
  take_profit_pct?: number | null;
  multi_symbol?: boolean;
  symbol_list?: string[];
};

export function useRobotSessions(workspaceId?: string) {
  return useQuery({
    queryKey: ["robot-sessions", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return authorizedFetch(`/workspaces/${workspaceId}/robot-sessions`) as Promise<RobotSessionRecord[]>;
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

export function useRobotSessionStatus(sessionId?: string) {
  return useQuery({
    queryKey: ["robot-session-status", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      return authorizedFetch(`/robot-sessions/${sessionId}/status`) as Promise<SessionStatusPayload>;
    },
    enabled: !!sessionId,
    refetchInterval: 4000,
  });
}

export function useRobotLiveStats(sessionId?: string, enabled = true) {
  return useQuery({
    queryKey: ["robot-session-live-stats", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      return authorizedFetch(`/robot-sessions/${sessionId}/live-stats`) as Promise<RobotLiveStats>;
    },
    enabled: !!sessionId && enabled,
    refetchInterval: 1000,
  });
}

export function useForceCloseSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionId: string) =>
      authorizedFetch(`/robot-sessions/${sessionId}/force-close`, "POST") as Promise<unknown>,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["robot-session-live-stats", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["robot-session-status", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["robot-sessions"] });
      toast({ title: "Position closed" });
    },
    onError: (error: Error) => {
      toast({ title: "Force close failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useCreateRobotSession(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: SessionPayload) => {
      if (!workspaceId) throw new Error("Workspace required");
      return authorizedFetch(`/workspaces/${workspaceId}/robot-sessions`, "POST", payload) as Promise<RobotSessionRecord>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robot-sessions", workspaceId] });
      toast({ title: "Robot session saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Robot session failed", description: error.message, variant: "destructive" });
    },
  });
}

function useSessionAction(action: "start" | "pause" | "stop" | "evaluate", successTitle: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionId: string) => authorizedFetch(`/robot-sessions/${sessionId}/${action}`, "POST") as Promise<unknown>,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["robot-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["robot-session-status", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-active"] });
      queryClient.invalidateQueries({ queryKey: ["quick-trade-history"] });
      toast({ title: successTitle });
    },
    onError: (error: Error) => {
      toast({ title: "Robot action failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useStartRobotSession() {
  return useSessionAction("start", "Robot started");
}

export function usePauseRobotSession() {
  return useSessionAction("pause", "Robot paused");
}

export function useStopRobotSession() {
  return useSessionAction("stop", "Robot stopped");
}

export function useEvaluateRobotSession() {
  return useSessionAction("evaluate", "Robot cycle evaluated");
}
