import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, FlaskConical, ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  useEvaluateFutures,
  useFuturesAnomalies,
  useFuturesConfig,
  useFuturesOrders,
  useFuturesPositions,
  useFuturesReadiness,
  usePlaceFuturesOrder,
  useSyncFutures,
  useUpdateFuturesConfig,
} from '@/hooks/useFuturesGroundwork';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ConfigForm = {
  futures_enabled: boolean;
  futures_mode: 'disabled' | 'testnet_only' | 'review_only' | 'restricted_testnet_auto';
  allowed_futures_symbols: string;
  blocked_futures_symbols: string;
  max_futures_trade_size_pct: string;
  max_futures_notional: string;
  max_leverage: string;
  allowed_margin_modes: string;
  allowed_position_modes: string;
  max_open_futures_positions: string;
  max_futures_daily_loss_pct: string;
  max_futures_drawdown_pct: string;
  min_liquidation_buffer_pct: string;
  require_reduce_only_for_protective_exit: boolean;
  require_manual_approval_for_futures: boolean;
  futures_confidence_threshold: string;
  futures_force_testnet: boolean;
  notes: string;
};

const emptyForm: ConfigForm = {
  futures_enabled: false,
  futures_mode: 'disabled',
  allowed_futures_symbols: 'BTCUSDT',
  blocked_futures_symbols: '',
  max_futures_trade_size_pct: '1',
  max_futures_notional: '100',
  max_leverage: '3',
  allowed_margin_modes: 'isolated',
  allowed_position_modes: 'one_way',
  max_open_futures_positions: '1',
  max_futures_daily_loss_pct: '2',
  max_futures_drawdown_pct: '4',
  min_liquidation_buffer_pct: '15',
  require_reduce_only_for_protective_exit: true,
  require_manual_approval_for_futures: true,
  futures_confidence_threshold: '0.65',
  futures_force_testnet: true,
  notes: '',
};

type OrderForm = {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  qty: string;
  price: string;
  leverage: string;
  margin_mode: 'isolated' | 'cross';
  position_mode: 'one_way' | 'hedge';
  position_side: 'BOTH' | 'LONG' | 'SHORT';
  reduce_only: boolean;
  protective_exit: boolean;
  confidence: string;
};

const emptyOrder: OrderForm = {
  symbol: 'BTCUSDT',
  side: 'buy',
  type: 'market',
  qty: '0.001',
  price: '',
  leverage: '2',
  margin_mode: 'isolated',
  position_mode: 'one_way',
  position_side: 'BOTH',
  reduce_only: false,
  protective_exit: false,
  confidence: '0.75',
};

