import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  useAiTradingConfig,
  useUpdateAiTradingConfig,
  useAiDecisions,
  useAiDecisionEvents,
  useAiTradingState,
  useAiDecisionCycles,
  useAiTradingNotifications,
  useAiTradingAnomalies,
  useBuildAiContext,
  useRequestAiProposal,
  useRunAiDecisionCycle,
  usePauseAiTrading,
  useResumeAiTrading,
  useApproveAiDecision,
  useRejectAiDecision,
  type AiTradingConfig,
} from '@/hooks/useAiTrading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Brain, ShieldCheck } from 'lucide-react';

type ConfigFormState = {
  enabled: boolean;
  mode: AiTradingConfig['mode'];
  provider: AiTradingConfig['provider'];
  provider_model: string;
  enabled_symbols: string;
  allowed_symbols: string;
  blocked_symbols: string;
  max_trade_size_pct: string;
  min_confidence: string;
  cooldown_minutes: string;
  max_pending_decisions_per_symbol: string;
  max_decisions_per_hour_per_symbol: string;
  decision_interval_minutes: string;
  max_decisions_per_hour: string;
  cooldown_minutes_after_trade: string;
  cooldown_minutes_after_loss: string;
  pause_until: string;
  auto_pause_on_daily_loss: boolean;
  auto_pause_on_drawdown: boolean;
  auto_pause_on_order_failure_streak: string;
  auto_pause_on_slippage_spike: boolean;
  auto_pause_on_reconciliation_mismatch: boolean;
  manual_resume_required: boolean;
  require_stop_loss: boolean;
  require_take_profit: boolean;
  require_time_stop: boolean;
  auto_trade_enabled: boolean;
  notes: string;
};

const emptyForm: ConfigFormState = {
  enabled: false,
  mode: 'advisor',
  provider: 'heuristic',
  provider_model: '',
  enabled_symbols: 'BTCUSDT',
  allowed_symbols: '',
  blocked_symbols: '',
  max_trade_size_pct: '1',
  min_confidence: '0.55',
  cooldown_minutes: '0',
  max_pending_decisions_per_symbol: '1',
  max_decisions_per_hour_per_symbol: '12',
  decision_interval_minutes: '5',
  max_decisions_per_hour: '60',
  cooldown_minutes_after_trade: '0',
  cooldown_minutes_after_loss: '0',
  pause_until: '',
  auto_pause_on_daily_loss: true,
  auto_pause_on_drawdown: true,
  auto_pause_on_order_failure_streak: '3',
  auto_pause_on_slippage_spike: true,
  auto_pause_on_reconciliation_mismatch: true,
  manual_resume_required: false,
  require_stop_loss: true,
  require_take_profit: true,
  require_time_stop: true,
  auto_trade_enabled: false,
  notes: '',
};

