import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, Plus, Settings, Power, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRiskProfiles, useSystemSettings, useCreateRiskProfile, useUpdateRiskProfile, useGlobalKillSwitch } from "@/hooks/useRisk";
import {
  useArmManagedPosition,
  useEvaluateManagedPosition,
  useExitEvents,
  useExitPolicy,
  useFlattenManagedPosition,
  useManagedExitPositions,
  usePauseManagedPosition,
  useResumeManagedPosition,
  useUpdateExitPolicy,
} from "@/hooks/useExitAutomation";
import { RiskProfileCard } from "@/components/risk/RiskProfileCard";
import { RiskProfileEditor } from "@/components/risk/RiskProfileEditor";
import { KillSwitchControl } from "@/components/risk/KillSwitchControl";
import { AppShell } from "@/components/layout";

export default function RiskPage() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { data: riskProfiles, isLoading: profilesLoading } = useRiskProfiles(currentWorkspace?.id);
  const { data: systemSettings, isLoading: settingsLoading } = useSystemSettings(currentWorkspace?.id);
  const { data: exitPolicyData, isLoading: exitPolicyLoading } = useExitPolicy(currentWorkspace?.id);
  const { data: managedExitPositions, isLoading: managedExitPositionsLoading } = useManagedExitPositions(currentWorkspace?.id);
  const { data: exitEvents, isLoading: exitEventsLoading } = useExitEvents(currentWorkspace?.id);
  const createProfile = useCreateRiskProfile();
  const updateProfile = useUpdateRiskProfile();
  const killSwitch = useGlobalKillSwitch();
  const updateExitPolicy = useUpdateExitPolicy(currentWorkspace?.id);
  const armManagedPosition = useArmManagedPosition(currentWorkspace?.id);
  const pauseManagedPosition = usePauseManagedPosition(currentWorkspace?.id);
  const resumeManagedPosition = useResumeManagedPosition(currentWorkspace?.id);
  const evaluateManagedPosition = useEvaluateManagedPosition(currentWorkspace?.id);
  const flattenManagedPosition = useFlattenManagedPosition(currentWorkspace?.id);
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [exitPolicyForm, setExitPolicyForm] = useState({
    default_stop_loss_pct: '',
    default_take_profit_pct: '',
    default_time_stop_minutes: '',
    trailing_stop_enabled: false,
    trailing_stop_pct: '',
    partial_take_profit_enabled: false,
    partial_take_profit_levels: '',
    partial_take_profit_sizes: '',
    break_even_after_partial: false,
    emergency_exit_on_breaker: false,
    force_exit_on_pause: false,
    force_exit_on_max_daily_loss: false,
    minimum_position_value_for_partial: '',
    native_protection_mode: 'disabled',
  });

  const handleCreateProfile = () => {
    setEditingProfile(null);
    setIsEditorOpen(true);
  };

  const handleEditProfile = (profile: any) => {
    setEditingProfile(profile);
    setIsEditorOpen(true);
  };

  const handleSaveProfile = async (data: any) => {
    if (!currentWorkspace?.id) return;
    
    try {
      if (editingProfile) {
        await updateProfile.mutateAsync({
          profileId: editingProfile.id,
          workspaceId: currentWorkspace.id,
          updates: data
        });
      } else {
        await createProfile.mutateAsync({
          workspaceId: currentWorkspace.id,
          name: data.name,
          limits: {
            is_default: data.is_default,
            max_position_percent: data.max_position_percent,
            max_daily_loss_percent: data.max_daily_loss_percent,
            max_drawdown_percent: data.max_drawdown_percent,
            max_leverage: data.max_leverage,
            stop_loss_percent: data.stop_loss_percent,
            take_profit_percent: data.take_profit_percent,
            slippage_tolerance: data.slippage_tolerance,
          }
        });
      }
      setIsEditorOpen(false);
      setEditingProfile(null);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleKillSwitch = async (enabled: boolean) => {
    if (!currentWorkspace?.id) return;
    
    await killSwitch.mutateAsync({
      workspaceId: currentWorkspace.id,
      enabled
    });
  };

  useEffect(() => {
    const policy = exitPolicyData?.policy;
    if (!policy) return;

    setExitPolicyForm({
      default_stop_loss_pct: String(policy.default_stop_loss_pct ?? ''),
      default_take_profit_pct: String(policy.default_take_profit_pct ?? ''),
      default_time_stop_minutes: String(policy.default_time_stop_minutes ?? ''),
      trailing_stop_enabled: !!policy.trailing_stop_enabled,
      trailing_stop_pct: String(policy.trailing_stop_pct ?? ''),
      partial_take_profit_enabled: !!policy.partial_take_profit_enabled,
      partial_take_profit_levels: (policy.partial_take_profit_levels || []).join(','),
      partial_take_profit_sizes: (policy.partial_take_profit_sizes || []).join(','),
      break_even_after_partial: !!policy.break_even_after_partial,
      emergency_exit_on_breaker: !!policy.emergency_exit_on_breaker,
      force_exit_on_pause: !!policy.force_exit_on_pause,
      force_exit_on_max_daily_loss: !!policy.force_exit_on_max_daily_loss,
      minimum_position_value_for_partial: String(policy.minimum_position_value_for_partial ?? ''),
      native_protection_mode: policy.native_protection_mode || 'disabled',
    });
  }, [exitPolicyData]);

  const handleSaveExitPolicy = async () => {
    if (!currentWorkspace?.id) return;

    await updateExitPolicy.mutateAsync({
      default_stop_loss_pct: exitPolicyForm.default_stop_loss_pct || null,
      default_take_profit_pct: exitPolicyForm.default_take_profit_pct || null,
      default_time_stop_minutes: exitPolicyForm.default_time_stop_minutes || null,
      trailing_stop_enabled: exitPolicyForm.trailing_stop_enabled,
      trailing_stop_pct: exitPolicyForm.trailing_stop_pct || null,
      partial_take_profit_enabled: exitPolicyForm.partial_take_profit_enabled,
      partial_take_profit_levels: exitPolicyForm.partial_take_profit_levels
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value) && value > 0),
      partial_take_profit_sizes: exitPolicyForm.partial_take_profit_sizes
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value) && value > 0),
      break_even_after_partial: exitPolicyForm.break_even_after_partial,
      emergency_exit_on_breaker: exitPolicyForm.emergency_exit_on_breaker,
      force_exit_on_pause: exitPolicyForm.force_exit_on_pause,
      force_exit_on_max_daily_loss: exitPolicyForm.force_exit_on_max_daily_loss,
      minimum_position_value_for_partial: exitPolicyForm.minimum_position_value_for_partial || null,
      native_protection_mode: exitPolicyForm.native_protection_mode,
    });
  };

  const isLoading = profilesLoading || settingsLoading;
  const tradingEnabled = systemSettings?.global_trading_enabled ?? true;

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Risk Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure risk profiles, limits, and emergency controls
              </p>
            </div>
            <Button onClick={handleCreateProfile} className="gap-2">
              <Plus className="h-4 w-4" />
              New Risk Profile
            </Button>
          </div>
        </motion.div>

        {/* Kill Switch Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <KillSwitchControl
            enabled={tradingEnabled}
            onToggle={handleKillSwitch}
            isLoading={killSwitch.isPending}
          />
        </motion.div>

        {/* Risk Overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Profiles</p>
                  <p className="text-2xl font-bold text-foreground">
                    {riskProfiles?.length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Max Concurrent</p>
                  <p className="text-2xl font-bold text-foreground">
                    {systemSettings?.max_concurrent_strategies || 10}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Trading Status</p>
                  <p className="text-2xl font-bold text-foreground">
                    {tradingEnabled ? 'Active' : 'Halted'}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  tradingEnabled ? 'bg-green-500/10' : 'bg-destructive/10'
                }`}>
                  <Power className={`h-5 w-5 ${
                    tradingEnabled ? 'text-green-500' : 'text-destructive'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                  <p className="text-2xl font-bold text-foreground">
                    {systemSettings?.maintenance_mode ? 'On' : 'Off'}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  systemSettings?.maintenance_mode ? 'bg-yellow-500/10' : 'bg-muted'
                }`}>
                  <Settings className={`h-5 w-5 ${
                    systemSettings?.maintenance_mode ? 'text-yellow-500' : 'text-muted-foreground'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Profiles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Risk Profiles
              </CardTitle>
              <CardDescription>
                Define position limits, loss thresholds, and trading constraints
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : riskProfiles && riskProfiles.length > 0 ? (
                <div className="space-y-4">
                  {riskProfiles.map((profile: any) => (
                    <RiskProfileCard
                      key={profile.id}
                      profile={profile}
                      onEdit={() => handleEditProfile(profile)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No Risk Profiles
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first risk profile to define trading limits
                  </p>
                  <Button onClick={handleCreateProfile} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Risk Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-8"
        >
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Universal Exit Policy</CardTitle>
              <CardDescription>
                Configure workspace-wide live exit defaults for stop loss, take profit, trailing stop, time-stop, and force-exit behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Default Stop Loss %</p>
                  <Input value={exitPolicyForm.default_stop_loss_pct} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, default_stop_loss_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Default Take Profit %</p>
                  <Input value={exitPolicyForm.default_take_profit_pct} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, default_take_profit_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Time Stop Minutes</p>
                  <Input value={exitPolicyForm.default_time_stop_minutes} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, default_time_stop_minutes: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Trailing Stop %</p>
                  <Input value={exitPolicyForm.trailing_stop_pct} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, trailing_stop_pct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Partial TP Levels</p>
                  <Input value={exitPolicyForm.partial_take_profit_levels} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, partial_take_profit_levels: e.target.value }))} placeholder="2,4,6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Partial TP Sizes</p>
                  <Input value={exitPolicyForm.partial_take_profit_sizes} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, partial_take_profit_sizes: e.target.value }))} placeholder="25,25,50" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Min Position Value for Partial</p>
                  <Input value={exitPolicyForm.minimum_position_value_for_partial} onChange={(e) => setExitPolicyForm((prev) => ({ ...prev, minimum_position_value_for_partial: e.target.value }))} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Enable Trailing Stop</p>
                    <p className="text-sm text-muted-foreground">Ratchet protective stop as price moves favorably.</p>
                  </div>
                  <Switch checked={exitPolicyForm.trailing_stop_enabled} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, trailing_stop_enabled: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Enable Partial Take Profit</p>
                    <p className="text-sm text-muted-foreground">Consume partial levels one at a time.</p>
                  </div>
                  <Switch checked={exitPolicyForm.partial_take_profit_enabled} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, partial_take_profit_enabled: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Break Even After Partial</p>
                    <p className="text-sm text-muted-foreground">Tighten stop to entry after first partial fill.</p>
                  </div>
                  <Switch checked={exitPolicyForm.break_even_after_partial} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, break_even_after_partial: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Emergency Exit On Breaker</p>
                    <p className="text-sm text-muted-foreground">Flatten when severe operational breaker hits.</p>
                  </div>
                  <Switch checked={exitPolicyForm.emergency_exit_on_breaker} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, emergency_exit_on_breaker: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Force Exit On Pause</p>
                    <p className="text-sm text-muted-foreground">Close managed positions when pause policy is active.</p>
                  </div>
                  <Switch checked={exitPolicyForm.force_exit_on_pause} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, force_exit_on_pause: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">Force Exit On Daily Loss</p>
                    <p className="text-sm text-muted-foreground">Flatten when workspace daily loss threshold is breached.</p>
                  </div>
                  <Switch checked={exitPolicyForm.force_exit_on_max_daily_loss} onCheckedChange={(checked) => setExitPolicyForm((prev) => ({ ...prev, force_exit_on_max_daily_loss: checked }))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {exitPolicyLoading ? 'Loading exit policy...' : `Native protection mode: ${exitPolicyForm.native_protection_mode}`}
                </div>
                <Button onClick={handleSaveExitPolicy} disabled={updateExitPolicy.isPending}>
                  {updateExitPolicy.isPending ? 'Saving...' : 'Save Exit Policy'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Managed Positions</CardTitle>
              <CardDescription>
                Review exit automation state, warnings, and operator actions for active spot positions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {managedExitPositionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div key={item} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : managedExitPositions && managedExitPositions.length > 0 ? (
                <div className="space-y-4">
                  {managedExitPositions.map((position) => (
                    <div key={position.position_id} className="rounded-lg border border-border/60 p-4 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{position.symbol}</p>
                            <Badge variant={position.managed_mode === 'review_required' ? 'destructive' : 'secondary'}>
                              {position.managed_mode}
                            </Badge>
                            {position.blocked_reason ? <Badge variant="outline">{position.blocked_reason}</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Qty {position.position?.qty ?? position.position?.quantity ?? '0'} | SL {position.stop_loss_price ?? '-'} | TP {position.take_profit_price ?? '-'} | Trailing {position.trailing_stop_price ?? '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last evaluated {position.last_evaluated_at ?? 'never'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => evaluateManagedPosition.mutate({ positionId: position.position_id })}>Evaluate</Button>
                          {position.managed_mode !== 'armed' ? (
                            <Button size="sm" variant="outline" onClick={() => armManagedPosition.mutate({ positionId: position.position_id })}>Arm</Button>
                          ) : null}
                          {position.managed_mode === 'paused' ? (
                            <Button size="sm" variant="outline" onClick={() => resumeManagedPosition.mutate({ positionId: position.position_id })}>Resume</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => pauseManagedPosition.mutate({ positionId: position.position_id, payload: { reason: 'operator_pause' } })}>Pause</Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => flattenManagedPosition.mutate({ positionId: position.position_id })}>
                            Flatten
                          </Button>
                        </div>
                      </div>
                      {position.effective_state === 'review_required' || position.uncertainty_reason ? (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                          {position.uncertainty_reason || 'This position is unmanaged until an operator arms exit automation.'}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No managed positions found for this workspace.</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Recent Exit Events</CardTitle>
              <CardDescription>
                Audit trail for exit arming, triggers, submissions, fills, blocks, and operator actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exitEventsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : exitEvents && exitEvents.length > 0 ? (
                <div className="space-y-3">
                  {exitEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{event.symbol} · {event.event_type}</p>
                          <p className="text-sm text-muted-foreground">{event.payload_json?.message || event.payload_json?.reason || 'Managed exit event recorded.'}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{event.severity}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{event.occurred_at}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No exit events recorded yet.</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Profile Editor Dialog */}
        <RiskProfileEditor
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          profile={editingProfile}
          onSave={handleSaveProfile}
          isSaving={createProfile.isPending || updateProfile.isPending}
        />
        </div>
      </div>
    </AppShell>
  );
}