export default function FuturesGroundworkPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [form, setForm] = useState<ConfigForm>(emptyForm);
  const [order, setOrder] = useState<OrderForm>(emptyOrder);
  const { data: config } = useFuturesConfig(workspaceId);
  const { data: readiness } = useFuturesReadiness(workspaceId);
  const { data: positions = [] } = useFuturesPositions(workspaceId);
  const { data: orders = [] } = useFuturesOrders(workspaceId);
  const { data: anomalies = [] } = useFuturesAnomalies(workspaceId);
  const updateConfig = useUpdateFuturesConfig(workspaceId);
  const evaluate = useEvaluateFutures(workspaceId);
  const placeOrder = usePlaceFuturesOrder(workspaceId);
  const sync = useSyncFutures(workspaceId);

  useEffect(() => {
    if (!config) return;
    setForm({
      futures_enabled: !!config.futures_enabled,
      futures_mode: config.futures_mode,
      allowed_futures_symbols: (config.allowed_futures_symbols || []).join(', '),
      blocked_futures_symbols: (config.blocked_futures_symbols || []).join(', '),
      max_futures_trade_size_pct: String(config.max_futures_trade_size_pct ?? 1),
      max_futures_notional: String(config.max_futures_notional ?? 100),
      max_leverage: String(config.max_leverage ?? 3),
      allowed_margin_modes: (config.allowed_margin_modes || []).join(', '),
      allowed_position_modes: (config.allowed_position_modes || []).join(', '),
      max_open_futures_positions: String(config.max_open_futures_positions ?? 1),
      max_futures_daily_loss_pct: String(config.max_futures_daily_loss_pct ?? ''),
      max_futures_drawdown_pct: String(config.max_futures_drawdown_pct ?? ''),
      min_liquidation_buffer_pct: String(config.min_liquidation_buffer_pct ?? 15),
      require_reduce_only_for_protective_exit: !!config.require_reduce_only_for_protective_exit,
      require_manual_approval_for_futures: !!config.require_manual_approval_for_futures,
      futures_confidence_threshold: String(config.futures_confidence_threshold ?? 0.65),
      futures_force_testnet: !!config.futures_force_testnet,
      notes: config.notes || '',
    });
  }, [config]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="flex items-center gap-3 text-3xl font-bold">
                <FlaskConical className="h-8 w-8 text-destructive" />
                Futures Groundwork
              </h1>
              <p className="text-sm text-muted-foreground">
                Binance futures is isolated, guarded, and testnet-first. Live futures remains blocked in this phase.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="destructive">LIVE FUTURES BLOCKED</Badge>
              <Badge variant="secondary">TESTNET ONLY</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StateCard title="Readiness" value={readiness?.state || 'unknown'} />
          <StateCard title="Manual Test Orders" value={readiness?.supports_manual_test_order ? 'allowed' : 'blocked'} />
          <StateCard title="Open Futures Positions" value={String(positions.length)} />
          <StateCard title="Futures Anomalies" value={String(anomalies.length)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Futures Config</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Enable Futures">
                  <Switch checked={form.futures_enabled} onCheckedChange={(value) => setForm((prev) => ({ ...prev, futures_enabled: value }))} />
                </Field>
                <Field label="Force Testnet">
                  <Switch checked={form.futures_force_testnet} onCheckedChange={(value) => setForm((prev) => ({ ...prev, futures_force_testnet: value }))} />
                </Field>
                <Field label="Mode">
                  <select className="h-10 rounded-md border bg-background px-3" value={form.futures_mode} onChange={(e) => setForm((prev) => ({ ...prev, futures_mode: e.target.value as ConfigForm['futures_mode'] }))}>
                    <option value="disabled">disabled</option>
                    <option value="testnet_only">testnet_only</option>
                    <option value="review_only">review_only</option>
                    <option value="restricted_testnet_auto">restricted_testnet_auto</option>
                  </select>
                </Field>
                <Field label="Max Leverage">
                  <Input value={form.max_leverage} onChange={(e) => setForm((prev) => ({ ...prev, max_leverage: e.target.value }))} />
                </Field>
                <Field label="Max Notional">
                  <Input value={form.max_futures_notional} onChange={(e) => setForm((prev) => ({ ...prev, max_futures_notional: e.target.value }))} />
                </Field>
                <Field label="Max Trade Size %">
                  <Input value={form.max_futures_trade_size_pct} onChange={(e) => setForm((prev) => ({ ...prev, max_futures_trade_size_pct: e.target.value }))} />
                </Field>
                <Field label="Allowed Margin Modes">
                  <Input value={form.allowed_margin_modes} onChange={(e) => setForm((prev) => ({ ...prev, allowed_margin_modes: e.target.value }))} />
                </Field>
                <Field label="Allowed Position Modes">
                  <Input value={form.allowed_position_modes} onChange={(e) => setForm((prev) => ({ ...prev, allowed_position_modes: e.target.value }))} />
                </Field>
                <Field label="Max Open Positions">
                  <Input value={form.max_open_futures_positions} onChange={(e) => setForm((prev) => ({ ...prev, max_open_futures_positions: e.target.value }))} />
                </Field>
                <Field label="Min Liquidation Buffer %">
                  <Input value={form.min_liquidation_buffer_pct} onChange={(e) => setForm((prev) => ({ ...prev, min_liquidation_buffer_pct: e.target.value }))} />
                </Field>
                <Field label="Daily Loss %">
                  <Input value={form.max_futures_daily_loss_pct} onChange={(e) => setForm((prev) => ({ ...prev, max_futures_daily_loss_pct: e.target.value }))} />
                </Field>
                <Field label="Drawdown %">
                  <Input value={form.max_futures_drawdown_pct} onChange={(e) => setForm((prev) => ({ ...prev, max_futures_drawdown_pct: e.target.value }))} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Allowed Symbols">
                  <Input value={form.allowed_futures_symbols} onChange={(e) => setForm((prev) => ({ ...prev, allowed_futures_symbols: e.target.value }))} />
                </Field>
                <Field label="Blocked Symbols">
                  <Input value={form.blocked_futures_symbols} onChange={(e) => setForm((prev) => ({ ...prev, blocked_futures_symbols: e.target.value }))} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Reduce-only protective exits">
                  <Switch checked={form.require_reduce_only_for_protective_exit} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_reduce_only_for_protective_exit: value }))} />
                </Field>
                <Field label="Manual approval">
                  <Switch checked={form.require_manual_approval_for_futures} onCheckedChange={(value) => setForm((prev) => ({ ...prev, require_manual_approval_for_futures: value }))} />
                </Field>
                <Field label="Confidence threshold">
                  <Input value={form.futures_confidence_threshold} onChange={(e) => setForm((prev) => ({ ...prev, futures_confidence_threshold: e.target.value }))} />
                </Field>
              </div>

              <Field label="Notes">
                <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} />
              </Field>

              <Button
                onClick={() => updateConfig.mutate({
                  futures_enabled: form.futures_enabled,
                  futures_mode: form.futures_mode,
                  allowed_futures_symbols: splitCsv(form.allowed_futures_symbols),
                  blocked_futures_symbols: splitCsv(form.blocked_futures_symbols),
                  max_futures_trade_size_pct: numberOrNull(form.max_futures_trade_size_pct),
                  max_futures_notional: numberOrNull(form.max_futures_notional),
                  max_leverage: numberOrNull(form.max_leverage),
                  allowed_margin_modes: splitModes(form.allowed_margin_modes),
                  allowed_position_modes: splitModes(form.allowed_position_modes),
                  max_open_futures_positions: numberOrNull(form.max_open_futures_positions),
                  max_futures_daily_loss_pct: numberOrNull(form.max_futures_daily_loss_pct),
                  max_futures_drawdown_pct: numberOrNull(form.max_futures_drawdown_pct),
                  min_liquidation_buffer_pct: numberOrNull(form.min_liquidation_buffer_pct),
                  require_reduce_only_for_protective_exit: form.require_reduce_only_for_protective_exit,
                  require_manual_approval_for_futures: form.require_manual_approval_for_futures,
                  futures_confidence_threshold: numberOrNull(form.futures_confidence_threshold),
                  futures_force_testnet: form.futures_force_testnet,
                  notes: form.notes || null,
                })}
                disabled={updateConfig.isPending}
              >
                {updateConfig.isPending ? 'Saving...' : 'Save Futures Config'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Testnet Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Symbol">
                  <Input value={order.symbol} onChange={(e) => setOrder((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))} />
                </Field>
                <Field label="Side">
                  <select className="h-10 rounded-md border bg-background px-3" value={order.side} onChange={(e) => setOrder((prev) => ({ ...prev, side: e.target.value as OrderForm['side'] }))}>
                    <option value="buy">buy</option>
                    <option value="sell">sell</option>
                  </select>
                </Field>
                <Field label="Type">
                  <select className="h-10 rounded-md border bg-background px-3" value={order.type} onChange={(e) => setOrder((prev) => ({ ...prev, type: e.target.value as OrderForm['type'] }))}>
                    <option value="market">market</option>
                    <option value="limit">limit</option>
                  </select>
                </Field>
                <Field label="Qty">
                  <Input value={order.qty} onChange={(e) => setOrder((prev) => ({ ...prev, qty: e.target.value }))} />
                </Field>
                <Field label="Limit Price">
                  <Input value={order.price} onChange={(e) => setOrder((prev) => ({ ...prev, price: e.target.value }))} />
                </Field>
                <Field label="Leverage">
                  <Input value={order.leverage} onChange={(e) => setOrder((prev) => ({ ...prev, leverage: e.target.value }))} />
                </Field>
                <Field label="Margin Mode">
                  <select className="h-10 rounded-md border bg-background px-3" value={order.margin_mode} onChange={(e) => setOrder((prev) => ({ ...prev, margin_mode: e.target.value as OrderForm['margin_mode'] }))}>
                    <option value="isolated">isolated</option>
                    <option value="cross">cross</option>
                  </select>
                </Field>
                <Field label="Position Mode">
                  <select className="h-10 rounded-md border bg-background px-3" value={order.position_mode} onChange={(e) => setOrder((prev) => ({ ...prev, position_mode: e.target.value as OrderForm['position_mode'] }))}>
                    <option value="one_way">one_way</option>
                    <option value="hedge">hedge</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Position Side">
                  <select className="h-10 rounded-md border bg-background px-3" value={order.position_side} onChange={(e) => setOrder((prev) => ({ ...prev, position_side: e.target.value as OrderForm['position_side'] }))}>
                    <option value="BOTH">BOTH</option>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </Field>
                <Field label="Reduce Only">
                  <Switch checked={order.reduce_only} onCheckedChange={(value) => setOrder((prev) => ({ ...prev, reduce_only: value }))} />
                </Field>
                <Field label="Protective Exit">
                  <Switch checked={order.protective_exit} onCheckedChange={(value) => setOrder((prev) => ({ ...prev, protective_exit: value }))} />
                </Field>
              </div>

              <Field label="Confidence">
                <Input value={order.confidence} onChange={(e) => setOrder((prev) => ({ ...prev, confidence: e.target.value }))} />
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => evaluate.mutate(buildOrderPayload(order))} disabled={evaluate.isPending}>
                  {evaluate.isPending ? 'Evaluating...' : 'Evaluate'}
                </Button>
                <Button variant="secondary" onClick={() => placeOrder.mutate(buildOrderPayload(order))} disabled={placeOrder.isPending}>
                  {placeOrder.isPending ? 'Submitting...' : 'Submit Testnet Order'}
                </Button>
                <Button variant="outline" onClick={() => sync.mutate({})} disabled={sync.isPending}>
                  {sync.isPending ? 'Syncing...' : 'Sync Futures'}
                </Button>
              </div>

              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Futures direct order submission is operator-only and testnet-only. If readiness is `review_only`, submission remains blocked even if evaluation passes.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Futures Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Leverage</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Liq Buffer %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>{position.asset_code}</TableCell>
                      <TableCell>{position.qty}</TableCell>
                      <TableCell>{position.leverage ?? '-'}</TableCell>
                      <TableCell>{position.margin_mode ?? '-'}</TableCell>
                      <TableCell>{position.liquidation_buffer_pct ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Futures Anomalies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No futures anomalies recorded.</p>
              ) : (
                anomalies.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.type}</p>
                      <Badge variant="destructive">{item.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{String(item.reason_json?.message || '')}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Futures Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reduce Only</TableHead>
                  <TableHead>Environment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.asset_code}</TableCell>
                    <TableCell>{item.side}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{String(item.meta?.reduce_only ?? false)}</TableCell>
                    <TableCell>{String(item.meta?.environment ?? 'testnet')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-foreground">Readiness boundaries</p>
              <p className="mt-1">
                This page is groundwork only. It does not imply unrestricted live futures readiness. Liquidation safety, reduce-only exits, and position mode checks are enforced conservatively, and unsupported cases are blocked.
              </p>
              {readiness?.reasons?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {readiness.reasons.map((reason) => (
                    <Badge key={reason} variant="outline">{reason}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StateCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
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

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function splitModes(value: string): string[] {
  return value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function numberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildOrderPayload(order: OrderForm) {
  return {
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    qty: Number(order.qty),
    price: numberOrNull(order.price),
    leverage: Number(order.leverage),
    margin_mode: order.margin_mode,
    position_mode: order.position_mode,
    position_side: order.position_side,
    reduce_only: order.reduce_only,
    protective_exit: order.protective_exit,
    confidence: numberOrNull(order.confidence),
  };
}
