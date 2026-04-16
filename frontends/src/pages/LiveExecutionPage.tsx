import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useCancelOrder } from '@/hooks/useTrading';
import {
  useLiveExecutionHealth,
  useLiveOrders,
  useLiveOrderDetail,
  useLiveExecutionEvents,
  useLiveExecutionAnomalies,
  useWorkspaceLiveSync,
  useReconcileLiveOrder,
} from '@/hooks/useLiveExecution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, ActivitySquare } from 'lucide-react';

export default function LiveExecutionPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
  const { data: health } = useLiveExecutionHealth(workspaceId);
  const { data: orders = [], isLoading: ordersLoading } = useLiveOrders(workspaceId, symbol);
  const { data: orderDetail } = useLiveOrderDetail(selectedOrderId);
  const { data: events = [] } = useLiveExecutionEvents(workspaceId, selectedOrderId);
  const { data: anomalies = [] } = useLiveExecutionAnomalies(workspaceId);
  const syncWorkspace = useWorkspaceLiveSync(workspaceId);
  const reconcileOrder = useReconcileLiveOrder(workspaceId);
  const cancelOrder = useCancelOrder();

  const selectedOrder = orderDetail?.order || orders.find((order) => order.id === selectedOrderId) || null;
  const topEvents = useMemo(() => events.slice(0, 8), [events]);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ActivitySquare className="h-8 w-8 text-primary" />
                Live Execution
              </h1>
              <p className="text-muted-foreground mt-1">
                Binance spot execution state, reconciliation health, anomalies, and operator repair controls.
              </p>
            </div>
            <Badge variant="outline">Spot Only</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard title="Open Orders" value={String(health?.open_orders ?? 0)} />
            <MetricCard title="Uncertain" value={String(health?.uncertain_orders ?? 0)} />
            <MetricCard title="Stale Open" value={String(health?.stale_open_orders ?? 0)} />
            <MetricCard title="REST Failures" value={String(health?.rest_health?.consecutive_rest_failures ?? 0)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Live Orders</CardTitle>
                  <div className="flex gap-2">
                    <Input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="w-40" />
                    <Button variant="outline" onClick={() => syncWorkspace.mutate({ symbol })} disabled={syncWorkspace.isPending || !workspaceId}>
                      {syncWorkspace.isPending ? 'Syncing...' : 'Sync Symbol'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Reconcile</TableHead>
                        <TableHead>Slippage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
                          <TableCell>{order.asset_code}</TableCell>
                          <TableCell>{order.side}</TableCell>
                          <TableCell><StatusBadge status={order.status} /></TableCell>
                          <TableCell>{order.provider_status || '-'}</TableCell>
                          <TableCell>{order.reconciliation_state || '-'}</TableCell>
                          <TableCell>{order.slippage_pct ?? '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  reconcileOrder.mutate(order.id);
                                }}
                                disabled={reconcileOrder.isPending}
                              >
                                Reconcile
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cancelOrder.mutate({ orderId: order.id, workspaceId: workspaceId || '' });
                                }}
                                disabled={cancelOrder.isPending || !workspaceId}
                              >
                                Cancel
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

            <Card>
              <CardHeader>
                <CardTitle>Execution Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="font-medium">Provider breaker:</span> {String(health?.provider_breaker?.active ?? false)}</p>
                <p><span className="font-medium">Stale feed:</span> {String(health?.stale_feed_breaker?.active ?? false)}</p>
                <p><span className="font-medium">Avg slippage 24h:</span> {health?.avg_slippage_pct_24h ?? 0}</p>
                <p><span className="font-medium">Avg submit latency 24h:</span> {health?.avg_submission_latency_ms_24h ?? 0} ms</p>
                <div className="space-y-2">
                  <p className="font-medium">Streams</p>
                  {(health?.connections || []).length === 0 ? (
                    <p className="text-muted-foreground">No active Binance connections.</p>
                  ) : (
                    health?.connections?.map((connection: any) => (
                      <div key={connection.connection_id} className="rounded-md border p-3">
                        <p className="font-medium">{connection.connection_id}</p>
                        <p className="text-muted-foreground">status: {String(connection.stream?.status || 'idle')}</p>
                        <p className="text-muted-foreground">last event: {String(connection.stream?.last_event_at || 'n/a')}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Selected Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedOrder ? (
                  <p className="text-sm text-muted-foreground">Select a live order to inspect fills, attempts, and events.</p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                      <p><span className="font-medium">Order:</span> {selectedOrder.id}</p>
                      <p><span className="font-medium">Exchange order:</span> {selectedOrder.exchange_order_id || '-'}</p>
                      <p><span className="font-medium">Client order:</span> {selectedOrder.client_order_id || '-'}</p>
                      <p><span className="font-medium">Status:</span> {selectedOrder.status}</p>
                      <p><span className="font-medium">Provider status:</span> {selectedOrder.provider_status || '-'}</p>
                      <p><span className="font-medium">Reconcile state:</span> {selectedOrder.reconciliation_state || '-'}</p>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(orderDetail || selectedOrder, null, 2)}
                    </pre>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Reconciliation Anomalies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {anomalies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent live execution anomalies.</p>
                  ) : (
                    anomalies.slice(0, 8).map((anomaly) => (
                      <div key={anomaly.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{anomaly.type}</p>
                          <Badge variant="outline">{anomaly.severity}</Badge>
                        </div>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(anomaly.reason_json || {}, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Execution Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events for the selected order.</p>
                  ) : (
                    topEvents.map((event) => (
                      <div key={event.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{event.event_type}</p>
                          <Badge variant="outline">{event.severity}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{event.occurred_at}</p>
                        {event.payload_json && (
                          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'UNCERTAIN' || status === 'REJECTED') return <Badge variant="destructive">{status}</Badge>;
  if (status === 'PARTIAL' || status === 'pending_provider') return <Badge variant="secondary">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
