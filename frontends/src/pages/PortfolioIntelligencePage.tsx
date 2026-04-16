import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTradingSettings } from '@/hooks/useTradingMode';
import { useSystemSettings } from '@/hooks/useRisk';
import {
  usePortfolioIntelligenceConfig,
  useUpdatePortfolioIntelligenceConfig,
  usePortfolioIntelligenceSnapshot,
  usePortfolioIntelligenceRankedOpportunities,
  usePortfolioIntelligenceSymbolScore,
  usePortfolioIntelligenceAllocation,
  usePortfolioIntelligenceRiskBudget,
  usePortfolioIntelligenceRecommendations,
  usePortfolioIntelligenceRuns,
  useRunPortfolioIntelligence,
  type PortfolioIntelligenceConfig,
  type PortfolioRecommendation,
} from '@/hooks/usePortfolioIntelligence';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Clock3,
  Gauge,
  Layers3,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfigFormState = {
  enabled: boolean;
  ranking_mode: PortfolioIntelligenceConfig['ranking_mode'];
  allocation_mode: PortfolioIntelligenceConfig['allocation_mode'];
  opportunity_score_threshold: string;
  max_total_allocated_pct: string;
  max_symbol_allocated_pct: string;
  max_correlated_group_allocated_pct: string;
  max_simultaneous_new_trades: string;
  reserve_cash_buffer_pct: string;
  max_open_positions: string;
  max_open_decision_count: string;
  max_total_notional: string;
  max_daily_loss_pct: string;
  max_drawdown_pct: string;
  prefer_hold_cash_under_high_uncertainty: boolean;
  reduce_size_under_external_risk: boolean;
  require_approval_for_rotation: boolean;
  enable_reduce_recommendations: boolean;
  enable_rotation_recommendations: boolean;
  score_weights_json: string;
  notes: string;
};

const emptyForm: ConfigFormState = {
  enabled: false,
  ranking_mode: 'heuristic',
  allocation_mode: 'capped_score_weighted',
  opportunity_score_threshold: '65',
  max_total_allocated_pct: '35',
  max_symbol_allocated_pct: '8',
  max_correlated_group_allocated_pct: '15',
  max_simultaneous_new_trades: '3',
  reserve_cash_buffer_pct: '15',
  max_open_positions: '10',
  max_open_decision_count: '5',
  max_total_notional: '',
  max_daily_loss_pct: '3',
  max_drawdown_pct: '8',
  prefer_hold_cash_under_high_uncertainty: true,
  reduce_size_under_external_risk: true,
  require_approval_for_rotation: true,
  enable_reduce_recommendations: true,
  enable_rotation_recommendations: false,
  score_weights_json: '',
  notes: '',
};

