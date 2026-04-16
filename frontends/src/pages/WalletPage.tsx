import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  useBalances,
  useTransactions,
  useWithdrawalSchedules,
  useCreateWithdrawalSchedule,
  useUpdateWithdrawalSchedule,
  useRunWithdrawalSchedule,
  useSweepRules,
  useCreateSweepRule,
  useUpdateSweepRule,
  useDeleteSweepRule,
  useRunSweep,
  useSweepRuns,
} from '@/hooks/useWallet';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { DepositModal } from '@/components/wallet/DepositModal';
import { WithdrawModal } from '@/components/wallet/WithdrawModal';
import { TransferModal } from '@/components/wallet/TransferModal';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { PayoutTimeline } from '@/components/wallet/PayoutTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Wallet, TrendingUp } from 'lucide-react';
import { StakingPanel } from '@/components/defi/StakingPanel';
import { useNavigate } from 'react-router-dom';

export default function WalletPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data: balances, isLoading: balancesLoading } = useBalances(currentWorkspace?.id);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(currentWorkspace?.id);
  const { data: withdrawalSchedules = [] } = useWithdrawalSchedules(currentWorkspace?.id);
  const createWithdrawalSchedule = useCreateWithdrawalSchedule(currentWorkspace?.id);
  const updateWithdrawalSchedule = useUpdateWithdrawalSchedule(currentWorkspace?.id);
  const runWithdrawalSchedule = useRunWithdrawalSchedule(currentWorkspace?.id);
  const { data: sweepRules = [] } = useSweepRules(currentWorkspace?.id);
  const { data: sweepRuns = [] } = useSweepRuns(currentWorkspace?.id);
  const createSweepRule = useCreateSweepRule(currentWorkspace?.id);
  const updateSweepRule = useUpdateSweepRule(currentWorkspace?.id);
  const deleteSweepRule = useDeleteSweepRule(currentWorkspace?.id);
  const runSweep = useRunSweep(currentWorkspace?.id);
  const latestPayout = useMemo(() => (transactions || []).find((t) => t.meta?.payment_id), [transactions]);
  
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [scheduleName, setScheduleName] = useState('Weekly Profit Withdraw');
  const [scheduleCurrency, setScheduleCurrency] = useState('USD');
  const [scheduleMethod, setScheduleMethod] = useState('bank_transfer');
  const [scheduleCadence, setScheduleCadence] = useState<'weekly' | 'daily' | 'monthly'>('weekly');
  const [scheduleDow, setScheduleDow] = useState('5');
  const [scheduleHour, setScheduleHour] = useState('18');
  const [scheduleMinute, setScheduleMinute] = useState('0');
  const [scheduleAmountMode, setScheduleAmountMode] = useState<'fixed' | 'percent_available' | 'excess_over_reserve'>('percent_available');
  const [scheduleAmountValue, setScheduleAmountValue] = useState('20');
  const [scheduleReserveAmount, setScheduleReserveAmount] = useState('0');
  const [scheduleMinPayout, setScheduleMinPayout] = useState('10');
  const [sweepRuleName, setSweepRuleName] = useState('Provider -> Cash Sweep');
  const [sweepProvider, setSweepProvider] = useState('metal_broker');
  const [sweepCurrency, setSweepCurrency] = useState('USD');
  const [sweepMinAmount, setSweepMinAmount] = useState('10');
  const [sweepAutoWithdraw, setSweepAutoWithdraw] = useState(false);
  const [sweepAssetClass, setSweepAssetClass] = useState<'CRYPTO' | 'METALS'>('METALS');

  // Align default currency with first balance when loaded
  useEffect(() => {
    if (!balancesLoading && balances && balances.length > 0) {
      setSelectedCurrency((current) => current ?? (balances[0].currency || 'USD'));
    }
  }, [balancesLoading, balances]);

  const totalBalance = balances?.reduce((sum, b) => {
    return sum + (b.balance || 0);
  }, 0) || 0;

  const availableTotal = balances?.reduce((sum, b) => sum + (b.available ?? b.balance ?? 0), 0) || 0;
  const lockedTotal = balances?.reduce((sum, b) => {
    const available = b.available ?? b.balance ?? 0;
    const total = b.balance ?? 0;
    return sum + Math.max(0, total - available);
  }, 0) || 0;

  const handleDeposit = (currency: string) => {
    setSelectedCurrency(currency);
    setDepositOpen(true);
  };

  const handleWithdraw = (currency: string) => {
    setSelectedCurrency(currency);
    setWithdrawOpen(true);
  };

  const handleCreateSchedule = async () => {
    if (!currentWorkspace?.id) return;
    await createWithdrawalSchedule.mutateAsync({
      name: scheduleName,
      currency: scheduleCurrency,
      method: scheduleMethod,
      cadence: scheduleCadence,
      day_of_week: scheduleCadence === 'weekly' ? Number(scheduleDow) : null,
      day_of_month: scheduleCadence === 'monthly' ? Number(scheduleDow) : null,
      hour: Number(scheduleHour),
      minute: Number(scheduleMinute),
      timezone: 'Asia/Colombo',
      amount_mode: scheduleAmountMode,
      amount_value: Number(scheduleAmountValue),
      reserve_amount: Number(scheduleReserveAmount),
      min_payout_amount: Number(scheduleMinPayout),
      destination_meta: {},
      is_active: true,
    });
  };

  const handleCreateSweepRule = async () => {
    if (!currentWorkspace?.id) return;
    await createSweepRule.mutateAsync({
      name: sweepRuleName,
      provider: sweepProvider,
      asset_class: sweepAssetClass,
      currency: sweepCurrency,
      min_amount: Number(sweepMinAmount),
      auto_withdraw_enabled: sweepAutoWithdraw,
      is_active: true,
    });
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
            <p className="text-muted-foreground mt-1">
              Manage your portfolio balances and transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/billing')}>
              Payment Settings
            </Button>
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Transfer
            </Button>
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
              Withdraw
            </Button>
            <Button onClick={() => setDepositOpen(true)}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Deposit
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Credit/Debit deposits are handled via secure hosted checkout (Stripe/PayHere).
              Card number is not collected in AutoFinX UI for PCI compliance.
            </p>
          </CardContent>
        </Card>

        {/* Portfolio Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {balances?.length || 0} currencies
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">24h Change</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">+$1,234.56</div>
              <p className="text-xs text-muted-foreground mt-1">+2.34%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${availableTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ready to trade</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Locked Balance</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${lockedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">In open orders</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Balance Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Currency Balances</h2>
          {balancesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : balances && balances.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {balances.map((balance) => (
                <BalanceCard
                  key={balance.id}
                  balance={balance}
                  onDeposit={() => handleDeposit(balance.currency)}
                  onWithdraw={() => handleWithdraw(balance.currency)}
                />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No balances found</p>
                <Button onClick={() => setDepositOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Make First Deposit
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Transaction History */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
            <TransactionHistory 
              transactions={transactions || []} 
              isLoading={transactionsLoading} 
            />
          </div>
          <div className="md:col-span-1">
            <PayoutTimeline
              reference={latestPayout?.meta?.payment_id}
              status={latestPayout?.tx_type === 'withdrawal' ? 'pending' : latestPayout?.tx_type}
              events={
                latestPayout
                  ? [
                      {
                        title: 'Payout requested',
                        body: latestPayout.description || 'Awaiting provider confirmation',
                        status: 'pending',
                        at: latestPayout.created_at || undefined,
                      },
                    ]
                  : []
              }
            />
          </div>
        </div>

        {/* Staking / DeFi */}
        <div className="grid gap-4 md:grid-cols-1">
          <StakingPanel />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Auto Withdraw Scheduler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={scheduleCurrency} onValueChange={setScheduleCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(balances || []).map((row) => (
                      <SelectItem key={row.currency} value={row.currency}>{row.currency}</SelectItem>
                    ))}
                    {(!balances || balances.length === 0) && <SelectItem value="USD">USD</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={scheduleMethod} onValueChange={setScheduleMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="payoneer">Payoneer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe">Stripe/Card</SelectItem>
                    <SelectItem value="payhere">PayHere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Cadence</Label>
                <Select value={scheduleCadence} onValueChange={(v: 'weekly' | 'daily' | 'monthly') => setScheduleCadence(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{scheduleCadence === 'monthly' ? 'Day of Month' : 'Day of Week'}</Label>
                <Input type="number" min={scheduleCadence === 'monthly' ? 1 : 0} max={scheduleCadence === 'monthly' ? 28 : 6} value={scheduleDow} onChange={(e) => setScheduleDow(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hour</Label>
                <Input type="number" min={0} max={23} value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Minute</Label>
                <Input type="number" min={0} max={59} value={scheduleMinute} onChange={(e) => setScheduleMinute(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Amount Mode</Label>
                <Select value={scheduleAmountMode} onValueChange={(v: 'fixed' | 'percent_available' | 'excess_over_reserve') => setScheduleAmountMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percent_available">% of Available</SelectItem>
                    <SelectItem value="excess_over_reserve">Excess over Reserve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Value</Label>
                <Input type="number" min={0} step="any" value={scheduleAmountValue} onChange={(e) => setScheduleAmountValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Reserve Amount</Label>
                <Input type="number" min={0} step="any" value={scheduleReserveAmount} onChange={(e) => setScheduleReserveAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min Payout</Label>
                <Input type="number" min={0} step="any" value={scheduleMinPayout} onChange={(e) => setScheduleMinPayout(e.target.value)} />
              </div>
            </div>

            <Button onClick={handleCreateSchedule} disabled={createWithdrawalSchedule.isPending || !currentWorkspace?.id}>
              {createWithdrawalSchedule.isPending ? 'Creating...' : 'Create Auto Withdraw Schedule'}
            </Button>

            <div className="space-y-2">
              {withdrawalSchedules.length === 0 && (
                <p className="text-sm text-muted-foreground">No schedules yet.</p>
              )}
              {withdrawalSchedules.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      <Badge variant={row.is_active ? 'default' : 'secondary'}>
                        {row.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.cadence} | {row.method} | next: {row.next_run_at ? new Date(row.next_run_at).toLocaleString() : 'n/a'} | last: {row.last_status || 'n/a'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => runWithdrawalSchedule.mutate(row.id)}>
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateWithdrawalSchedule.mutate({ id: row.id, payload: { is_active: !row.is_active } })}
                    >
                      {row.is_active ? 'Pause' : 'Resume'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider to Cash Sweep Bridge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={sweepRuleName} onChange={(e) => setSweepRuleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={sweepProvider} onValueChange={setSweepProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metal_broker">Metals Broker</SelectItem>
                    <SelectItem value="binance">Binance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asset Class</Label>
                <Select value={sweepAssetClass} onValueChange={(v: 'CRYPTO' | 'METALS') => setSweepAssetClass(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="METALS">Metals</SelectItem>
                    <SelectItem value="CRYPTO">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={sweepCurrency} onValueChange={setSweepCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(balances || []).map((row) => (
                      <SelectItem key={row.currency} value={row.currency}>{row.currency}</SelectItem>
                    ))}
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LKR">LKR</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min Sweep Amount</Label>
                <Input type="number" min={0} step="any" value={sweepMinAmount} onChange={(e) => setSweepMinAmount(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                <Label>Auto Withdraw after Sweep</Label>
                <Switch checked={sweepAutoWithdraw} onCheckedChange={setSweepAutoWithdraw} />
              </div>
              <Button onClick={handleCreateSweepRule} disabled={createSweepRule.isPending || !currentWorkspace?.id}>
                {createSweepRule.isPending ? 'Saving...' : 'Save Sweep Rule'}
              </Button>
              <Button variant="outline" onClick={() => runSweep.mutate({ provider: sweepProvider, currency: sweepCurrency })} disabled={runSweep.isPending}>
                {runSweep.isPending ? 'Running...' : 'Run Sweep Now'}
              </Button>
            </div>

            <div className="space-y-2">
              {sweepRules.length === 0 && <p className="text-sm text-muted-foreground">No sweep rules yet.</p>}
              {sweepRules.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rule.provider} | {rule.asset_class || 'ALL'} | {rule.currency} | min {rule.min_amount}
                      {' '}| last {rule.last_status || 'n/a'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => runSweep.mutate({ rule_id: rule.id })}>
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSweepRule.mutate({ id: rule.id, payload: { is_active: !rule.is_active } })}
                    >
                      {rule.is_active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteSweepRule.mutate(rule.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Sweep History</h3>
              {sweepRuns.length === 0 && <p className="text-sm text-muted-foreground">No sweep runs yet.</p>}
              {sweepRuns.slice(0, 8).map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm">
                  <span>{run.provider} {run.currency} {run.amount}</span>
                  <Badge variant={run.status === 'succeeded' ? 'default' : 'secondary'}>{run.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <DepositModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        defaultCurrency={selectedCurrency}
        workspaceId={currentWorkspace?.id}
      />
      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        defaultCurrency={selectedCurrency}
        workspaceId={currentWorkspace?.id}
        balances={balances || []}
      />
      <TransferModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        workspaceId={currentWorkspace?.id}
        balances={balances || []}
      />
    </AppShell>
  );
}
