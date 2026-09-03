import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// The real `payment_methods` table (see
// database/migrations/2025_12_31_114501_create_domain_tables.php +
// app/Models/PaymentMethod.php) is just {id, workspace_id, type, details(json)}
// — it has no gateway/token/last_four/brand/expiry_month/expiry_year/metadata/
// is_default columns at all. The stale Supabase-generated type this hook used
// to import claimed those as real top-level columns; inserting with them
// (as the previous code did) hits TableController::handle()'s generic
// `PaymentMethod::create($data)` and fails at the SQL layer with an unknown
// column error — this feature was actually broken, not just mistyped. Fixed
// by packing/unpacking those fields into the real `details` JSON column,
// with `type` holding the gateway key (matching how Order.meta/Notification.
// content are used as JSON payload columns elsewhere in this codebase).
//
// This hook also used to go through client.ts's `supabase.from(...)` shim,
// which tracks its own separate session token (localStorage key
// 'autofinx_token') that nothing in this app's real login flow (useAuth.tsx,
// key 'auth_token') ever populates — every request through it was sent with
// no Authorization header at all, so every call here always 401'd for a real
// logged-in user regardless of the payload shape. Fixed by talking to the
// same backend `/table/payment_methods` proxy directly with the real session
// token, replicating exactly the request shape TableController::handle()
// expects (filters/order/data/single, matching what the shim already sent).
export interface PaymentMethod {
  id: string;
  workspace_id: string;
  gateway: 'stripe' | 'paypal' | 'payoneer' | 'bank_transfer' | 'payhere' | string;
  brand: string | null;
  last_four: string | null;
  token: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface PaymentMethodRow {
  id: string;
  workspace_id: string;
  type: string;
  details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

function rowToPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  const details = row.details || {};
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    gateway: row.type as PaymentMethod['gateway'],
    brand: details.brand ?? null,
    last_four: details.last_four ?? null,
    token: details.token ?? null,
    expiry_month: details.expiry_month ?? null,
    expiry_year: details.expiry_year ?? null,
    is_default: details.is_default ?? false,
    metadata: details.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function tableRequest(
  method: 'get' | 'post' | 'patch' | 'delete',
  opts: {
    filters?: Record<string, unknown>;
    order?: { column: string; direction: 'asc' | 'desc' };
    data?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<any> {
  const body: Record<string, unknown> = {
    filters: opts.filters ?? {},
    order: opts.order ?? null,
    data: opts.data,
    single: opts.single ?? false,
  };

  let url = `${API_BASE}/table/payment_methods`;
  let fetchBody: string | undefined;
  if (method === 'get' || method === 'delete') {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value === undefined) return;
      params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });
    url += `?${params.toString()}`;
  } else {
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: await authHeaders(),
    body: fetchBody,
  });

  const raw = await res.text();
  const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

  if (!res.ok) {
    throw new Error(parsed?.message || raw || 'Payment methods request failed');
  }

  return parsed;
}

export function usePaymentMethods(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['payment-methods', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await tableRequest('get', {
        filters: { workspace_id: workspaceId },
        order: { column: 'created_at', direction: 'desc' },
      });
      return ((data as PaymentMethodRow[]) || []).map(rowToPaymentMethod);
    },
    enabled: !!workspaceId,
  });
}

interface AddPaymentMethodInput {
  workspaceId: string;
  gateway: PaymentMethod['gateway'];
  token?: string;
  last_four?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  metadata?: Record<string, unknown>;
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AddPaymentMethodInput) => {
      const data = await tableRequest('post', {
        data: {
          workspace_id: input.workspaceId,
          type: input.gateway,
          details: {
            brand: input.brand ?? null,
            last_four: input.last_four ?? null,
            token: input.token ?? null,
            expiry_month: input.expiry_month ?? null,
            expiry_year: input.expiry_year ?? null,
            is_default: false,
            metadata: input.metadata ?? {},
          },
        },
      });
      return { data, workspaceId: input.workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({
        title: 'Payment method added',
        description: 'Credentials saved securely',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to save payment method',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      // `is_default` lives inside the `details` JSON blob, not a real column
      // the generic table proxy can filter/update directly — read every
      // method for this workspace and rewrite each one's `details` blob
      // in turn (unset the old default(s), set the new one).
      const rows = (await tableRequest('get', { filters: { workspace_id: workspaceId } })) as PaymentMethodRow[];

      for (const row of rows || []) {
        const shouldBeDefault = row.id === id;
        const currentlyDefault = Boolean(row.details?.is_default);
        if (currentlyDefault === shouldBeDefault) continue;

        await tableRequest('patch', {
          filters: { id: row.id },
          data: { details: { ...(row.details || {}), is_default: shouldBeDefault } },
        });
      }

      return { workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({ title: 'Default updated', description: 'Withdrawals will use this method unless overridden.' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not update default',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      await tableRequest('delete', { filters: { id } });
      return { workspaceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods', result.workspaceId] });
      toast({ title: 'Payment method removed' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
