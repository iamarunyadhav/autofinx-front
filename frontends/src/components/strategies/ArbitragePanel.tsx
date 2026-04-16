import { useState } from 'react';
import { ArrowUpDown, AlertTriangle, Play, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useArbitrage, useExecuteArbitrage } from '@/hooks/useArbitrage';
import { useWorkspace } from '@/hooks/useWorkspace';

export function ArbitragePanel() {
  const { currentWorkspace } = useWorkspace();
  const [symbols, setSymbols] = useState('BTCUSDT,ETHUSDT');
  const [quantity, setQuantity] = useState(0.01);
  const { data = [], isLoading, refetch } = useArbitrage(currentWorkspace?.id, symbols.split(',').map(s => s.trim()).filter(Boolean));
  const execute = useExecuteArbitrage();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            Arbitrage Scanner
          </CardTitle>
          <CardDescription>Compare prices across exchanges and launch hedge trades.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-4 w-4" />
            Multi-venue
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Symbols (comma separated)</label>
            <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} placeholder="BTCUSDT,ETHUSDT" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Quantity (per leg)</label>
            <Input
              type="number"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Buy</TableHead>
                <TableHead>Sell</TableHead>
                <TableHead>Spread</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Scanning...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No opportunities detected
                  </TableCell>
                </TableRow>
              ) : (
                data.map((opp) => (
                  <TableRow key={opp.symbol}>
                    <TableCell className="font-medium">{opp.symbol}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-primary">${opp.buy.price.toFixed(2)}</span>
                        <span className="text-muted-foreground">{opp.buy.connection}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold text-success">${opp.sell.price.toFixed(2)}</span>
                        <span className="text-muted-foreground">{opp.sell.connection}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-mono text-foreground">{opp.spread.toFixed(4)}</span>
                        <span className="text-xs text-muted-foreground">
                          {opp.spread_percent.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={execute.isPending || opp.spread_percent <= 0}
                        onClick={() =>
                          currentWorkspace &&
                          execute.mutate({
                            workspaceId: currentWorkspace.id,
                            symbol: opp.symbol,
                            buyConnectionId: opp.buy.connection_id,
                            sellConnectionId: opp.sell.connection_id,
                            quantity,
                          })
                        }
                      >
                        {execute.isPending ? 'Queuing...' : 'Execute'}
                        <Play className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Live execution dispatches two legs; ensure both exchanges have funds and permissions.
        </div>
      </CardContent>
    </Card>
  );
}
