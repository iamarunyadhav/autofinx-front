import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSystemSettings } from '@/hooks/useRisk';
import {
  useOpsSchedulerRuns,
  useOpsProviderHealth,
  useOpsReadiness,
  useOpsDeploymentReadiness,
  useOpsHealth,
  useOpsReadinessHistory,
  useOpsTrends,
  useOpsDriftDetections,
  useOpsMaintenanceConfidence,
  useOpsDrillScenarios,
  useOpsDrills,
  useOpsChaosScenarios,
  useOpsChaosSimulations,
  useOpsReleases,
  useOpsRollbacks,
  useOpsPostIncidentReviews,
  useOpsIncidents,
  useOpsIncident,
  useOpsRunbooks,
  useRunOpsReadinessCheck,
  useRunOpsAction,
  useAcknowledgeIncident,
  useResolveIncident,
  useRunOpsDrill,
  useRunOpsChaosSimulation,
  useCreateOpsRelease,
  useVerifyOpsRelease,
  useCreateOpsRollback,
  useCreatePostIncidentReview,
} from '@/hooks/useOperations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, PauseCircle, PlayCircle, RefreshCcw, ShieldAlert, ShieldCheck, Slash, Settings2, Terminal, Waves, Workflow, ArrowRight, ExternalLink } from 'lucide-react';

