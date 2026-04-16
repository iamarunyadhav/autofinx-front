import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

type Ledger = {
  id: string;
  currency: string;
  balance: number;
  available?: number;
  locked_balance?: number;
  wallet_type?: string;
  type?: string;
  metadata?: any;
};

type LedgerTransaction = {
  id: string;
  currency?: string;
  amount: number;
  tx_type: string;
  balance_after?: number | null;
  description?: string;
  created_at?: string;
  meta?: any;
};

export type WithdrawalSchedule = {
  id: string;
  workspace_id: string;
  name: string;
  currency: string;
  method: string;
  cadence: 'hourly' | 'daily' | 'weekly' | 'monthly';
  day_of_week?: number | null;
  day_of_month?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  amount_mode: 'fixed' | 'percent_available' | 'excess_over_reserve';
  amount_value: number;
  reserve_amount: number;
  min_payout_amount: number;
  destination_meta?: Record<string, unknown> | null;
  is_active: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
};

export type SweepRule = {
  id: string;
  workspace_id: string;
  name: string;
  bot_id?: string | null;
  provider: string;
  asset_class?: 'CRYPTO' | 'METALS' | null;
  asset_code?: string | null;
  currency: string;
  min_amount: number;
  auto_withdraw_enabled: boolean;
  is_active: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  meta_json?: Record<string, unknown> | null;
};

export type SweepRun = {
  id: string;
  workspace_id: string;
  rule_id?: string | null;
  provider: string;
  currency: string;
  amount: number;
  status: string;
  idempotency_key?: string | null;
  trace_id?: string | null;
  swept_at?: string | null;
  meta_json?: Record<string, unknown> | null;
};

async function apiFetch<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  const parsed = raw ? (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })() : null;

  if (!response.ok) {
    throw new Error(parsed?.message || raw || 'Wallet API error');
  }

  return (parsed ?? {}) as T;
}

export function useBalances(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['balances', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return apiFetch<Ledger[]>(`/workspaces/${workspaceId}/wallet/accounts`);
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useTransactions(workspaceId: string | undefined, currency?: string) {
  return useQuery({
    queryKey: ['transactions', workspaceId, currency],
    queryFn: async () => {
      if (!workspaceId) return [];
      const ledger = await apiFetch<any>(`/workspaces/${workspaceId}/ledger`);
      const ledgerCurrency = String(ledger?.meta?.currency || 'USD').toUpperCase();
      const rows = (ledger?.transactions || []).map((tx: any) => ({
        id: tx.id,
        currency: String(tx.meta?.currency || ledgerCurrency),
        amount: Number(tx.amount || 0),
        tx_type: String(tx.type || 'unknown'),
        balance_after: null,
        description: tx.meta?.description || tx.meta?.source || '',
        created_at: tx.occurred_at || tx.created_at,
        meta: tx.meta || {},
      })) as LedgerTransaction[];

      return currency ? rows.filter((tx) => String(tx.meta?.currency || '').toUpperCase() === currency.toUpperCase()) : rows;
    },
    enabled: !!workspaceId,
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      currency,
      amount,
      gateway,
      environment,
      description,
    }: {
      workspaceId: string;
      currency: string;
      amount: number;
      gateway: string;
      environment?: 'sandbox' | 'live';
      description?: string;
    }) => {
      const data = await apiFetch<any>('/wallet/deposit/intent', 'POST', {
        workspace_id: workspaceId,
        currency,
        amount,
        gateway,
        environment,
        description,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['balances', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.workspaceId] });

      const checkoutUrl = data?.checkout?.checkout_url;
      toast({
        title: 'Deposit intent created',
        description: checkoutUrl
          ? `Continue payment in secure ${variables.gateway.toUpperCase()} checkout`
          : `Payment reference created: ${data?.reference || data?.payment_id || 'n/a'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Deposit failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      currency,
      amount,
      method,
      description,
      destinationMeta,
    }: {
      workspaceId: string;
      currency: string;
      amount: number;
      method: string;
      description?: string;
      destinationMeta?: Record<string, unknown>;
    }) => {
      return apiFetch<any>('/wallet/withdraw/request', 'POST', {
        workspace_id: workspaceId,
        currency,
        amount,
        method,
        destination_meta: destinationMeta || {},
        note: description,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['balances', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.workspaceId] });
      toast({
        title: 'Withdrawal queued',
        description: `${variables.amount} ${variables.currency} via ${variables.method}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Withdrawal failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useTransfer() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_payload: {
      workspaceId: string;
      fromCurrency: string;
      toCurrency: string;
      amount: number;
    }) => ({ success: true }),
    onSuccess: () => {
      toast({
        title: 'Transfer not configured',
        description: 'Use provider balances sync for internal/provider movement.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Transfer failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useWithdrawalSchedules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['withdrawal-schedules', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return apiFetch<WithdrawalSchedule[]>(`/wallet/withdraw/schedules?workspace_id=${encodeURIComponent(workspaceId)}`);
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useCreateWithdrawalSchedule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Partial<WithdrawalSchedule>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return apiFetch<WithdrawalSchedule>('/wallet/withdraw/schedules', 'POST', {
        workspace_id: workspaceId,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-schedules', workspaceId] });
      toast({ title: 'Auto-withdraw schedule created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Schedule create failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateWithdrawalSchedule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<WithdrawalSchedule> }) => {
      return apiFetch<WithdrawalSchedule>(`/wallet/withdraw/schedules/${id}`, 'PATCH', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-schedules', workspaceId] });
      toast({ title: 'Schedule updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Schedule update failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteWithdrawalSchedule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => apiFetch(`/wallet/withdraw/schedules/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-schedules', workspaceId] });
      toast({ title: 'Schedule deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunWithdrawalSchedule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => apiFetch(`/wallet/withdraw/schedules/${id}/run-now`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-schedules', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['balances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      toast({ title: 'Scheduled withdrawal queued' });
    },
    onError: (error: Error) => {
      toast({ title: 'Run-now failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSweepRules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['sweep-rules', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return apiFetch<SweepRule[]>(`/wallet/sweep/rules?workspace_id=${encodeURIComponent(workspaceId)}`);
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}

export function useCreateSweepRule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Partial<SweepRule>) => {
      if (!workspaceId) throw new Error('Workspace required');
      return apiFetch<SweepRule>('/wallet/sweep/rules', 'POST', {
        workspace_id: workspaceId,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sweep-rules', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sweep-runs', workspaceId] });
      toast({ title: 'Sweep rule saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Sweep rule failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateSweepRule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<SweepRule> }) => {
      return apiFetch<SweepRule>(`/wallet/sweep/rules/${id}`, 'PATCH', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sweep-rules', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sweep-runs', workspaceId] });
      toast({ title: 'Sweep rule updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Sweep update failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteSweepRule(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => apiFetch(`/wallet/sweep/rules/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sweep-rules', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sweep-runs', workspaceId] });
      toast({ title: 'Sweep rule deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRunSweep(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload?: { rule_id?: string; provider?: string; currency?: string }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return apiFetch<any>('/wallet/sweep/run', 'POST', {
        workspace_id: workspaceId,
        ...(payload || {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sweep-rules', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sweep-runs', workspaceId] });
      toast({ title: 'Sweep execution queued/completed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Sweep failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSweepRuns(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['sweep-runs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return apiFetch<SweepRun[]>(`/wallet/sweep/runs?workspace_id=${encodeURIComponent(workspaceId)}&limit=100`);
    },
    enabled: !!workspaceId,
    refetchInterval: 10000,
  });
}
