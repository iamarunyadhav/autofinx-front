import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface JobQueueRow {
  name: string;
  priority: number;
  purpose: string;
  pending: number;
  reserved: number;
  delayed: number;
  failed: number;
  runtime_size?: number | null;
  state: string;
}

export interface PendingJob {
  id: string;
  queue: string;
  attempts: number;
  reserved: boolean;
  available_at?: string | null;
  created_at?: string | null;
  age_seconds?: number | null;
  prunable?: boolean;
  prune_reason?: string | null;
  uuid?: string | null;
  job: string;
  display_name: string;
  max_tries?: number | null;
}

export interface FailedJob {
  id: string;
  uuid: string;
  connection: string;
  queue: string;
  failed_at?: string | null;
  exception: string;
  job: string;
  display_name: string;
  max_tries?: number | null;
}

export interface SchedulerRun {
  id: string;
  command: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
}

export interface JobsDashboard {
  state: string;
  connection: string;
  driver: string;
  backlog: number;
  failed: number;
  warning_threshold: number;
  block_threshold: number;
  protected_queues: string[];
  horizon: {
    installed: boolean;
    enabled: boolean;
    dashboard_url: string;
  };
  redis_ready: {
    configured: boolean;
    queue_connection: string;
    redis_client?: string | null;
  };
  worker: {
    restart_signal_available: boolean;
    recommended_command: string;
    topology: string;
    supervisor_command: string;
    horizon_command: string;
    profiles: Array<{
      key: string;
      label: string;
      purpose: string;
      queues: string[];
      command: string;
    }>;
  };
  queues: JobQueueRow[];
  pending_jobs: PendingJob[];
  failed_jobs: FailedJob[];
  stale_prune: {
    enabled: boolean;
    older_than_minutes: number;
    max_delete: number;
    safe_queues: string[];
    safe_job_classes: string[];
    candidates: {
      older_than_minutes: number;
      prunable_total: number;
      sample: Array<{
        id: string;
        queue: string;
        display_name: string;
        age_seconds: number;
        prunable: boolean;
        prune_reason: string;
      }>;
    };
  };
  scheduler_runs: SchedulerRun[];
  recommendations: string[];
  /** N2 -- `predictions` queue worker latency (App\Domain\Ops\PredictionQueueLatencyMetrics::summary()).
   * Optional so an older backend without the key still renders the page. */
  prediction_worker_latency?: PredictionWorkerLatency;
  generated_at: string;
}

export interface LatencyPercentiles {
  /** Null when there is no data in the window -- never a fabricated 0. */
  p50: number | null;
  p95: number | null;
  max: number | null;
  n: number;
}

export interface PredictionWorkerLatency {
  queue: string;
  window_seconds: number;
  max_samples: number;
  validity_seconds: number;
  available: boolean;
  reason?: string;
  samples?: number;
  published?: number;
  dropped_total?: number;
  dropped_expired_before_compute?: number;
  dropped_expired_after_compute?: number;
  drop_rate_pct?: number | null;
  queue_wait_ms?: LatencyPercentiles;
  compute_ms?: LatencyPercentiles;
  oldest_sample_at?: string | null;
  newest_sample_at?: string | null;
}

export function useJobsDashboard() {
  return useQuery({
    queryKey: ["jobs-dashboard"],
    queryFn: () => authorizedFetch("/jobs/dashboard?limit=40") as Promise<JobsDashboard>,
    refetchInterval: 5000,
  });
}

function useJobAction(action: string, successTitle: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload?: Record<string, unknown>) => authorizedFetch(action, "POST", payload),
    onSuccess: (data: any) => {
      toast({ title: successTitle, description: data?.message || "Queue dashboard refreshed." });
      queryClient.invalidateQueries({ queryKey: ["jobs-dashboard"] });
    },
    onError: (error) => {
      toast({
        title: "Job action failed",
        description: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    },
  });
}

export function useRestartWorkers() {
  return useJobAction("/jobs/restart-workers", "Queue restart signal sent");
}

export function useRetryFailedJob() {
  return useJobAction("/jobs/failed/retry", "Failed job retry queued");
}

export function useForgetFailedJob() {
  return useJobAction("/jobs/failed/forget", "Failed job forgotten");
}

export function useClearPendingQueue() {
  return useJobAction("/jobs/pending/clear", "Pending queue cleared");
}

export function usePruneStalePendingJobs() {
  return useJobAction("/jobs/pending/prune-stale", "Stale safe jobs pruned");
}
