import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrders } from '@/hooks/useTrading';
import { useWorkspace } from '@/hooks/useWorkspace';

export function RecentTrades() {
  const { currentWorkspace } = useWorkspace();
  const { data: orders, isLoading } = useOrders(currentWorkspace?.id, 'filled');

  // Get the 5 most recent trades
  const recentTrades = orders?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentTrades.length === 0) {
    return (
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No trades yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your recent trades will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Trades
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {orders?.length || 0} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Side</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.map((trade) => {
                const isBuy = trade.side === 'buy';
                
                return (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <Badge 
                        variant={isBuy ? 'default' : 'destructive'}
                        className="text-xs flex items-center gap-1 w-fit"
                      >
                        {isBuy ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownLeft className="w-3 h-3" />
                        )}
                        {trade.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {trade.symbol_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(trade.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${Number(trade.avg_fill_price || trade.price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">
                      {trade.filled_at 
                        ? format(new Date(trade.filled_at), 'HH:mm:ss')
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