export default function PortfolioIntelligencePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: tradingSettings } = useTradingSettings(workspaceId);
  const { data: systemSettings } = useSystemSettings(workspaceId);
  const { data: configResponse, isLoading: configLoading } = usePortfolioIntelligenceConfig(workspaceId);
  const { data: snapshot } = usePortfolioIntelligenceSnapshot(workspaceId);
  const { data: rankedResponse, isLoading: rankedLoading } = usePortfolioIntelligenceRankedOpportunities(workspaceId);
  const { data: allocationResponse } = usePortfolioIntelligenceAllocation(workspaceId);
  const { data: riskBudgetResponse } = usePortfolioIntelligenceRiskBudget(workspaceId);
  const { data: recommendationsResponse } = usePortfolioIntelligenceRecommendations(workspaceId);
  const { data: runs = [] } = usePortfolioIntelligenceRuns(workspaceId);
  const updateConfig = useUpdatePortfolioIntelligenceConfig(workspaceId);
  const runPortfolio = useRunPortfolioIntelligence(workspaceId);

  const [form, setForm] = useState<ConfigFormState>(emptyForm);
  const [selectedSymbol, setSelectedSymbol] = useState('');

  const rankedOpportunities: PortfolioRecommendation[] =
    rankedResponse?.opportunities ??
    (snapshot?.ranked_opportunities as PortfolioRecommendation[] | undefined) ??
    [];
  const rankedSummary = rankedResponse?.summary ?? snapshot?.summary ?? {};
  const recommendations = recommendationsResponse ?? snapshot?.recommendations ?? {};
  const allocation = allocationResponse?.allocation ?? snapshot?.allocation ?? {};
  const riskBudget = riskBudgetResponse ?? snapshot?.risk_budget ?? {};
  const portfolioContext = snapshot?.portfolio_context ?? {};
  const portfolio = portfolioContext.portfolio ?? {};
  const capital = portfolio.capital ?? {};
  const exposure = portfolio.exposure ?? {};
  const external = portfolio.external_context ?? {};
  const mode = portfolio.mode ?? {};
  const status = portfolio.status ?? {};

  const currentConfig = configResponse?.config ?? null;
  const effectiveConfig = configResponse?.effective_config ?? {};

  useEffect(() => {
    if (!currentConfig) {
      return;
    }

    setForm({
      enabled: !!currentConfig.enabled,
      ranking_mode: currentConfig.ranking_mode,
      allocation_mode: currentConfig.allocation_mode,
      opportunity_score_threshold: stringOrEmpty(currentConfig.opportunity_score_threshold),
      max_total_allocated_pct: stringOrEmpty(currentConfig.max_total_allocated_pct),
      max_symbol_allocated_pct: stringOrEmpty(currentConfig.max_symbol_allocated_pct),
      max_correlated_group_allocated_pct: stringOrEmpty(currentConfig.max_correlated_group_allocated_pct),
      max_simultaneous_new_trades: stringOrEmpty(currentConfig.max_simultaneous_new_trades),
      reserve_cash_buffer_pct: stringOrEmpty(currentConfig.reserve_cash_buffer_pct),
      max_open_positions: stringOrEmpty(currentConfig.max_open_positions),
      max_open_decision_count: stringOrEmpty(currentConfig.max_open_decision_count),
      max_total_notional: stringOrEmpty(currentConfig.max_total_notional),
      max_daily_loss_pct: stringOrEmpty(currentConfig.max_daily_loss_pct),
      max_drawdown_pct: stringOrEmpty(currentConfig.max_drawdown_pct),
      prefer_hold_cash_under_high_uncertainty: !!currentConfig.prefer_hold_cash_under_high_uncertainty,
      reduce_size_under_external_risk: !!currentConfig.reduce_size_under_external_risk,
      require_approval_for_rotation: !!currentConfig.require_approval_for_rotation,
      enable_reduce_recommendations: !!currentConfig.enable_reduce_recommendations,
      enable_rotation_recommendations: !!currentConfig.enable_rotation_recommendations,
      score_weights_json: currentConfig.score_weights_json ? JSON.stringify(currentConfig.score_weights_json, null, 2) : '',
      notes: currentConfig.notes || '',
    });
  }, [currentConfig]);

  useEffect(() => {
    if (!selectedSymbol && rankedOpportunities[0]?.symbol) {
      setSelectedSymbol(rankedOpportunities[0].symbol);
    }
  }, [rankedOpportunities, selectedSymbol]);

  const selectedSymbolScoreQuery = usePortfolioIntelligenceSymbolScore(workspaceId, selectedSymbol || undefined);
  const selectedOpportunity = useMemo(
    () => rankedOpportunities.find((opportunity) => opportunity.symbol === selectedSymbol) || null,
    [rankedOpportunities, selectedSymbol]
  );
  const selectedScore = selectedSymbolScoreQuery.data ?? selectedOpportunity;
  const validationErrors = useMemo(() => validateConfig(form), [form]);
  const hasBlockingValidationError = validationErrors.some((error) =>
    error.startsWith('invalid_') || error.includes('cannot') || error.includes('must')
  );

  const environmentLabel = tradingSettings?.venue_environment === 'live' ? 'LIVE' : 'SANDBOX';
  const tradingModeLabel = tradingSettings?.trading_mode === 'live' ? 'LIVE' : 'PAPER';
  const aiModeLabel = String(mode.ai_mode || 'advisor').toUpperCase();
  const portfolioState = String(riskBudget?.state || 'healthy').toUpperCase();
  const externalFreshness = String(external?.freshness_state || 'unavailable').toUpperCase();
  const autoAllowed = Boolean(recommendations?.summary?.auto_allowed);
  const noTrade = Boolean(recommendations?.summary?.no_trade);
  const topSymbol = String(rankedSummary?.top_symbol || 'n/a');
  const selectedCount = Number(rankedSummary?.selected_count || 0);
  const blockedCount = Number(rankedSummary?.blocked_count || 0);
  const allocatedCount = Number(rankedSummary?.allocated_count || 0);
  const runsCount = runs.length;

  const selectedBreakdown = (selectedScore?.score_breakdown ?? []) as Array<Record<string, any>>;
  const selectedReasons = [
    ...(selectedScore?.strengths ?? []),
    ...(selectedScore?.cautions ?? []),
    ...(selectedScore?.blockers ?? []),
  ].filter(Boolean);
  const bySymbolExposure = Object.values((exposure?.by_symbol ?? {}) as Record<string, any>);
  const byGroupExposure = Object.values((exposure?.by_group ?? {}) as Record<string, any>);

  const handleSave = async () => {
    if (!workspaceId || validationErrors.length > 0) {
      return;
    }

    await updateConfig.mutateAsync(buildPayload(form));
  };

  const handleRun = async () => {
    await runPortfolio.mutateAsync({ trigger_type: 'manual' });
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Brain className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Portfolio Intelligence</h1>
                    <p className="text-muted-foreground">
                      Ranked opportunities, capital allocation, and cross-symbol risk budgeting with operator control.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Workspace: {currentWorkspace?.name || currentWorkspace?.id || 'n/a'}</Badge>
                  <Badge className={badgeTone(environmentLabel === 'LIVE' ? 'critical' : 'neutral')}>
                    Venue {environmentLabel}
                  </Badge>
                  <Badge className={badgeTone(tradingModeLabel === 'LIVE' ? 'warning' : 'neutral')}>
                    Trading {tradingModeLabel}
                  </Badge>
                  <Badge className={badgeTone(aiModeLabel === 'RESTRICTED_AUTO' ? 'warning' : 'neutral')}>
                    AI {aiModeLabel}
                  </Badge>
                  <Badge className={badgeTone(portfolioState === 'BLOCKED' ? 'critical' : portfolioState === 'CONSTRAINED' ? 'warning' : 'neutral')}>
                    Portfolio {portfolioState}
                  </Badge>
                  <Badge className={badgeTone(Boolean(systemSettings?.global_trading_enabled) ? 'neutral' : 'critical')}>
                    {systemSettings?.global_trading_enabled ? 'Global trading on' : 'Global trading off'}
                  </Badge>
                  <Badge className={badgeTone(Boolean(systemSettings?.maintenance_mode) ? 'critical' : 'neutral')}>
                    {systemSettings?.maintenance_mode ? 'Maintenance mode' : 'Maintenance clear'}
                  </Badge>
                  <Badge className={badgeTone(externalFreshness === 'FRESH' ? 'neutral' : externalFreshness === 'STALE' ? 'warning' : 'critical')}>
                    External {externalFreshness}
                  </Badge>
                  <Badge className={badgeTone(Boolean(mode.portfolio_intelligence_enabled) ? 'neutral' : 'warning')}>
                    Portfolio IQ {mode.portfolio_intelligence_enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Button onClick={handleRun} disabled={runPortfolio.isPending || !workspaceId} className="gap-2">
                  {runPortfolio.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Run ranking cycle
                </Button>
                <p className="text-right text-xs text-muted-foreground">
                  Runs through the backend portfolio brain only. No execution bypass is introduced here.
                </p>
              </div>
            </div>

            <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
              <CardContent className="py-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="Selected opportunities" value={selectedCount.toString()} icon={<Target className="h-4 w-4 text-primary" />} />
                  <MetricCard title="Blocked opportunities" value={blockedCount.toString()} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} />
                  <MetricCard title="Allocated positions" value={allocatedCount.toString()} icon={<Wallet className="h-4 w-4 text-emerald-500" />} />
                  <MetricCard title="Top ranked symbol" value={topSymbol} icon={<TrendingUp className="h-4 w-4 text-cyan-500" />} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Portfolio Config
                </CardTitle>
                <CardDescription>
                  Operator-owned portfolio intelligence settings. Validation is enforced before save and before ranking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {configLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : (
                  <>
                    {validationErrors.length > 0 && (
                      <Card className="border-amber-500/40 bg-amber-500/5">
                        <CardContent className="py-3 text-sm space-y-1">
                          <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4" />
                            Config validation issues
                          </div>
                          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                            {validationErrors.map((error) => (
                              <li key={error}>{error}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Enabled">
                        <Switch checked={form.enabled} onCheckedChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))} />
                      </Field>
                      <Field label="Ranking mode">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={form.ranking_mode}
                          onChange={(event) => setForm((prev) => ({ ...prev, ranking_mode: event.target.value as ConfigFormState['ranking_mode'] }))}
                        >
                          <option value="heuristic">heuristic</option>
                          <option value="score_based">score_based</option>
                          <option value="rule_based">rule_based</option>
                        </select>
                      </Field>
                      <Field label="Allocation mode">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={form.allocation_mode}
                          onChange={(event) => setForm((prev) => ({ ...prev, allocation_mode: event.target.value as ConfigFormState['allocation_mode'] }))}
                        >
                          <option value="equal_weight">equal_weight</option>
                          <option value="score_weighted">score_weighted</option>
                          <option value="capped_score_weighted">capped_score_weighted</option>
                          <option value="conservative_risk_weighted">conservative_risk_weighted</option>
                        </select>
                      </Field>
                      <Field label="Opportunity threshold">
                        <Input value={form.opportunity_score_threshold} onChange={(event) => setForm((prev) => ({ ...prev, opportunity_score_threshold: event.target.value }))} />
                      </Field>
                      <Field label="Max total allocated %">
                        <Input value={form.max_total_allocated_pct} onChange={(event) => setForm((prev) => ({ ...prev, max_total_allocated_pct: event.target.value }))} />
                      </Field>
                      <Field label="Max symbol allocated %">
                        <Input value={form.max_symbol_allocated_pct} onChange={(event) => setForm((prev) => ({ ...prev, max_symbol_allocated_pct: event.target.value }))} />
                      </Field>
                      <Field label="Max correlated group %">
                        <Input value={form.max_correlated_group_allocated_pct} onChange={(event) => setForm((prev) => ({ ...prev, max_correlated_group_allocated_pct: event.target.value }))} />
                      </Field>
                      <Field label="Max simultaneous new trades">
                        <Input value={form.max_simultaneous_new_trades} onChange={(event) => setForm((prev) => ({ ...prev, max_simultaneous_new_trades: event.target.value }))} />
                      </Field>
                      <Field label="Reserve cash buffer %">
                        <Input value={form.reserve_cash_buffer_pct} onChange={(event) => setForm((prev) => ({ ...prev, reserve_cash_buffer_pct: event.target.value }))} />
                      </Field>
                      <Field label="Max open positions">
                        <Input value={form.max_open_positions} onChange={(event) => setForm((prev) => ({ ...prev, max_open_positions: event.target.value }))} />
                      </Field>
                      <Field label="Max open decision count">
                        <Input value={form.max_open_decision_count} onChange={(event) => setForm((prev) => ({ ...prev, max_open_decision_count: event.target.value }))} />
                      </Field>
                      <Field label="Max total notional">
                        <Input value={form.max_total_notional} onChange={(event) => setForm((prev) => ({ ...prev, max_total_notional: event.target.value }))} />
                      </Field>
                      <Field label="Max daily loss %">
                        <Input value={form.max_daily_loss_pct} onChange={(event) => setForm((prev) => ({ ...prev, max_daily_loss_pct: event.target.value }))} />
                      </Field>
                      <Field label="Max drawdown %">
                        <Input value={form.max_drawdown_pct} onChange={(event) => setForm((prev) => ({ ...prev, max_drawdown_pct: event.target.value }))} />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Prefer cash under uncertainty">
                        <Switch checked={form.prefer_hold_cash_under_high_uncertainty} onCheckedChange={(value) => setForm((prev) => ({ ...prev, prefer_hold_cash_under_high_uncertainty: value }))} />
                      </Field>
                      <Field label="Reduce size on external risk">
                        <Switch checked={form.reduce_size_under_external_risk} onCheckedChange={(value) => setForm((prev) => ({ ...prev, reduce_size_under_external_risk: value }))} />
                      </Field>
                      <Field label="Require approval for rotation">
                        <Switch checked={form.require_approval_for_rotation} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_approval_for_rotation: value }))} />
                      </Field>
                      <Field label="Enable reduce recommendations">
                        <Switch checked={form.enable_reduce_recommendations} onCheckedChange={(value) => setForm((prev) => ({ ...prev, enable_reduce_recommendations: value }))} />
                      </Field>
                      <Field label="Enable rotation recommendations">
                        <Switch checked={form.enable_rotation_recommendations} onCheckedChange={(value) => setForm((prev) => ({ ...prev, enable_rotation_recommendations: value }))} />
                      </Field>
                    </div>

                    <Field label="Score weights JSON">
                      <Textarea
                        rows={6}
                        value={form.score_weights_json}
                        onChange={(event) => setForm((prev) => ({ ...prev, score_weights_json: event.target.value }))}
                        placeholder='{"setup_quality": 0.25, "signal_confidence": 0.15}'
                      />
                    </Field>

                    <Field label="Notes">
                      <Textarea
                        rows={4}
                        value={form.notes}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="Operator notes for portfolio ranking behavior."
                      />
                    </Field>

                    <div className="flex items-center gap-3">
                      <Button onClick={handleSave} disabled={updateConfig.isPending || hasBlockingValidationError || !workspaceId} className="gap-2">
                        {updateConfig.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        Save portfolio config
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {currentConfig?.updated_at ? new Date(currentConfig.updated_at).toLocaleString() : 'n/a'}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailListCard
                        title="Effective config preview"
                        items={[
                          ['Threshold', formatPercent(currentConfig?.opportunity_score_threshold, 0)],
                          ['Total cap', formatPercent(currentConfig?.max_total_allocated_pct, 0)],
                          ['Symbol cap', formatPercent(currentConfig?.max_symbol_allocated_pct, 0)],
                          ['Group cap', formatPercent(currentConfig?.max_correlated_group_allocated_pct, 0)],
                          ['Mode', currentConfig?.ranking_mode || 'heuristic'],
                          ['Allocator', currentConfig?.allocation_mode || 'capped_score_weighted'],
                        ]}
                      />
                      <DetailListCard
                        title="Backend state"
                        items={[
                          ['Config enabled', currentConfig?.enabled ? 'yes' : 'no'],
                          ['Auto allowed', autoAllowed ? 'yes' : 'no'],
                          ['No trade', noTrade ? 'yes' : 'no'],
                          ['Recent runs', runsCount.toString()],
                          ['Portfolio IQ active', mode.portfolio_intelligence_enabled ? 'yes' : 'no'],
                          ['Live mode', tradingModeLabel],
                        ]}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5" />
                    Cycle Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <SummaryRow label="Portfolio state" value={String(riskBudget?.state || 'healthy')} />
                  <SummaryRow label="Allowed for new entries" value={riskBudget?.new_entries_allowed ? 'yes' : 'no'} />
                  <SummaryRow label="Reduction allowed" value={riskBudget?.reduction_allowed ? 'yes' : 'no'} />
                  <SummaryRow label="Reduce-risk mode" value={riskBudget?.reduce_risk_mode ? 'yes' : 'no'} />
                  <SummaryRow label="Selected symbols" value={String(rankedSummary?.selected_count ?? 0)} />
                  <SummaryRow label="Blocked symbols" value={String(rankedSummary?.blocked_count ?? 0)} />
                  <SummaryRow label="Watchlist" value={String(rankedSummary?.watchlist_count ?? 0)} />
                  <SummaryRow label="Top symbol" value={String(rankedSummary?.top_symbol ?? 'n/a')} />
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Reasons: {(riskBudget?.reason_codes || []).length > 0 ? (riskBudget.reason_codes as string[]).join(', ') : 'none'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5" />
                    Portfolio Exposure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <SummaryRow label="Equity estimate" value={formatMoney(capital?.equity_estimate)} />
                  <SummaryRow label="Allocated capital" value={formatMoney(capital?.allocated_capital)} />
                  <SummaryRow label="Free capital" value={formatMoney(capital?.free_capital)} />
                  <SummaryRow label="Cash available" value={formatMoney(capital?.cash_available)} />
                  <SummaryRow label="Daily PnL" value={formatMoney(capital?.daily_total_pnl)} />
                  <SummaryRow label="Open orders" value={String(exposure?.open_orders ?? 0)} />
                  <SummaryRow label="Spot positions" value={String(exposure?.spot_positions ?? 0)} />
                  <SummaryRow label="Futures positions" value={String(exposure?.futures_positions ?? 0)} />
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniTable
                      title="Symbol concentration"
                      rows={bySymbolExposure.slice(0, 5).map((row: any) => [
                        String(row.symbol || '-'),
                        formatMoney(row.notional),
                        formatPercent(row.exposure_pct),
                      ])}
                      headers={['Symbol', 'Notional', 'Exposure']}
                    />
                    <MiniTable
                      title="Family concentration"
                      rows={byGroupExposure.slice(0, 5).map((row: any) => [
                        String(row.group_label || '-'),
                        formatMoney(row.notional),
                        formatPercent(row.exposure_pct),
                      ])}
                      headers={['Group', 'Notional', 'Exposure']}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ranked Opportunities
                  </CardTitle>
                  <CardDescription>
                    Explained ranking across symbols. Click a row to inspect score breakdown and allocation details.
                  </CardDescription>
                </div>
                <Badge variant="outline">{rankedOpportunities.length} candidates</Badge>
              </CardHeader>
              <CardContent>
                {rankedLoading ? (
                  <Skeleton className="h-72 w-full" />
                ) : rankedOpportunities.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="h-6 w-6" />}
                    title="No ranked opportunities"
                    description="No symbol cleared the current portfolio threshold. This is a valid safe outcome."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Size cap</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reasons</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankedOpportunities.map((opportunity) => (
                          <TableRow
                            key={opportunity.symbol}
                            className={cn('cursor-pointer', selectedSymbol === opportunity.symbol && 'bg-primary/5')}
                            onClick={() => setSelectedSymbol(opportunity.symbol)}
                          >
                            <TableCell>{opportunity.rank ?? '-'}</TableCell>
                            <TableCell className="font-medium">{opportunity.symbol}</TableCell>
                            <TableCell>{formatPercent(opportunity.score, 0)}</TableCell>
                            <TableCell>
                              <ActionBadge action={opportunity.recommended_action} />
                            </TableCell>
                            <TableCell>{formatPercent(opportunity.suggested_size_cap_pct, 2)}</TableCell>
                            <TableCell>
                              <StatusBadge
                                blocked={opportunity.blocked}
                                approvalRequired={opportunity.approval_required ?? opportunity.requires_approval}
                                autoAllowed={opportunity.auto_allowed}
                              />
                            </TableCell>
                            <TableCell className="max-w-[320px]">
                              <ReasonPills reasons={[...(opportunity.strengths || []), ...(opportunity.cautions || [])]} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Opportunity Detail
                </CardTitle>
                <CardDescription>
                  Select a symbol to inspect the score breakdown, recommendation logic, and portfolio impact.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="selected-symbol">Inspect symbol</Label>
                  <Input
                    id="selected-symbol"
                    value={selectedSymbol}
                    onChange={(event) => setSelectedSymbol(event.target.value.toUpperCase())}
                    placeholder="BTCUSDT"
                  />
                </div>

                {selectedSymbolScoreQuery.isError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    Failed to load symbol score: {selectedSymbolScoreQuery.error instanceof Error ? selectedSymbolScoreQuery.error.message : 'unknown error'}
                  </div>
                )}

                {!selectedScore ? (
                  <EmptyState
                    icon={<Target className="h-6 w-6" />}
                    title="No symbol selected"
                    description="Choose a ranked symbol to inspect the detailed score breakdown."
                  />
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailListCard
                        title={`${selectedScore.symbol} summary`}
                        items={[
                          ['Score', formatPercent(selectedScore.score, 0)],
                          ['Confidence', formatPercent((selectedScore.confidence || 0) * 100, 0)],
                          ['Action', String(selectedScore.recommended_action || 'no_trade')],
                          ['Trend', String(selectedScore.trend_direction || 'neutral')],
                          ['Approval', selectedScore.requires_approval ? 'required' : 'not required'],
                          ['Auto allowed', selectedScore.auto_allowed ? 'yes' : 'no'],
                        ]}
                      />
                      <DetailListCard
                        title="Portfolio impact"
                        items={[
                          ['Symbol exposure', formatPercent(selectedScore.portfolio_impact?.symbol_exposure_pct)],
                          ['Group exposure', formatPercent(selectedScore.portfolio_impact?.group_exposure_pct)],
                          ['Group', String(selectedScore.portfolio_impact?.group_label || 'n/a')],
                          ['Open orders', String(selectedScore.portfolio_impact?.open_orders_count ?? 0)],
                          ['Open position', selectedScore.portfolio_impact?.open_position ? 'yes' : 'no'],
                          ['Size cap', formatPercent(selectedScore.suggested_size_cap_pct, 2)],
                        ]}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Card className="border-border/60">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Strengths</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {(selectedScore.strengths || []).length === 0 ? (
                            <p className="text-muted-foreground">No strong positive signals were identified.</p>
                          ) : (
                            (selectedScore.strengths || []).map((strength) => (
                              <div key={strength} className="rounded-md border bg-emerald-500/5 px-3 py-2">
                                {strength}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                      <Card className="border-border/60">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Cautions / blockers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {selectedReasons.length === 0 ? (
                            <p className="text-muted-foreground">No material cautions were emitted for this opportunity.</p>
                          ) : (
                            selectedReasons.map((reason) => (
                              <div key={reason} className="rounded-md border bg-amber-500/5 px-3 py-2">
                                {reason}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-border/60">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Score breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No breakdown was returned for this symbol.</p>
                        ) : (
                          selectedBreakdown.map((factor) => (
                            <div key={String(factor.factor)} className="rounded-md border p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium">{String(factor.factor)}</p>
                                <Badge variant="outline">{formatPercent(factor.score, 0)}</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">{String(factor.note || 'n/a')}</p>
                              {Array.isArray(factor.details) && factor.details.length > 0 && (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                  {factor.details.map((detail: string) => (
                                    <li key={detail}>{detail}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Recommended reasons</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReasonPills reasons={[...(selectedScore.blockers || []), ...(selectedScore.cautions || [])]} />
                      </CardContent>
                    </Card>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Allocation Recommendation
                </CardTitle>
                <CardDescription>Suggested capital allocation under the current portfolio budget.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Mode" value={String(allocation?.mode || 'capped_score_weighted')} />
                <SummaryRow label="Available capital" value={formatMoney(allocation?.available_capital)} />
                <SummaryRow label="Global cap" value={formatMoney(allocation?.global_capital_cap)} />
                <SummaryRow label="Allocated capital" value={formatMoney(allocation?.allocated_capital)} />
                <SummaryRow label="Residual capital" value={formatMoney(allocation?.residual_capital)} />
                <SummaryRow label="Selected count" value={String(allocation?.summary?.allocated_count ?? 0)} />
                <SummaryRow label="Blocked count" value={String(allocation?.summary?.blocked_count ?? 0)} />
                <Separator />
                {Array.isArray(allocation?.allocation_list) && allocation.allocation_list.length > 0 ? (
                  <div className="space-y-3">
                    {allocation.allocation_list.map((row: any) => (
                      <div key={row.symbol} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{row.symbol}</p>
                          <Badge variant="outline">{formatMoney(row.target_notional)}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Qty {formatNumber(row.target_qty)} at {formatMoney(row.price)} | cap {formatPercent(row.target_weight_pct, 1)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Capped by: {Array.isArray(row.capped_by) && row.capped_by.length > 0 ? row.capped_by.join(', ') : 'none'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No allocation recommendation was produced yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Operator Recommendations
                </CardTitle>
                <CardDescription>
                  Ranked selected entries, reduce suggestions, and rotation suggestions where enabled.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Card className="border-border/60">
                  <CardContent className="py-3 space-y-2">
                    <SummaryRow label="No trade" value={noTrade ? 'yes' : 'no'} />
                    <SummaryRow label="Auto allowed" value={autoAllowed ? 'yes' : 'no'} />
                    <SummaryRow label="Selected" value={String(recommendations?.summary?.selected_count ?? 0)} />
                    <SummaryRow label="Reduce suggestions" value={String(recommendations?.summary?.reduce_count ?? 0)} />
                    <SummaryRow label="Rotation suggestions" value={String((recommendations?.rotation_recommendations || []).length)} />
                  </CardContent>
                </Card>

                {(recommendations?.selected || []).length > 0 ? (
                  <RecommendationList title="Selected" items={recommendations.selected} tone="success" />
                ) : (
                  <EmptyState
                    icon={<Sparkles className="h-6 w-6" />}
                    title="No selected opportunities"
                    description="This is an acceptable outcome when the portfolio budget or score threshold is too tight."
                  />
                )}

                {(recommendations?.reduce_recommendations || []).length > 0 && (
                  <RecommendationList title="Reduce recommendations" items={recommendations.reduce_recommendations} tone="warning" />
                )}

                {(recommendations?.rotation_recommendations || []).length > 0 && (
                  <RecommendationList title="Rotation suggestions" items={recommendations.rotation_recommendations} tone="neutral" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Recent Runs
                </CardTitle>
                <CardDescription>Latest persisted portfolio intelligence cycles and their output state.</CardDescription>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <EmptyState
                    icon={<Clock3 className="h-6 w-6" />}
                    title="No runs yet"
                    description="Run the portfolio cycle to create an auditable history."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Started</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Correlation</TableHead>
                          <TableHead>Selected</TableHead>
                          <TableHead>Allocated</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runs.slice(0, 8).map((run: any) => (
                          <TableRow key={run.id}>
                            <TableCell>{run.started_at ? new Date(run.started_at).toLocaleString() : 'n/a'}</TableCell>
                            <TableCell><StatusBadgeFromText text={String(run.status || 'completed')} /></TableCell>
                            <TableCell className="font-mono text-xs">{run.correlation_id || '-'}</TableCell>
                            <TableCell>{run.selected_count ?? 0}</TableCell>
                            <TableCell>{formatMoney(run.allocated_capital)}</TableCell>
                            <TableCell>{run.duration_ms ? `${run.duration_ms} ms` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Why No Trade / Why First
                </CardTitle>
                <CardDescription>Operator-facing explanation of the current ranking outcome.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {noTrade ? (
                  <EmptyState
                    icon={<AlertTriangle className="h-6 w-6" />}
                    title="No trade recommended"
                    description="The portfolio brain found no opportunity that cleared the current threshold and risk budget."
                  />
                ) : (
                  <div className="space-y-3">
                    <SummaryRow label="Why first symbol?" value={topSymbol} />
                    <SummaryRow label="Score threshold" value={formatPercent(rankedSummary?.threshold, 0)} />
                    <SummaryRow label="Auto mode" value={autoAllowed ? 'allowed' : 'approval or hold'} />
                    <SummaryRow label="Budget state" value={String(riskBudget?.state || 'healthy')} />
                    <SummaryRow label="External context" value={String(external?.recommended_bias || 'neutral')} />
                  </div>
                )}

                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">External context</p>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{String(external?.freshness_state || 'unavailable')}</p>
                    <p className="text-muted-foreground">
                      {external?.news_summary?.length
                        ? 'News and macro summaries are available.'
                        : 'No external context summary is currently stored.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  Portfolio intelligence is advisory and allocation-focused only. Final execution still passes through the
                  policy gates, live execution guard, and reconciliation stack.
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Backend Snapshot
              </CardTitle>
              <CardDescription>Direct read of the current portfolio context payload for debugging and trust.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailListCard
                  title="Mode"
                  items={[
                    ['AI mode', String(mode.ai_mode || 'advisor')],
                    ['Trading enabled', String(mode.trading_enabled ?? false)],
                    ['Portfolio IQ enabled', String(mode.portfolio_intelligence_enabled ?? false)],
                    ['Trading mode', tradingModeLabel],
                    ['Venue environment', environmentLabel],
                  ]}
                />
                <DetailListCard
                  title="Risk status"
                  items={[
                    ['Kill switch', String(portfolio?.risk?.kill_switch?.active ?? false)],
                    ['Provider breaker', String(portfolio?.risk?.provider_breaker?.active ?? false)],
                    ['Stale feed', String(portfolio?.risk?.stale_feed_breaker?.active ?? false)],
                    ['Risk reason count', String((riskBudget?.reason_codes || []).length)],
                  ]}
                />
                <DetailListCard
                  title="Portfolio summary"
                  items={[
                    ['Universe size', String((snapshot?.symbol_universe || []).length)],
                    ['Open AI decisions', String(status?.open_ai_decisions ?? 0)],
                    ['Pending cycles', String(status?.pending_ai_cycles ?? 0)],
                    ['Recent rejections', String(status?.recent_rejections ?? 0)],
                  ]}
                />
              </div>
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Show raw effective config</summary>
                <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(effectiveConfig, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function buildPayload(form: ConfigFormState): Record<string, any> {
  return {
    enabled: form.enabled,
    ranking_mode: form.ranking_mode,
    allocation_mode: form.allocation_mode,
    opportunity_score_threshold: numberOrNull(form.opportunity_score_threshold),
    max_total_allocated_pct: numberOrNull(form.max_total_allocated_pct),
    max_symbol_allocated_pct: numberOrNull(form.max_symbol_allocated_pct),
    max_correlated_group_allocated_pct: numberOrNull(form.max_correlated_group_allocated_pct),
    max_simultaneous_new_trades: intOrNull(form.max_simultaneous_new_trades),
    reserve_cash_buffer_pct: numberOrNull(form.reserve_cash_buffer_pct),
    max_open_positions: intOrNull(form.max_open_positions),
    max_open_decision_count: intOrNull(form.max_open_decision_count),
    max_total_notional: numberOrNull(form.max_total_notional),
    max_daily_loss_pct: numberOrNull(form.max_daily_loss_pct),
    max_drawdown_pct: numberOrNull(form.max_drawdown_pct),
    prefer_hold_cash_under_high_uncertainty: form.prefer_hold_cash_under_high_uncertainty,
    reduce_size_under_external_risk: form.reduce_size_under_external_risk,
    require_approval_for_rotation: form.require_approval_for_rotation,
    enable_reduce_recommendations: form.enable_reduce_recommendations,
    enable_rotation_recommendations: form.enable_rotation_recommendations,
    score_weights_json: parseScoreWeights(form.score_weights_json),
    notes: form.notes || null,
  };
}

function validateConfig(form: ConfigFormState): string[] {
  const errors: string[] = [];
  const total = numberOrNull(form.max_total_allocated_pct);
  const symbol = numberOrNull(form.max_symbol_allocated_pct);
  const group = numberOrNull(form.max_correlated_group_allocated_pct);
  const reserve = numberOrNull(form.reserve_cash_buffer_pct);
  const threshold = numberOrNull(form.opportunity_score_threshold);
  const scoreWeightsRaw = form.score_weights_json.trim();

  if (total !== null && symbol !== null && symbol > total && total > 0) {
    errors.push('max_symbol_allocated_pct cannot exceed max_total_allocated_pct.');
  }

  if (total !== null && total <= 0) {
    errors.push('max_total_allocated_pct must be greater than zero.');
  }

  if (symbol !== null && symbol <= 0) {
    errors.push('max_symbol_allocated_pct must be greater than zero.');
  }

  if (group !== null && group <= 0) {
    errors.push('max_correlated_group_allocated_pct must be greater than zero.');
  }

  if (reserve !== null && reserve >= 100) {
    errors.push('reserve_cash_buffer_pct must be below 100.');
  }

  if (threshold !== null && (threshold < 0 || threshold > 100)) {
    errors.push('opportunity_score_threshold must stay within 0 to 100.');
  }

  if (scoreWeightsRaw) {
    try {
      const parsed = JSON.parse(scoreWeightsRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push('score_weights_json must be a JSON object.');
      } else {
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
            errors.push(`score_weights_json.${key} must be a non-negative number.`);
            break;
          }
        }
      }
    } catch {
      errors.push('score_weights_json must be valid JSON.');
    }
  }

  return errors;
}

function parseScoreWeights(value: string): Record<string, number> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('score_weights_json must be a JSON object.');
  }

  return parsed as Record<string, number>;
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value);
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return '-';
  }

  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return '-';
  }

  return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatPercent(value: unknown, digits = 2): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return '-';
  }

  return `${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function badgeTone(level: 'neutral' | 'warning' | 'critical'): string {
  if (level === 'critical') {
    return 'bg-destructive/10 text-destructive border-destructive/20';
  }

  if (level === 'warning') {
    return 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200';
  }

  return 'bg-secondary text-secondary-foreground border-border';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
        </div>
        <div className="rounded-lg border bg-background/80 p-2">{icon}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DetailListCard({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map(([label, value]) => (
          <SummaryRow key={label} label={label} value={value} />
        ))}
      </CardContent>
    </Card>
  );
}

function MiniTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${title}-${index}`}>
                  {row.map((cell) => (
                    <TableCell key={cell}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ActionBadge({ action }: { action?: string | null }) {
  const value = String(action || 'no_trade');
  const tone =
    value === 'buy'
      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-200'
      : value === 'reduce'
        ? 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200'
        : value === 'hold'
          ? 'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-200'
          : 'bg-secondary text-secondary-foreground border-border';

  return <Badge className={tone}>{value}</Badge>;
}

function StatusBadge({
  blocked,
  approvalRequired,
  autoAllowed,
}: {
  blocked?: boolean;
  approvalRequired?: boolean;
  autoAllowed?: boolean;
}) {
  if (blocked) {
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">blocked</Badge>;
  }

  if (autoAllowed) {
    return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-200">auto</Badge>;
  }

  if (approvalRequired) {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200">approval</Badge>;
  }

  return <Badge variant="outline">watch</Badge>;
}

function StatusBadgeFromText({ text }: { text: string }) {
  const normalized = text.toLowerCase();
  if (normalized.includes('block')) {
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">{text}</Badge>;
  }
  if (normalized.includes('constraint') || normalized.includes('paused')) {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-200">{text}</Badge>;
  }
  return <Badge variant="outline">{text}</Badge>;
}

function RecommendationList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<Record<string, any>>;
  tone: 'success' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/5'
        : 'border-border bg-muted/20';

  return (
    <Card className={cn('border', toneClass)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.map((item) => (
          <div key={`${title}-${String(item.symbol || item.from_symbol || item.to_symbol)}`} className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                {String(item.symbol || `${item.from_symbol || '-'} -> ${item.to_symbol || '-'}`)}
              </p>
              <Badge variant="outline">{String(item.selection_status || item.action || 'info')}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              {String(item.reason || item.reasoning_summary || item.comment || 'No additional reason was provided.')}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ReasonPills({ reasons }: { reasons: string[] }) {
  if (!reasons || reasons.length === 0) {
    return <p className="text-sm text-muted-foreground">No explicit cautions.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reasons.slice(0, 8).map((reason) => (
        <Badge key={reason} variant="outline" className="max-w-full whitespace-normal text-left">
          {reason}
        </Badge>
      ))}
    </div>
  );
}
