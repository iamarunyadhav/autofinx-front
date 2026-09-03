import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface OpsSchedulerRun {
  id: string;
  command: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  status: string;
}

export interface OpsProviderHealth {
  webhooks?: Array<Record<string, any>>;
  ticks?: {
    last_tick_at?: string | null;
    symbol_id?: string | null;
    stale?: boolean;
  };
  breakers?: Record<string, any>;
  binance_connections?: Array<Record<string, any>>;
}

export interface OpsDeploymentReadiness {
  workspace_id: string;
  environment: string;
  state: string;
  deployment_ready: boolean;
  live_enabled: boolean;
  live_mode: string;
  blockers: string[];
  warnings: string[];
  summary?: string;
  details?: Record<string, any>;
}

export interface OpsLiveReadiness {
  workspace_id: string;
  state: string;
  live_allowed: boolean;
  deployment_ready: boolean;
  environment: string;
  blocked_live: boolean;
  blockers: string[];
  warnings: string[];
  reason_codes: string[];
  summary: string;
  suggested_actions: string[];
  checklist?: Array<Record<string, any>>;
  deployment: OpsDeploymentReadiness;
  health: Record<string, any>;
}

export interface OpsHealthSummary {
  workspace_id: string;
  state: string;
  severity: string;
  blocked: boolean;
  healthy: boolean;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  counts?: Record<string, any>;
  checks?: Record<string, any>;
  source_health?: Record<string, any>;
  generated_at?: string;
}

export interface OpsReadinessSnapshot {
  id: string;
  workspace_id: string;
  scope: string;
  environment: string;
  state: string;
  severity: string;
  summary?: string | null;
  reason_codes_json?: string[] | null;
  warning_codes_json?: string[] | null;
  blocker_codes_json?: string[] | null;
  details_json?: Record<string, any> | null;
  health_json?: Record<string, any> | null;
  checked_at?: string | null;
}

export interface OpsIncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_type?: string | null;
  message?: string | null;
  metadata_json?: Record<string, any> | null;
  created_at?: string | null;
}

export interface OpsIncidentAction {
  id: string;
  incident_id: string;
  action_key: string;
  status: string;
  actor_id?: string | null;
  actor_type?: string | null;
  message?: string | null;
  reason?: string | null;
  metadata_json?: Record<string, any> | null;
  executed_at?: string | null;
  created_at?: string | null;
}

export interface OpsRunbook {
  id: string;
  key: string;
  title: string;
  category: string;
  severity: string;
  audience?: string;
  summary?: string | null;
  steps_json: string[];
  automation_notes?: string | null;
  is_active: boolean;
  is_builtin: boolean;
}

export interface OpsTrendSnapshot {
  id: string;
  workspace_id?: string | null;
  scope?: string | null;
  state: string;
  severity: string;
  window_days?: number | null;
  summary?: string | null;
  metrics_json?: Record<string, any> | null;
  evidence_json?: Record<string, any> | null;
  observed_at?: string | null;
}

export interface OpsTrendSummary {
  workspace_id: string;
  current?: OpsTrendSnapshot | Record<string, any>;
  previous?: OpsTrendSnapshot | Record<string, any> | null;
  changes?: Record<string, any>;
  history?: OpsTrendSnapshot[];
}

export interface OpsDriftDetection {
  id: string;
  metric_key: string;
  state: string;
  severity: string;
  status: string;
  summary?: string | null;
  details_json?: Record<string, any> | null;
  evidence_json?: Record<string, any> | null;
  detected_at?: string | null;
  last_seen_at?: string | null;
  resolved_at?: string | null;
}

export interface OpsMaintenanceConfidence {
  workspace_id: string;
  state: string;
  confidence_score: number;
  confidence_in_recovery?: number;
  summary?: string | null;
  rationale?: string[];
  evidence?: Record<string, any>;
}

