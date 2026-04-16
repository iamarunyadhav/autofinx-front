import { useMemo, useState } from 'react';
import { Coins, Rocket, Calculator, Play, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useStaking, useSimulateStaking, useStartStaking } from '@/hooks/useStaking';

export function StakingPanel() {
  const { currentWorkspace } = useWorkspace();
  const { data: positions = [], isLoading, refetch } = useStaking(currentWorkspace?.id);
  const simulate = useSimulateStaking();
  const start = useStartStaking();

  const [asset, setAsset] = useState('USDT');
  const [principal, setPrincipal] = useState(1000);
  const [apy, setApy] = useState(8);
  const [durationDays, setDurationDays] = useState(30);
  const [simResult, setSimResult] = useState<{ projected_yield: number } | null>(null);

  const totalAccrued = useMemo(() => positions.reduce((sum, p) => sum + Number(p.accrued || 0), 0), [positions]);

  const handleSimulate = async () => {
    if (!currentWorkspace) return;
    const res = await simulate.mutateAsync({
      workspaceId: currentWorkspace.id,
      asset,
      principal,
      apy,
      durationDays,
    });
    setSimResult(res);
  };

  const handleStart = async () => {
    if (!currentWorkspace) return;
    await start.mutateAsync({
      workspaceId: currentWorkspace.id,
      asset,
      principal,
      apy,
      durationDays,
    });
    setSimResult(null);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Staking & DeFi Simulator
          </CardTitle>
          <CardDescription>Model yields and track on-chain style accrual.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Auto-compound calc</Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Asset</label>
            <Input value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Principal</label>
            <Input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(parseFloat(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">APY %</label>
            <Input type="number" value={apy} onChange={(e) => setApy(parseFloat(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Duration (days)</label>
            <Input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value || '0', 10))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSimulate} disabled={simulate.isPending}>
            <Calculator className="h-4 w-4 mr-2" />
            {simulate.isPending ? 'Simulating...' : 'Simulate'}
          </Button>
          <Button onClick={handleStart} disabled={start.isPending || !currentWorkspace}>
            <Play className="h-4 w-4 mr-2" />
            {start.isPending ? 'Starting...' : 'Start Staking'}
          </Button>
          {simResult && (
            <div className="text-sm text-primary">
              Projected: +{simResult.projected_yield.toFixed(4)} {asset}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Active positions: {positions.length} | Accrued: {totalAccrued.toFixed(4)} {asset}
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>APY</TableHead>
                  <TableHead>Accrued</TableHead>
                  <TableHead>Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No staking positions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.asset}</TableCell>
                      <TableCell>{Number(p.principal).toFixed(4)}</TableCell>
                      <TableCell>{Number(p.apy).toFixed(2)}%</TableCell>
                      <TableCell>{Number(p.accrued).toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
