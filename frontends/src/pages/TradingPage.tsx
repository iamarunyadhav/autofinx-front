import { useMemo } from 'react';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useOrders, usePositions, useTrades } from '@/hooks/useTrading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function TradingPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(false);
  const { data: positions, isLoading: positionsLoading } = usePositions(workspaceId, 'paper');
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders(workspaceId);
  const { data: trades, isLoading: tradesLoading } = useTrades(workspaceId);

  const positionValue = useMemo(
    () => positions?.reduce((sum, p) => sum + Number(p.avg_price || 0) * Number(p.quantity || 0), 0) || 0,
    [positions]
  );

  const pendingCount = useMemo(
    () => orders?.filter((o) => o.status === 'pending_provider').length || 0,
    [orders]
  );

  const handlePollOrders = async () => {
    if (!workspaceId) return;
    setPolling(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/ops/poll-orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      });
      await refetchOrders();
      queryClient.invalidateQueries({ queryKey: ['orders', workspaceId] });
    } catch (e) {
      // silent
    } finally {
      setPolling(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trading</h1>
            <p className="text-muted-foreground mt-1">View positions, orders, and recent trades.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Paper</Button>
            <Button size="sm" disabled>Live (disabled)</Button>
            <Button variant="secondary" size="sm" onClick={handlePollOrders} disabled={polling}>
              {polling ? 'Polling...' : 'Poll Pending'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{positions?.length || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Open Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{orders?.length || 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pending Provider</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{pendingCount}</div>}
              <p className="text-xs text-muted-foreground mt-1">Awaiting exchange confirmation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Position Notional (paper)</CardTitle>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold">${positionValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : positions && positions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Unrealized P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell>{pos.symbol_id}</TableCell>
                      <TableCell className="text-right">{Number(pos.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${Number(pos.avg_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={Number(pos.unrealized_pl) >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {Number(pos.unrealized_pl).toFixed(2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-muted-foreground text-sm">No open positions</div>
            )}
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
            {ordersLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : orders && orders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                      <TableCell>{order.symbols?.symbol || order.symbol_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={order.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                          {order.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status as string} />
                      </TableCell>
                      <TableCell className="text-right">{Number(order.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{order.price ? `$${Number(order.price).toFixed(2)}` : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.meta?.provider || order.meta?.connection_id || '-'}
                        {order.meta?.provider_status && (
                          <div className="text-[10px] text-muted-foreground">
                            {order.meta?.provider_status}
                            {order.meta?.last_polled_at ? ` · ${new Date(order.meta.last_polled_at).toLocaleTimeString()}` : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.created_at ? format(new Date(order.created_at), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-muted-foreground text-sm">No recent orders</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {tradesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : trades && trades.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>{trade.order_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {trade.quantity >= 0 ? (
                            <ArrowUpCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownCircle className="h-3 w-3 text-red-500" />
                          )}
                          {trade.quantity >= 0 ? 'BUY' : 'SELL'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${Number(trade.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(trade.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{trade.fee ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {trade.executed_at ? format(new Date(trade.executed_at), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-muted-foreground text-sm">No trades yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
