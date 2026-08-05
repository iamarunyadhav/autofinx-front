import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface FutureTradeAiDecisionRow {
  id: string;
  created_at: string | null;
  symbol: string;
  side: string;
  mode: string;
  decision: string;
  signal_confidence: number;
  pine_score: number;
  ai_confidence: number | null;
  size_multiplier: number | null;
  reasoning: string | null;
  risk_flags: string[];
  ai_model: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
  cache_hit: boolean;
  executed: boolean;
  block_reason: string | null;
  logical_trade_id: string | null;
  outcome: string | null;
  outcome_pnl: number | null;
  error: string | null;
}

export interface FutureTradeAiStats {
  window_days: number;
  total_decisions: number;
  confirmed: number;
  resized: number;
  vetoed: number;
  errors: number;
  skipped_cap: number;
  executed: number;
  confirmed_with_outcome: number;
  confirmed_win_rate: number | null;
  confirmed_net_pnl_usdt: number;
  avg_ai_confidence: number | null;
  avg_latency_ms: number | null;
  cache_hit_rate: number | null;
  total_cost_usd: number;
  today_cost_usd: number;
  calls_today: number;
  daily_call_cap: number;
}

export interface FutureTradeAiReviewRow {
  id: string;
  review_date: string | null;
  stats: Record<string, unknown> | null;
  report: {
    summary?: string;
    what_worked?: string[];
    what_failed?: string[];
    suggested_threshold_changes?: string[];
    confidence_calibration_note?: string;
  } | null;
  ai_model: string | null;
  cost_usd: number | null;
  error: string | null;
  created_at: string | null;
}

interface PaginatedDecisions {
  data: FutureTradeAiDecisionRow[];
  current_page: number;
  last_page: number;
  total: number;
}

export function useFutureTradeAiGate(workspaceId?: string) {
  const enabled = !!workspaceId;
  const base = `/workspaces/${workspaceId}/future-trade`;

  const decisions = useQuery({
    queryKey: ["future-trade", workspaceId, "ai-decisions"],
    queryFn: async () => (await api.get<PaginatedDecisions>(`${base}/ai-decisions?per_page=50`)).data,
    enabled,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const stats = useQuery({
    queryKey: ["future-trade", workspaceId, "ai-stats"],
    queryFn: async () => (await api.get<FutureTradeAiStats>(`${base}/ai-stats?days=30`)).data,
    enabled,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const reviews = useQuery({
    queryKey: ["future-trade", workspaceId, "ai-reviews"],
    queryFn: async () => (await api.get<{ data: FutureTradeAiReviewRow[] }>(`${base}/ai-reviews?limit=7`)).data.data,
    enabled,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  return { decisions, stats, reviews };
}