export default function AiTradingPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [form, setForm] = useState<ConfigFormState>(emptyForm);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [integrationId, setIntegrationId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | undefined>(undefined);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [executeNow, setExecuteNow] = useState(true);
  const { data: config, isLoading: configLoading } = useAiTradingConfig(workspaceId);
  const { data: decisions = [], isLoading: decisionsLoading } = useAiDecisions(workspaceId);
  const { data: stateResponse } = useAiTradingState(workspaceId, symbol);
  const { data: cycles = [] } = useAiDecisionCycles(workspaceId, symbol);
  const { data: notifications = [] } = useAiTradingNotifications(workspaceId);
  const { data: anomalyReport } = useAiTradingAnomalies(workspaceId, symbol, integrationId || undefined);
  const updateConfig = useUpdateAiTradingConfig(workspaceId);
  const buildContext = useBuildAiContext(workspaceId);
  const requestProposal = useRequestAiProposal(workspaceId);
  const runCycle = useRunAiDecisionCycle(workspaceId);
  const pauseTrading = usePauseAiTrading(workspaceId);
  const resumeTrading = useResumeAiTrading(workspaceId);
  const approveDecision = useApproveAiDecision(workspaceId);
  const rejectDecision = useRejectAiDecision(workspaceId);
  const { data: decisionEvents = [] } = useAiDecisionEvents(selectedDecisionId);

  useEffect(() => {
    if (!config) return;
    setForm({
      enabled: !!config.enabled,
      mode: config.mode,
      provider: config.provider,
      provider_model: config.provider_model || '',
      enabled_symbols: (config.enabled_symbols || []).join(', '),
      allowed_symbols: (config.allowed_symbols || []).join(', '),
      blocked_symbols: (config.blocked_symbols || []).join(', '),
      max_trade_size_pct: String(config.max_trade_size_pct ?? 1),
      min_confidence: String(config.min_confidence ?? 0.55),
      cooldown_minutes: String(config.cooldown_minutes ?? 0),
      max_pending_decisions_per_symbol: String(config.max_pending_decisions_per_symbol ?? 1),
      max_decisions_per_hour_per_symbol: String(config.max_decisions_per_hour_per_symbol ?? 12),
      decision_interval_minutes: String(config.decision_interval_minutes ?? 5),
      max_decisions_per_hour: String(config.max_decisions_per_hour ?? 60),
      cooldown_minutes_after_trade: String(config.cooldown_minutes_after_trade ?? 0),
      cooldown_minutes_after_loss: String(config.cooldown_minutes_after_loss ?? 0),
      pause_until: config.pause_until || '',
      auto_pause_on_daily_loss: !!config.auto_pause_on_daily_loss,
      auto_pause_on_drawdown: !!config.auto_pause_on_drawdown,
      auto_pause_on_order_failure_streak: String(config.auto_pause_on_order_failure_streak ?? 3),
      auto_pause_on_slippage_spike: !!config.auto_pause_on_slippage_spike,
      auto_pause_on_reconciliation_mismatch: !!config.auto_pause_on_reconciliation_mismatch,
      manual_resume_required: !!config.manual_resume_required,
      require_stop_loss: !!config.require_stop_loss,
      require_take_profit: !!config.require_take_profit,
      require_time_stop: !!config.require_time_stop,
      auto_trade_enabled: !!config.auto_trade_enabled,
      notes: config.notes || '',
    });
  }, [config]);

  const selectedDecision = useMemo(
    () => decisions.find((decision) => decision.id === selectedDecisionId) || null,
    [decisions, selectedDecisionId]
  );

  const pendingApprovals = decisions.filter((decision) => decision.final_status === 'pending_approval');

  const handleSubmit = async () => {
    if (!workspaceId) return;
    await updateConfig.mutateAsync({
      enabled: form.enabled,
      mode: form.mode,
      exchange: 'binance',
      market_type: 'spot',
      provider: form.provider,
      provider_model: form.provider_model || null,
      enabled_symbols: splitCsv(form.enabled_symbols),
      allowed_symbols: splitCsv(form.allowed_symbols),
      blocked_symbols: splitCsv(form.blocked_symbols),
      max_trade_size_pct: numberOrNull(form.max_trade_size_pct),
      min_confidence: numberOrNull(form.min_confidence),
      cooldown_minutes: intOrZero(form.cooldown_minutes),
      max_pending_decisions_per_symbol: intOrZero(form.max_pending_decisions_per_symbol),
      max_decisions_per_hour_per_symbol: intOrZero(form.max_decisions_per_hour_per_symbol),
      decision_interval_minutes: intOrZero(form.decision_interval_minutes),
      max_decisions_per_hour: intOrZero(form.max_decisions_per_hour),
      cooldown_minutes_after_trade: intOrZero(form.cooldown_minutes_after_trade),
      cooldown_minutes_after_loss: intOrZero(form.cooldown_minutes_after_loss),
      pause_until: form.pause_until || null,
      auto_pause_on_daily_loss: form.auto_pause_on_daily_loss,
      auto_pause_on_drawdown: form.auto_pause_on_drawdown,
      auto_pause_on_order_failure_streak: intOrZero(form.auto_pause_on_order_failure_streak),
      auto_pause_on_slippage_spike: form.auto_pause_on_slippage_spike,
      auto_pause_on_reconciliation_mismatch: form.auto_pause_on_reconciliation_mismatch,
      manual_resume_required: form.manual_resume_required,
      require_stop_loss: form.require_stop_loss,
      require_take_profit: form.require_take_profit,
      require_time_stop: form.require_time_stop,
      auto_trade_enabled: form.auto_trade_enabled,
      notes: form.notes || null,
    });
  };

  const latestProposalPayload = requestProposal.data?.decision?.validated_proposal_json || null;
  const latestContextPayload = buildContext.data || null;
  const effectiveState = stateResponse?.effective;
  const recentCycles = cycles.slice(0, 6);
  const recentNotifications = notifications.slice(0, 6);
  const anomalies = anomalyReport?.anomalies || [];

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                AI Trading
              </h1>
              <p className="text-muted-foreground mt-1">
                Supervised Binance spot middleware. AI proposes, policy gates, operator approves, guarded live path executes.
              </p>
            </div>
            <Badge variant="outline">Spot Only</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Effective State</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge status={effectiveState?.status || 'unknown'} />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(effectiveState?.reason_codes || []).join(', ') || 'No active blockers.'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{anomalies.length}</p>
                <p className="text-sm text-muted-foreground">
                  {anomalyReport?.recommended_action || 'continue'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{pendingApprovals.length}</p>
                <p className="text-sm text-muted-foreground">Operator review queue</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Cycles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{recentCycles.length}</p>
                <p className="text-sm text-muted-foreground">Latest symbol cadence sample</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Operator Config
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {configLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Enabled">
                        <Switch checked={form.enabled} onCheckedChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))} />
                      </Field>
                      <Field label="Auto Trade Enabled">
                        <Switch
                          checked={form.auto_trade_enabled}
                          onCheckedChange={(value) => setForm((prev) => ({ ...prev, auto_trade_enabled: value }))}
                        />
                      </Field>
                      <Field label="Mode">
                        <select className="h-10 rounded-md border bg-background px-3" value={form.mode} onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value as ConfigFormState['mode'] }))}>
                          <option value="advisor">advisor</option>
                          <option value="manual_approval">manual_approval</option>
                          <option value="restricted_auto">restricted_auto</option>
                        </select>
                      </Field>
                      <Field label="Provider">
                        <select className="h-10 rounded-md border bg-background px-3" value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value as ConfigFormState['provider'] }))}>
                          <option value="heuristic">heuristic</option>
                          <option value="openai">openai</option>
                          <option value="gemini">gemini</option>
                          <option value="anthropic">anthropic</option>
                          <option value="null">null</option>
                        </select>
                      </Field>
                      <Field label="Provider Model">
                        <Input value={form.provider_model} onChange={(e) => setForm((prev) => ({ ...prev, provider_model: e.target.value }))} placeholder="gpt-5.4" />
                      </Field>
                      <Field label="Min Confidence">
                        <Input value={form.min_confidence} onChange={(e) => setForm((prev) => ({ ...prev, min_confidence: e.target.value }))} />
                      </Field>
                      <Field label="Max Trade Size %">
                        <Input value={form.max_trade_size_pct} onChange={(e) => setForm((prev) => ({ ...prev, max_trade_size_pct: e.target.value }))} />
                      </Field>
                      <Field label="Cooldown Minutes">
                        <Input value={form.cooldown_minutes} onChange={(e) => setForm((prev) => ({ ...prev, cooldown_minutes: e.target.value }))} />
                      </Field>
                      <Field label="Max Pending / Symbol">
                        <Input value={form.max_pending_decisions_per_symbol} onChange={(e) => setForm((prev) => ({ ...prev, max_pending_decisions_per_symbol: e.target.value }))} />
                      </Field>
                      <Field label="Max Decisions / Hour / Symbol">
                        <Input value={form.max_decisions_per_hour_per_symbol} onChange={(e) => setForm((prev) => ({ ...prev, max_decisions_per_hour_per_symbol: e.target.value }))} />
                      </Field>
                      <Field label="Decision Interval Minutes">
                        <Input value={form.decision_interval_minutes} onChange={(e) => setForm((prev) => ({ ...prev, decision_interval_minutes: e.target.value }))} />
                      </Field>
                      <Field label="Max Decisions / Hour">
                        <Input value={form.max_decisions_per_hour} onChange={(e) => setForm((prev) => ({ ...prev, max_decisions_per_hour: e.target.value }))} />
                      </Field>
                      <Field label="Cooldown After Trade">
                        <Input value={form.cooldown_minutes_after_trade} onChange={(e) => setForm((prev) => ({ ...prev, cooldown_minutes_after_trade: e.target.value }))} />
                      </Field>
                      <Field label="Cooldown After Loss">
                        <Input value={form.cooldown_minutes_after_loss} onChange={(e) => setForm((prev) => ({ ...prev, cooldown_minutes_after_loss: e.target.value }))} />
                      </Field>
                      <Field label="Failure Streak Threshold">
                        <Input value={form.auto_pause_on_order_failure_streak} onChange={(e) => setForm((prev) => ({ ...prev, auto_pause_on_order_failure_streak: e.target.value }))} />
                      </Field>
                      <Field label="Pause Until">
                        <Input value={form.pause_until} onChange={(e) => setForm((prev) => ({ ...prev, pause_until: e.target.value }))} placeholder="2026-03-30 18:30:00" />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Enabled Symbols">
                        <Input value={form.enabled_symbols} onChange={(e) => setForm((prev) => ({ ...prev, enabled_symbols: e.target.value }))} placeholder="BTCUSDT, ETHUSDT" />
                      </Field>
                      <Field label="Allowed Symbols">
                        <Input value={form.allowed_symbols} onChange={(e) => setForm((prev) => ({ ...prev, allowed_symbols: e.target.value }))} placeholder="BTCUSDT, ETHUSDT" />
                      </Field>
                      <Field label="Blocked Symbols">
                        <Input value={form.blocked_symbols} onChange={(e) => setForm((prev) => ({ ...prev, blocked_symbols: e.target.value }))} placeholder="DOGEUSDT" />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Require Stop Loss">
                        <Switch checked={form.require_stop_loss} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_stop_loss: value }))} />
                      </Field>
                      <Field label="Require Take Profit">
                        <Switch checked={form.require_take_profit} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_take_profit: value }))} />
                      </Field>
                      <Field label="Require Time Stop">
                        <Switch checked={form.require_time_stop} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_time_stop: value }))} />
                      </Field>
                      <Field label="Manual Resume Required">
                        <Switch checked={form.manual_resume_required} onCheckedChange={(value) => setForm((prev) => ({ ...prev, manual_resume_required: value }))} />
                      </Field>
                      <Field label="Auto Pause On Daily Loss">
                        <Switch checked={form.auto_pause_on_daily_loss} onCheckedChange={(value) => setForm((prev) => ({ ...prev, auto_pause_on_daily_loss: value }))} />
                      </Field>
                      <Field label="Auto Pause On Drawdown">
                        <Switch checked={form.auto_pause_on_drawdown} onCheckedChange={(value) => setForm((prev) => ({ ...prev, auto_pause_on_drawdown: value }))} />
                      </Field>
                      <Field label="Auto Pause On Slippage Spike">
                        <Switch checked={form.auto_pause_on_slippage_spike} onCheckedChange={(value) => setForm((prev) => ({ ...prev, auto_pause_on_slippage_spike: value }))} />
                      </Field>
                      <Field label="Auto Pause On Reconcile Mismatch">
                        <Switch checked={form.auto_pause_on_reconciliation_mismatch} onCheckedChange={(value) => setForm((prev) => ({ ...prev, auto_pause_on_reconciliation_mismatch: value }))} />
                      </Field>
                    </div>

                    <Field label="Notes">
                      <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} />
                    </Field>

                    <Button onClick={handleSubmit} disabled={updateConfig.isPending}>
                      {updateConfig.isPending ? 'Saving...' : 'Save AI Config'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Proposal Tester
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Symbol">
                  <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BTCUSDT" />
                </Field>
                <Field label="Integration Id">
                  <Input value={integrationId} onChange={(e) => setIntegrationId(e.target.value)} placeholder="optional preferred integration" />
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => buildContext.mutate({ symbol, integrationId: integrationId || undefined })}
                    disabled={buildContext.isPending || !workspaceId}
                  >
                    {buildContext.isPending ? 'Building...' : 'Build Context'}
                  </Button>
                  <Button
                    onClick={() => requestProposal.mutate({ symbol, integrationId: integrationId || undefined })}
                    disabled={requestProposal.isPending || !workspaceId}
                  >
                    {requestProposal.isPending ? 'Requesting...' : 'Request Proposal'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => runCycle.mutate({ symbol, integrationId: integrationId || undefined })}
                    disabled={runCycle.isPending || !workspaceId}
                  >
                    {runCycle.isPending ? 'Running...' : 'Run Decision Cycle'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => pauseTrading.mutate({ symbol, reason: 'manual_operator_pause' })}
                    disabled={pauseTrading.isPending || !workspaceId}
                  >
                    Pause Symbol
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resumeTrading.mutate({ symbol })}
                    disabled={resumeTrading.isPending || !workspaceId}
                  >
                    Resume Symbol
                  </Button>
                </div>
                <JsonPreview title="Current Anomalies" value={anomalyReport as Record<string, any> | null} />
                <JsonPreview title="Latest Context" value={latestContextPayload} />
                <JsonPreview title="Latest Proposal" value={latestProposalPayload} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Decision Cycles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentCycles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No decision cycles recorded yet.</p>
                ) : (
                  recentCycles.map((cycle) => (
                    <div key={cycle.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{cycle.symbol}</p>
                          <p className="text-sm text-muted-foreground">{cycle.trigger_type} / {cycle.mode}</p>
                        </div>
                        <StatusBadge status={cycle.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{cycle.message || 'No summary.'}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent AI Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AI notifications yet.</p>
                ) : (
                  recentNotifications.map((item) => (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{String(item.content?.title || 'AI event')}</p>
                        <Badge variant="outline">{String(item.content?.severity || 'info')}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{String(item.content?.body || '')}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>AI Decisions</CardTitle>
              </CardHeader>
              <CardContent>
                {decisionsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decisions.map((decision) => (
                        <TableRow key={decision.id} className="cursor-pointer" onClick={() => setSelectedDecisionId(decision.id)}>
                          <TableCell>{decision.symbol}</TableCell>
                          <TableCell>{decision.action || '-'}</TableCell>
                          <TableCell><StatusBadge status={decision.final_status} /></TableCell>
                          <TableCell>{decision.provider_name || '-'}</TableCell>
                          <TableCell>{decision.confidence ?? '-'}</TableCell>
                          <TableCell>{decision.created_at}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={decision.final_status !== 'pending_approval' || approveDecision.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  approveDecision.mutate({ decisionId: decision.id, executeNow });
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={decision.final_status !== 'pending_approval' || rejectDecision.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  rejectDecision.mutate({
                                    decisionId: decision.id,
                                    reason: approvalNotes[decision.id] || 'operator_rejected',
                                  });
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Approval execution mode</p>
                      <p className="text-sm text-muted-foreground">Leave enabled to place BUY/SELL orders immediately after approval.</p>
                    </div>
                    <Switch checked={executeNow} onCheckedChange={setExecuteNow} />
                  </div>
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending approvals.</p>
                  ) : (
                    pendingApprovals.map((decision) => (
                      <div key={decision.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{decision.symbol} {decision.action || '-'}</p>
                            <p className="text-sm text-muted-foreground">{decision.provider_name || '-'} / {decision.provider_model || '-'}</p>
                          </div>
                          <StatusBadge status={decision.final_status} />
                        </div>
                        <div className="mt-3 space-y-3">
                          <Textarea
                            value={approvalNotes[decision.id] || ''}
                            onChange={(event) => setApprovalNotes((prev) => ({ ...prev, [decision.id]: event.target.value }))}
                            placeholder="Optional reject note or operator comment"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveDecision.mutate({ decisionId: decision.id, executeNow })}
                              disabled={approveDecision.isPending}
                            >
                              {approveDecision.isPending ? 'Approving...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectDecision.mutate({
                                decisionId: decision.id,
                                reason: approvalNotes[decision.id] || 'operator_rejected',
                              })}
                              disabled={rejectDecision.isPending}
                            >
                              {rejectDecision.isPending ? 'Rejecting...' : 'Reject'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Decision Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedDecision ? (
                    <p className="text-sm text-muted-foreground">Select a decision to inspect its event history.</p>
                  ) : decisionEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events recorded.</p>
                  ) : (
                    decisionEvents.map((event) => (
                      <div key={event.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-xs text-muted-foreground">{event.created_at}</p>
                        </div>
                        {event.payload_json && (
                          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(event.payload_json, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'executed') return <Badge variant="outline">executed</Badge>;
  if (status === 'pending_approval') return <Badge variant="secondary">pending_approval</Badge>;
  if (status === 'paused' || status === 'blocked_by_breaker') return <Badge variant="destructive">{status}</Badge>;
  if (status === 'cooling_down') return <Badge variant="secondary">cooling_down</Badge>;
  if (status === 'blocked' || status === 'execution_failed') return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function JsonPreview({ title, value }: { title: string; value: Record<string, any> | null }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
        {value ? JSON.stringify(value, null, 2) : 'No data yet.'}
      </pre>
    </div>
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function numberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrZero(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