export interface OpsRecoveryDrill {
  id: string;
  scenario_key: string;
  scenario_name: string;
  environment: string;
  status: string;
  summary?: string | null;
  actions_json?: string[];
  findings_json?: Record<string, any> | null;
  recommendations_json?: string[] | null;
  evidence_json?: Record<string, any> | null;
  blocked_reason?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface OpsChaosSimulation {
  id: string;
  scenario_key: string;
  scenario_name: string;
  environment: string;
  status: string;
  summary?: string | null;
  expected_behavior_json?: Record<string, any> | null;
  actual_behavior_json?: Record<string, any> | null;
  findings_json?: Record<string, any> | null;
  evidence_json?: Record<string, any> | null;
  blocked_reason?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface OpsReleaseRecord {
  id: string;
  release_key: string;
  version: string;
  environment: string;
  status: string;
  summary?: string | null;
  change_summary_json?: Record<string, any> | null;
  metadata_json?: Record<string, any> | null;
  blocked_reason?: string | null;
  released_at?: string | null;
  verified_at?: string | null;
  rolled_back_at?: string | null;
}

export interface OpsRollbackRecord {
  id: string;
  rollback_key: string;
  status: string;
  reason?: string | null;
  summary?: string | null;
  blocked_reason?: string | null;
  details_json?: Record<string, any> | null;
  evidence_json?: Record<string, any> | null;
  requested_at?: string | null;
  executed_at?: string | null;
  verified_at?: string | null;
}

export interface OpsPostIncidentReview {
  id: string;
  incident_id: string;
  workspace_id?: string | null;
  reviewed_at?: string | null;
  root_cause_hypothesis?: string | null;
  contributing_factors_json?: Record<string, any>[] | null;
  detection_summary?: string | null;
  mitigation_summary?: string | null;
  lessons_learned?: string | null;
  follow_up_actions_json?: Record<string, any>[] | null;
  evidence_json?: Record<string, any>[] | null;
}

export interface OpsIncident {
  id: string;
  workspace_id?: string | null;
  incident_key: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  summary?: string | null;
  runbook_key?: string | null;
  detection_source?: string | null;
  block_live: boolean;
  affected_entities_json?: Record<string, any> | null;
  context_json?: Record<string, any> | null;
  detected_at?: string | null;
  acknowledged_at?: string | null;
  mitigated_at?: string | null;
  resolved_at?: string | null;
  last_activity_at?: string | null;
  resolution_summary?: string | null;
  runbook?: OpsRunbook | null;
  events?: OpsIncidentEvent[];
  actions?: OpsIncidentAction[];
}

export function useOpsSchedulerRuns() {
  return useQuery({
    queryKey: ['ops-scheduler-runs'],
    queryFn: async () => {
      const data = await authorizedFetch('/ops/scheduler-runs');
      return (data?.runs ?? []) as OpsSchedulerRun[];
    },
    refetchInterval: 15000,
  });
}

export function useOpsProviderHealth() {
  return useQuery({
    queryKey: ['ops-provider-health'],
    queryFn: async () => {
      return authorizedFetch('/ops/provider-health') as Promise<OpsProviderHealth>;
    },
    refetchInterval: 15000,
  });
}

export function useOpsReadiness(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-readiness', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/readiness`) as Promise<OpsLiveReadiness>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useOpsDeploymentReadiness(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-deployment-readiness', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/deployment-readiness`) as Promise<OpsDeploymentReadiness>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useOpsHealth(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-health', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/health`) as Promise<OpsHealthSummary>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useOpsReadinessHistory(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-readiness-history', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/ops/readiness/history?limit=15`);
      return (data?.snapshots ?? []) as OpsReadinessSnapshot[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useOpsIncidents(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-incidents', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/ops/incidents?limit=50`);
      return (data?.incidents ?? []) as OpsIncident[];
    },
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });
}

export function useOpsIncident(workspaceId: string | undefined, incidentId: string | undefined) {
  return useQuery({
    queryKey: ['ops-incident', workspaceId, incidentId],
    queryFn: async () => {
      if (!workspaceId || !incidentId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/incidents/${incidentId}`) as Promise<OpsIncident>;
    },
    enabled: !!workspaceId && !!incidentId,
    refetchInterval: 15000,
  });
}

export function useOpsRunbooks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-runbooks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/ops/runbooks`);
      return (data?.runbooks ?? []) as OpsRunbook[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useOpsRunbook(workspaceId: string | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ['ops-runbook', workspaceId, key],
    queryFn: async () => {
      if (!workspaceId || !key) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/runbooks/${encodeURIComponent(key)}`) as Promise<OpsRunbook>;
    },
    enabled: !!workspaceId && !!key,
  });
}

export function useOpsTrends(workspaceId: string | undefined, windowDays = 7) {
  return useQuery({
    queryKey: ['ops-trends', workspaceId, windowDays],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/trends?window_days=${windowDays}`) as Promise<OpsTrendSummary>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useOpsDriftDetections(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-drift-detections', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { current: [], history: [] } as { current: OpsDriftDetection[]; history: OpsDriftDetection[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/drift-detections`) as Promise<{ current: OpsDriftDetection[]; history: OpsDriftDetection[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useOpsMaintenanceConfidence(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-maintenance-confidence', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return authorizedFetch(`/workspaces/${workspaceId}/ops/maintenance-confidence`) as Promise<{ current: OpsMaintenanceConfidence; history: { snapshots: OpsMaintenanceConfidence[] } }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useOpsDrillScenarios(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-drill-scenarios', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/ops/drill-scenarios`);
      return (data?.scenarios ?? []) as Record<string, any>[];
    },
    enabled: !!workspaceId,
  });
}

export function useOpsDrills(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-drills', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { drills: [], reviews: [] } as { drills: OpsRecoveryDrill[]; reviews: OpsPostIncidentReview[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/drills`) as Promise<{ drills: OpsRecoveryDrill[]; reviews: OpsPostIncidentReview[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useRunOpsDrill(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { scenario_key: string; allow_live?: boolean }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/drills/run`, 'POST', payload) as Promise<{ status: string; drill: OpsRecoveryDrill }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Recovery drill executed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Recovery drill failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useOpsChaosScenarios(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-chaos-scenarios', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await authorizedFetch(`/workspaces/${workspaceId}/ops/chaos-scenarios`);
      return (data?.scenarios ?? []) as Record<string, any>[];
    },
    enabled: !!workspaceId,
  });
}

export function useOpsChaosSimulations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-chaos-simulations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { simulations: [] } as { simulations: OpsChaosSimulation[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/chaos-simulations`) as Promise<{ simulations: OpsChaosSimulation[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useRunOpsChaosSimulation(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { scenario_key: string; acknowledged_risk?: boolean }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/chaos-simulations/run`, 'POST', payload) as Promise<{ status: string; simulation: OpsChaosSimulation }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Chaos simulation executed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Chaos simulation failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useOpsReleases(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-releases', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { releases: [] } as { releases: OpsReleaseRecord[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/releases`) as Promise<{ releases: OpsReleaseRecord[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useCreateOpsRelease(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/releases`, 'POST', payload) as Promise<{ release: OpsReleaseRecord }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Release record saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Release record failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useVerifyOpsRelease(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ releaseId, ...payload }: { releaseId: string; [key: string]: any }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/releases/${releaseId}/verify`, 'POST', payload) as Promise<{ release: OpsReleaseRecord }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Release verification saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Release verification failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useOpsRollbacks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-rollbacks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { rollbacks: [] } as { rollbacks: OpsRollbackRecord[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/rollbacks`) as Promise<{ rollbacks: OpsRollbackRecord[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useCreateOpsRollback(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/rollbacks`, 'POST', payload) as Promise<{ rollback: OpsRollbackRecord }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Rollback record saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Rollback record failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useOpsPostIncidentReviews(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ops-post-incident-reviews', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { reviews: [] } as { reviews: OpsPostIncidentReview[] };
      return authorizedFetch(`/workspaces/${workspaceId}/ops/post-incident-reviews`) as Promise<{ reviews: OpsPostIncidentReview[] }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

export function useCreatePostIncidentReview(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/post-incident-reviews`, 'POST', payload) as Promise<{ review: OpsPostIncidentReview }>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Post-incident review saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Post-incident review failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunOpsReadinessCheck(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/readiness/run`, 'POST', {}) as Promise<OpsLiveReadiness>;
    },
    onSuccess: () => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Readiness check completed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Readiness check failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunOpsAction(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { action_key: string; reason?: string; limit?: number; integration_id?: string; symbol?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/actions`, 'POST', payload) as Promise<{ result: Record<string, any> }>;
    },
    onSuccess: (_, variables) => {
      refreshOpsQueries(queryClient, workspaceId);
      toast({ title: 'Operational action executed', description: variables.action_key });
    },
    onError: (error: Error) => {
      toast({ title: 'Operational action failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAcknowledgeIncident(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ incidentId, note }: { incidentId: string; note?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/incidents/${incidentId}/acknowledge`, 'POST', {
        note: note || undefined,
      }) as Promise<{ incident: OpsIncident }>;
    },
    onSuccess: (_, variables) => {
      refreshOpsQueries(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: ['ops-incident', workspaceId, variables.incidentId] });
      toast({ title: 'Incident acknowledged' });
    },
    onError: (error: Error) => {
      toast({ title: 'Acknowledge failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useResolveIncident(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ incidentId, summary }: { incidentId: string; summary?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return authorizedFetch(`/workspaces/${workspaceId}/ops/incidents/${incidentId}/resolve`, 'POST', {
        summary: summary || undefined,
      }) as Promise<{ incident: OpsIncident }>;
    },
    onSuccess: (_, variables) => {
      refreshOpsQueries(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: ['ops-incident', workspaceId, variables.incidentId] });
      toast({ title: 'Incident resolved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Resolve failed', description: error.message, variant: 'destructive' });
    },
  });
}

function refreshOpsQueries(queryClient: ReturnType<typeof useQueryClient>, workspaceId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ['ops-readiness', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-deployment-readiness', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-health', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-readiness-history', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-trends', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-drift-detections', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-maintenance-confidence', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-drill-scenarios', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-drills', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-chaos-scenarios', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-chaos-simulations', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-releases', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-rollbacks', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-post-incident-reviews', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-incidents', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-runbooks', workspaceId] });
  queryClient.invalidateQueries({ queryKey: ['ops-scheduler-runs'] });
  queryClient.invalidateQueries({ queryKey: ['ops-provider-health'] });
}