export default function OpsPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: systemSettings } = useSystemSettings(workspaceId);
  const { data: readiness, isLoading: readinessLoading } = useOpsReadiness(workspaceId);
  const { data: deployment, isLoading: deploymentLoading } = useOpsDeploymentReadiness(workspaceId);
  const { data: health, isLoading: healthLoading } = useOpsHealth(workspaceId);
  const { data: history = [] } = useOpsReadinessHistory(workspaceId);
  const { data: trends } = useOpsTrends(workspaceId);
  const { data: driftDetections } = useOpsDriftDetections(workspaceId);
  const { data: maintenanceConfidence } = useOpsMaintenanceConfidence(workspaceId);
  const { data: drillScenarios = [] } = useOpsDrillScenarios(workspaceId);
  const { data: drills = { drills: [], reviews: [] } } = useOpsDrills(workspaceId);
  const { data: chaosScenarios = [] } = useOpsChaosScenarios(workspaceId);
  const { data: chaosSimulations = { simulations: [] } } = useOpsChaosSimulations(workspaceId);
  const { data: releases = { releases: [] } } = useOpsReleases(workspaceId);
  const { data: rollbacks = { rollbacks: [] } } = useOpsRollbacks(workspaceId);
  const { data: postIncidentReviews = { reviews: [] } } = useOpsPostIncidentReviews(workspaceId);
  const { data: incidents = [], isLoading: incidentsLoading } = useOpsIncidents(workspaceId);
  const { data: runbooks = [] } = useOpsRunbooks(workspaceId);
  const { data: schedulerRuns = [] } = useOpsSchedulerRuns();
  const { data: providerHealth } = useOpsProviderHealth();
  const runDrill = useRunOpsDrill(workspaceId);
  const runChaosSimulation = useRunOpsChaosSimulation(workspaceId);
  const createRelease = useCreateOpsRelease(workspaceId);
  const verifyRelease = useVerifyOpsRelease(workspaceId);
  const createRollback = useCreateOpsRollback(workspaceId);
  const createPostIncidentReview = useCreatePostIncidentReview(workspaceId);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | undefined>();
  const [operatorNote, setOperatorNote] = useState('');
  const [reconcileLimit, setReconcileLimit] = useState('100');
  const [selectedDrillScenario, setSelectedDrillScenario] = useState('');
  const [selectedChaosScenario, setSelectedChaosScenario] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseSummary, setReleaseSummary] = useState('');
  const [releaseKey, setReleaseKey] = useState('');
  const [releaseEnvironment, setReleaseEnvironment] = useState('live');
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackSummary, setRollbackSummary] = useState('');
  const [rollbackKey, setRollbackKey] = useState('');
  const [reviewRootCause, setReviewRootCause] = useState('');
  const [reviewLessons, setReviewLessons] = useState('');

  const selectedIncident = useOpsIncident(workspaceId, selectedIncidentId);
  const selectedRunbook = useMemo(
    () => runbooks.find((runbook) => runbook.key === (selectedIncident.data?.runbook_key || selectedIncident.data?.runbook?.key)) || selectedIncident.data?.runbook || null,
    [runbooks, selectedIncident.data]
  );
  const readinessAction = useRunOpsReadinessCheck(workspaceId);
  const opsAction = useRunOpsAction(workspaceId);
  const ackIncident = useAcknowledgeIncident(workspaceId);
  const resolveIncident = useResolveIncident(workspaceId);

  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  const readinessState = readiness?.state || deployment?.state || 'not_ready';
  const environment = readiness?.environment || deployment?.environment || 'unknown';
  const openIncidents = incidents.filter((incident) => ['open', 'acknowledged', 'investigating'].includes(incident.status));
  const criticalIncidents = incidents.filter((incident) => incident.severity === 'critical');
  const blockers = readiness?.blockers || [];
  const warnings = readiness?.warnings || [];
  const healthState = health?.state || 'unknown';
  const liveReady = readinessState === 'restricted_live_ready';
  const killSwitchActive = Boolean(systemSettings?.kill_switch_active);
  const tradingEnabled = Boolean(systemSettings?.global_trading_enabled);
  const exchangeStale = Boolean(health?.checks?.market_data?.blockers?.includes('stale_market_data') || health?.checks?.market_data?.warnings?.includes('market_data_stale'));
  const maintenanceState = maintenanceConfidence?.current?.state || trends?.current?.state || 'unknown';
  const maintenanceScore = maintenanceConfidence?.current?.confidence_score ?? 0;
  const trendCurrent: any = trends?.current || {};
  const driftCurrent = driftDetections?.current || [];
  const driftHistory = driftDetections?.history || [];
  const drillHistory = drills?.drills || [];
  const releaseHistory = releases?.releases || [];
  const rollbackHistory = rollbacks?.rollbacks || [];
  const chaosHistory = chaosSimulations?.simulations || [];

  const runAction = async (action_key: string, payload: Record<string, any> = {}, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    await opsAction.mutateAsync({ action_key, reason: operatorNote.trim() || undefined, ...payload });
  };

  const handleAcknowledge = async () => {
    if (!selectedIncidentId) return;
    await ackIncident.mutateAsync({ incidentId: selectedIncidentId, note: operatorNote.trim() || undefined });
  };

  const handleResolve = async () => {
    if (!selectedIncidentId) return;
    await resolveIncident.mutateAsync({ incidentId: selectedIncidentId, summary: operatorNote.trim() || undefined });
  };

  const handleRunDrill = async () => {
    if (!selectedDrillScenario) return;
    await runDrill.mutateAsync({ scenario_key: selectedDrillScenario, allow_live: false });
  };

  const handleRunChaosSimulation = async () => {
    if (!selectedChaosScenario) return;
    await runChaosSimulation.mutateAsync({ scenario_key: selectedChaosScenario, acknowledged_risk: environment === 'live' });
  };

  const handleSaveRelease = async () => {
    await createRelease.mutateAsync({
      release_key: releaseKey || undefined,
      version: releaseVersion,
      environment: releaseEnvironment,
      summary: releaseSummary || undefined,
      status: 'planned',
      change_summary_json: {
        summary: releaseSummary || null,
      },
    });
  };

  const handleVerifyRelease = async (releaseId: string) => {
    await verifyRelease.mutateAsync({
      releaseId,
      status: 'verified',
      summary: 'Post-deploy verification captured.',
      checklist_json: [
        'Readiness re-evaluated',
        'Health summary reviewed',
      ],
    });
  };

  const handleSaveRollback = async () => {
    await createRollback.mutateAsync({
      rollback_key: rollbackKey || undefined,
      reason: rollbackReason || undefined,
      summary: rollbackSummary || undefined,
      status: 'planned',
    });
  };

  const handleSaveReview = async () => {
    if (!selectedIncidentId) return;
    await createPostIncidentReview.mutateAsync({
      incident_id: selectedIncidentId,
      root_cause_hypothesis: reviewRootCause || undefined,
      lessons_learned: reviewLessons || undefined,
      follow_up_actions_json: reviewLessons ? [{ item: reviewLessons }] : [],
    });
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Operator Control Center</h1>
                    <p className="text-muted-foreground">Readiness, incidents, runbooks, and safe actions for supervised live trading.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Workspace: {currentWorkspace?.name || currentWorkspace?.id || 'n/a'}</Badge>
                  <Badge className={statusTone(environment === 'live' ? 'critical' : environment === 'sandbox' ? 'warning' : 'neutral')}>ENV {String(environment).toUpperCase()}</Badge>
                  <Badge className={statusTone(readinessState === 'blocked' ? 'critical' : liveReady ? 'success' : readinessState === 'degraded' ? 'warning' : 'neutral')}>READINESS {readinessState}</Badge>
                  <Badge className={statusTone(healthState === 'blocked' ? 'critical' : healthState === 'degraded' ? 'warning' : 'neutral')}>HEALTH {healthState}</Badge>
                  <Badge className={statusTone(maintenanceState === 'insufficient_history' ? 'warning' : maintenanceState === 'high' ? 'success' : maintenanceState === 'low' || maintenanceState === 'very_low' ? 'critical' : 'neutral')}>CONFIDENCE {maintenanceState} {maintenanceScore ? `(${Math.round(maintenanceScore)})` : ''}</Badge>
                  <Badge className={statusTone(killSwitchActive ? 'critical' : 'success')}>KILL SWITCH {killSwitchActive ? 'ACTIVE' : 'CLEAR'}</Badge>
                  <Badge className={statusTone(tradingEnabled ? 'success' : 'critical')}>GLOBAL TRADING {tradingEnabled ? 'ON' : 'OFF'}</Badge>
                  <Badge className={statusTone(exchangeStale ? 'warning' : 'success')}>MARKET DATA {exchangeStale ? 'STALE' : 'FRESH'}</Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button onClick={() => readinessAction.mutate()} disabled={readinessAction.isPending || !workspaceId} className="gap-2">
                  {readinessAction.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Run readiness check
                </Button>
                <p className="text-right text-xs text-muted-foreground">Persistence + incident sync only. No guard bypass.</p>
              </div>
            </div>

            <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
              <CardContent className="py-4">
                {readinessLoading || deploymentLoading || healthLoading ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard title="Readiness" value={readinessState} detail={readiness?.summary || 'No summary'} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
                    <MetricCard title="Environment" value={String(environment).toUpperCase()} detail={deployment?.summary || 'Deployment classification active'} icon={<FlaskConical className="h-4 w-4 text-cyan-500" />} />
                    <MetricCard title="Open incidents" value={String(openIncidents.length)} detail={criticalIncidents.length > 0 ? `${criticalIncidents.length} critical` : 'No critical incidents'} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
                    <MetricCard title="Maintenance" value={String(maintenanceState)} detail={maintenanceConfidence?.current?.summary || trends?.current?.summary || 'Trend history pending'} icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} />
                    <MetricCard title="Queue / scheduler" value={`${String(health?.checks?.queue?.state ?? 'unknown')} / ${String(health?.checks?.scheduler?.state ?? 'unknown')}`} detail={health?.recommendations?.[0] || 'No queue or scheduler blockers'} icon={<Workflow className="h-4 w-4 text-emerald-500" />} />
                  </div>
                )}
              </CardContent>
            </Card>

            {(blockers.length > 0 || warnings.length > 0) && (
              <Alert variant={blockers.length > 0 ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{blockers.length > 0 ? 'Live blocked' : 'Operator caution'}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{readiness?.summary || 'No summary available.'}</p>
                  <div className="flex flex-wrap gap-2">
                    {blockers.map((item) => <Badge key={item} variant="outline" className="border-destructive/30 text-destructive">{item}</Badge>)}
                    {warnings.map((item) => <Badge key={item} variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-200">{item}</Badge>)}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Readiness Checklist</CardTitle>
                  <CardDescription>Backend truth from deployment, health, and readiness aggregation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(readiness?.checklist || []).length === 0 ? (
                    <Skeleton className="h-40 w-full" />
                  ) : readiness?.checklist?.map((check: any) => (
                    <div key={check.key} className="flex items-start justify-between gap-4 rounded-xl border p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{humanize(check.key)}</p>
                          <Badge className={statusTone(check.state === 'pass' ? 'success' : 'warning')}>{check.state}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{check.message}</p>
                        {check.action && <p className="text-xs text-muted-foreground">Next: {check.action}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Waves className="h-5 w-5" />Health Detail</CardTitle>
                  <CardDescription>Exchange, queue, scheduler, AI provider, and external context signals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniStat label="Exchange REST" value={String(health?.checks?.rest_health?.last_error ? 'degraded' : 'ok')} />
                    <MiniStat label="Open orders" value={String(health?.counts?.open_orders ?? 0)} />
                    <MiniStat label="Uncertain orders" value={String(health?.counts?.uncertain_orders ?? 0)} />
                    <MiniStat label="Critical incidents" value={String(health?.counts?.critical_incidents ?? 0)} />
                  </div>
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoPanel title="External context" lines={[
                      `State: ${String(health?.checks?.external_context?.state ?? 'unknown')}`,
                      `Snapshot: ${String(health?.checks?.external_context?.snapshot_state ?? 'n/a')}`,
                      `Latest: ${String(health?.checks?.external_context?.latest_snapshot_at ?? 'n/a')}`,
                    ]} />
                    <InfoPanel title="AI provider" lines={[
                      `Provider: ${String(health?.checks?.ai?.provider ?? 'n/a')}`,
                      `Provider ready: ${String(health?.checks?.ai?.provider_ready ?? false)}`,
                      `Failed cycles: ${String(health?.checks?.ai?.recent_failed_cycles ?? 0)}`,
                    ]} />
                    <InfoPanel title="Scheduler" lines={[
                      `State: ${String(health?.checks?.scheduler?.state ?? 'unknown')}`,
                      `Last run: ${String(health?.checks?.scheduler?.last_run_at ?? 'n/a')}`,
                      `Command: ${String(health?.checks?.scheduler?.last_command ?? 'n/a')}`,
                    ]} />
                    <InfoPanel title="Queue" lines={[
                      `State: ${String(health?.checks?.queue?.state ?? 'unknown')}`,
                      `Backlog: ${String(health?.counts?.queue_backlog ?? 0)}`,
                      `Failed jobs: ${String(health?.counts?.failed_jobs ?? 0)}`,
                    ]} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Readiness History</CardTitle>
                  <CardDescription>Persisted readiness snapshots and recovery transitions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No readiness history yet. Run the scheduled or manual check.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Time</TableHead><TableHead>State</TableHead><TableHead>Severity</TableHead><TableHead>Summary</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.slice(0, 8).map((snapshot) => (
                          <TableRow key={snapshot.id}>
                            <TableCell>{formatDate(snapshot.checked_at)}</TableCell>
                            <TableCell><Badge className={statusTone(snapshot.state === 'blocked' ? 'critical' : snapshot.state === 'degraded' ? 'warning' : 'neutral')}>{snapshot.state}</Badge></TableCell>
                            <TableCell>{snapshot.severity}</TableCell>
                            <TableCell className="max-w-[440px] truncate">{snapshot.summary || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">Last snapshot: {formatDate(history[0]?.checked_at)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />Safe Actions</CardTitle>
                  <CardDescription>Server-side authenticated and audit logged.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="operator-note">Operator note</Label>
                    <Textarea id="operator-note" value={operatorNote} onChange={(event) => setOperatorNote(event.target.value)} rows={3} placeholder="Optional reason / incident note" />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Button variant="secondary" onClick={() => runAction('pause_ai')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><PauseCircle className="h-4 w-4" />Pause AI</Button>
                    <Button variant="secondary" onClick={() => runAction('resume_ai')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><PlayCircle className="h-4 w-4" />Resume AI</Button>
                    <Button variant="outline" onClick={() => runAction('request_reconcile_sweep', { limit: Number.parseInt(reconcileLimit, 10) || 100 })} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><RefreshCcw className="h-4 w-4" />Reconcile sweep</Button>
                    <Button variant="outline" onClick={() => runAction('refresh_exchange_sync', { limit: Number.parseInt(reconcileLimit, 10) || 100 })} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><Workflow className="h-4 w-4" />Refresh sync</Button>
                    <Button variant="destructive" onClick={() => runAction('activate_kill_switch', {}, 'Activate the kill switch for this workspace?')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><Slash className="h-4 w-4" />Activate kill switch</Button>
                    <Button variant="secondary" onClick={() => runAction('deactivate_kill_switch', {}, 'Clear the kill switch for this workspace?')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><CheckCircle2 className="h-4 w-4" />Clear kill switch</Button>
                    <Button variant="outline" onClick={() => runAction('disable_external_context')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><ExternalLink className="h-4 w-4" />Disable external context</Button>
                    <Button variant="outline" onClick={() => runAction('enable_external_context')} disabled={opsAction.isPending || !workspaceId} className="justify-start gap-2"><ExternalLink className="h-4 w-4" />Enable external context</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reconcile-limit">Reconcile limit</Label>
                      <Input id="reconcile-limit" value={reconcileLimit} onChange={(event) => setReconcileLimit(event.target.value)} inputMode="numeric" />
                    </div>
                    <InfoPanel title="Action policy" lines={['Critical actions require 2FA.', 'Mutation requests are audit logged.', 'Backend policy still decides the final outcome.']} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Incidents</CardTitle>
                  <CardDescription>Severe health conditions are tracked as incidents with linked runbooks.</CardDescription>
                </CardHeader>
                <CardContent>
                  {incidentsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No incidents recorded.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Severity</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Runbook</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.slice(0, 10).map((incident) => (
                          <TableRow key={incident.id} className="cursor-pointer" onClick={() => setSelectedIncidentId(incident.id)}>
                            <TableCell><Badge className={statusTone(incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'warning' : 'neutral')}>{incident.severity}</Badge></TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">{incident.title}{incident.block_live && <Badge variant="destructive">blocked</Badge>}</div>
                              <p className="mt-1 text-xs text-muted-foreground">{incident.summary || incident.kind}</p>
                            </TableCell>
                            <TableCell>{incident.status}</TableCell>
                            <TableCell>{incident.runbook_key || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Incident Detail</CardTitle>
              <CardDescription>Selected incident, linked runbook, and recorded actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedIncidentId ? (
                <p className="text-sm text-muted-foreground">Select an incident to inspect it.</p>
              ) : selectedIncident.isLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : !selectedIncident.data ? (
                <p className="text-sm text-muted-foreground">Incident details are unavailable.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{selectedIncident.data.title}</p>
                        <p className="text-sm text-muted-foreground">{selectedIncident.data.incident_key}</p>
                      </div>
                      <Badge className={statusTone(selectedIncident.data.severity === 'critical' ? 'critical' : selectedIncident.data.severity === 'high' ? 'warning' : 'neutral')}>{selectedIncident.data.severity}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedIncident.data.status}</Badge>
                      <Badge variant="outline">{selectedIncident.data.kind}</Badge>
                      {selectedIncident.data.block_live && <Badge variant="destructive">blocks live</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedIncident.data.summary || 'No summary available.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={handleAcknowledge} disabled={ackIncident.isPending || selectedIncident.data.status === 'resolved'}>Acknowledge</Button>
                    <Button size="sm" variant="outline" onClick={handleResolve} disabled={resolveIncident.isPending || selectedIncident.data.status === 'resolved'}>Resolve</Button>
                  </div>
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoPanel title="Recorded events" lines={(selectedIncident.data.events || []).map((event) => `${event.event_type} - ${formatDate(event.created_at)}`)} />
                    <InfoPanel title="Recorded actions" lines={(selectedIncident.data.actions || []).map((action) => `${action.action_key} - ${action.status}`)} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Runbook</p>
                    {selectedRunbook ? (
                      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                        <p className="font-medium">{selectedRunbook.title}</p>
                        <p className="text-sm text-muted-foreground">{selectedRunbook.summary || 'No summary available.'}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{selectedRunbook.category}</Badge>
                          <Badge variant="outline">{selectedRunbook.severity}</Badge>
                        </div>
                        <ol className="list-decimal space-y-1 pl-5 text-sm">{selectedRunbook.steps_json?.map((step) => <li key={step}>{step}</li>)}</ol>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No linked runbook found for this incident.</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Post-incident review</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="review-root-cause">Root cause hypothesis</Label>
                        <Textarea id="review-root-cause" value={reviewRootCause} onChange={(event) => setReviewRootCause(event.target.value)} rows={3} placeholder="What is the current best hypothesis?" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="review-lessons">Lessons learned / follow-up</Label>
                        <Textarea id="review-lessons" value={reviewLessons} onChange={(event) => setReviewLessons(event.target.value)} rows={3} placeholder="What should change after this incident?" />
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleSaveReview} disabled={createPostIncidentReview.isPending || !selectedIncidentId}>Save review</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" />Runbooks</CardTitle>
              <CardDescription>Operator procedures seeded in the repository and surfaced by key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {runbooks.length === 0 ? <p className="text-sm text-muted-foreground">No runbooks available.</p> : runbooks.slice(0, 6).map((runbook) => (
                <div key={runbook.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-medium">{runbook.title}</p><p className="text-xs text-muted-foreground">{runbook.key}</p></div>
                    <div className="flex gap-2"><Badge variant="outline">{runbook.category}</Badge><Badge variant="outline">{runbook.severity}</Badge></div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{runbook.summary || '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Scheduler and Provider Health</CardTitle>
              <CardDescription>Operational maintenance history and Binance / webhook freshness signals.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-3">
                {schedulerRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scheduler history yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Command</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Duration</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedulerRuns.slice(0, 6).map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">{run.command}</TableCell>
                          <TableCell><Badge variant={run.status === 'completed' ? 'outline' : run.status === 'running' ? 'secondary' : 'destructive'}>{run.status}</Badge></TableCell>
                          <TableCell>{formatDate(run.started_at)}</TableCell>
                          <TableCell>{run.duration_ms ? `${run.duration_ms} ms` : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div className="space-y-4">
                <InfoPanel title="Webhook and tick health" lines={[
                  `Last tick: ${String(providerHealth?.ticks?.last_tick_at ?? 'n/a')}`,
                  `Tick stale: ${String(providerHealth?.ticks?.stale ?? false)}`,
                  `Connections: ${String(providerHealth?.binance_connections?.length ?? 0)}`,
                ]} />
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-sm font-medium">Next recommended action</p>
                  <p className="text-sm text-muted-foreground">{health?.recommendations?.[0] || readiness?.summary || 'No recommendation available.'}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">LIVE mode must be visually obvious and blocked states take priority. This page only surfaces backend truth and safe operator actions.</div>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Maintenance Maturity</h2>
                <p className="text-sm text-muted-foreground">Trend history, drift, drills, releases, rollback records, and confidence evidence.</p>
              </div>
              <Badge className={statusTone(maintenanceState === 'high' ? 'success' : maintenanceState === 'moderate' ? 'neutral' : maintenanceState === 'insufficient_history' ? 'warning' : 'critical')}>
                {maintenanceState} {maintenanceScore ? `${Math.round(maintenanceScore)}/100` : ''}
              </Badge>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Confidence and Trends</CardTitle>
                  <CardDescription>Evidence-backed confidence and current operational trend summary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoPanel title="Maintenance confidence" lines={[
                    `State: ${String(maintenanceConfidence?.current?.state ?? 'unknown')}`,
                    `Score: ${String(maintenanceConfidence?.current?.confidence_score ?? 'n/a')}`,
                    `Recovery confidence: ${String(maintenanceConfidence?.current?.confidence_in_recovery ?? 'n/a')}`,
                    maintenanceConfidence?.current?.summary || 'No confidence summary available.',
                  ]} />
                  <InfoPanel title="Trend snapshot" lines={[
                    `Trend state: ${String(trendCurrent.state ?? 'unknown')}`,
                    `Execution failure rate: ${String(trendCurrent.metrics_json?.execution?.failure_rate_pct ?? 'n/a')}%`,
                    `Execution slippage: ${String(trendCurrent.metrics_json?.execution?.avg_slippage_pct ?? 'n/a')}%`,
                    `Open drift detections: ${String(trendCurrent.metrics_json?.drift?.metrics?.open_detections ?? 0)}`,
                    trendCurrent.summary || 'No trend summary available.',
                  ]} />
                  <InfoPanel title="Recent change signals" lines={[
                    `Failure rate delta: ${String(trends?.changes?.failure_rate_delta_pct ?? 0)}%`,
                    `Latency delta: ${String(trends?.changes?.latency_delta_ms ?? 0)} ms`,
                    `Drift delta: ${String(trends?.changes?.drift_delta ?? 0)}`,
                  ]} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Drift Detections</CardTitle>
                  <CardDescription>Long-running degradation patterns and open drift evidence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {driftCurrent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open drift detections.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Metric</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Summary</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {driftCurrent.slice(0, 6).map((detection: any) => (
                          <TableRow key={detection.id}>
                            <TableCell className="font-medium">{detection.metric_key}</TableCell>
                            <TableCell><Badge className={statusTone(detection.severity === 'action_required' ? 'critical' : 'warning')}>{detection.severity}</Badge></TableCell>
                            <TableCell><Badge variant="outline">{detection.status}</Badge></TableCell>
                            <TableCell className="max-w-[380px] truncate">{detection.summary || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Separator />
                  <p className="text-sm font-medium">Drift history</p>
                  {driftHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No drift history recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {driftHistory.slice(0, 4).map((detection: any) => (
                        <div key={detection.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{detection.metric_key}</p>
                            <Badge className={statusTone(detection.severity === 'action_required' ? 'critical' : 'warning')}>{detection.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{detection.summary || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" />Recovery Drills and Chaos</CardTitle>
                  <CardDescription>Dry-run drills and safe failure simulations for maturity verification.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="drill-scenario">Recovery drill</Label>
                      <select id="drill-scenario" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedDrillScenario} onChange={(event) => setSelectedDrillScenario(event.target.value)}>
                        <option value="">Select a drill scenario</option>
                        {drillScenarios.map((scenario: any) => <option key={scenario.key} value={scenario.key}>{scenario.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chaos-scenario">Chaos simulation</Label>
                      <select id="chaos-scenario" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedChaosScenario} onChange={(event) => setSelectedChaosScenario(event.target.value)}>
                        <option value="">Select a simulation</option>
                        {chaosScenarios.map((scenario: any) => <option key={scenario.key} value={scenario.key}>{scenario.title}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button variant="secondary" className="justify-start gap-2" onClick={handleRunDrill} disabled={runDrill.isPending || !selectedDrillScenario}><RefreshCcw className="h-4 w-4" />Run drill</Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={handleRunChaosSimulation} disabled={runChaosSimulation.isPending || !selectedChaosScenario}><RefreshCcw className="h-4 w-4" />Run simulation</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoPanel title="Recent drills" lines={drillHistory.slice(0, 3).map((drill: any) => `${drill.scenario_name} - ${drill.status}`)} />
                    <InfoPanel title="Recent simulations" lines={chaosHistory.slice(0, 3).map((simulation: any) => `${simulation.scenario_name} - ${simulation.status}`)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Release and Rollback Governance</CardTitle>
                  <CardDescription>Record deployment markers, verification, and rollback evidence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="release-version">Release version</Label>
                      <Input id="release-version" value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} placeholder="2026.04.06-1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="release-key">Release key</Label>
                      <Input id="release-key" value={releaseKey} onChange={(event) => setReleaseKey(event.target.value)} placeholder="release-2026-04-06" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="release-env">Environment</Label>
                    <Input id="release-env" value={releaseEnvironment} onChange={(event) => setReleaseEnvironment(event.target.value)} placeholder="live" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="release-summary">Summary</Label>
                    <Textarea id="release-summary" value={releaseSummary} onChange={(event) => setReleaseSummary(event.target.value)} rows={3} placeholder="What changed in this release?" />
                  </div>
                  <Button variant="secondary" onClick={handleSaveRelease} disabled={createRelease.isPending} className="gap-2"><CheckCircle2 className="h-4 w-4" />Save release record</Button>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Recent releases</p>
                    {releaseHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No release records yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Released</TableHead><TableHead>Action</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {releaseHistory.slice(0, 4).map((release: any) => (
                            <TableRow key={release.id}>
                              <TableCell className="font-medium">{release.version}</TableCell>
                              <TableCell><Badge variant="outline">{release.status}</Badge></TableCell>
                              <TableCell>{formatDate(release.released_at)}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" onClick={() => handleVerifyRelease(release.id)} disabled={verifyRelease.isPending}>Verify</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="rollback-key">Rollback key</Label>
                        <Input id="rollback-key" value={rollbackKey} onChange={(event) => setRollbackKey(event.target.value)} placeholder="rollback-2026-04-06" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rollback-reason">Reason</Label>
                        <Input id="rollback-reason" value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} placeholder="Regression detected" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rollback-summary">Rollback summary</Label>
                      <Textarea id="rollback-summary" value={rollbackSummary} onChange={(event) => setRollbackSummary(event.target.value)} rows={3} placeholder="Why the rollback is being recorded." />
                    </div>
                    <Button variant="destructive" onClick={handleSaveRollback} disabled={createRollback.isPending} className="gap-2"><Slash className="h-4 w-4" />Save rollback record</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoPanel title="Recent rollbacks" lines={rollbackHistory.slice(0, 3).map((rollback: any) => `${rollback.rollback_key} - ${rollback.status}`)} />
                    <InfoPanel title="Post-incident reviews" lines={postIncidentReviews.reviews.slice(0, 3).map((review: any) => `${review.incident_id} - ${formatDate(review.reviewed_at)}`)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function statusTone(tone: 'neutral' | 'warning' | 'critical' | 'success'): string {
  if (tone === 'critical') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (tone === 'warning') return 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200';
  if (tone === 'success') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-200';
  return 'bg-secondary text-secondary-foreground border-border';
}

function humanize(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg border bg-background/80 p-2">{icon}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoPanel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border bg-background p-3 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}
