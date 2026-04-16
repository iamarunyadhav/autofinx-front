import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Activity,
  BarChart3,
  Target,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  StatCard,
  StrategyCard,
  ActivityFeed,
  PortfolioChart,
  RealtimeTicker,
  QuickActions,
  RecentTrades,
  PortfolioValue,
} from "@/components/dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBalances } from "@/hooks/useWallet";
import { usePositions, useOrders } from "@/hooks/useTrading";
import { useStrategyInstances, useToggleInstance } from "@/hooks/useStrategy";
import { useSystemSettings } from "@/hooks/useRisk";
import { useConnections } from "@/hooks/useConnections";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles } from "@/hooks/useMarketData";
import { PredictionChart } from "@/components/analytics/PredictionChart";

export function DashboardPage() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  
  const { data: balances, isLoading: balancesLoading } = useBalances(workspaceId);
  const { data: positions } = usePositions(workspaceId, 'paper');
  const { data: orders } = useOrders(workspaceId, 'filled');
  const { data: strategyInstances, isLoading: strategiesLoading } = useStrategyInstances(workspaceId);
  const { data: systemSettings } = useSystemSettings(workspaceId);
  const { data: connections } = useConnections(workspaceId);
  const toggleInstance = useToggleInstance();
  const { data: candles, isLoading: candlesLoading } = useCandles('BTCUSDT', '5m', 60);

  const todayPnL = useMemo(
    () => positions?.reduce((sum, p) => sum + Number(p.unrealized_pnl || 0), 0) || 0,
    [positions]
  );

  const activeStrategies = useMemo(
    () => strategyInstances?.filter((s) => s.is_enabled).length || 0,
    [strategyInstances]
  );

  const strategies = useMemo(
    () =>
      strategyInstances?.map((instance, idx) => {
        const seed = idx + 1;
        const pnl = (seed * 137) % 2000 - 500; // deterministic placeholder
        const pnlPercent = (seed * 7) % 15 - 3;
        const trades24h = (seed * 11) % 40;
        const winRate = 55 + ((seed * 3) % 20);
        const connectionName = instance.connection_id
          ? connections?.find((c) => c.id === instance.connection_id)?.name || `Conn ${instance.connection_id.slice(0, 4)}`
          : undefined;
        return {
          id: instance.id,
          name: instance.name,
          type: instance.strategies?.strategy_type || 'custom',
          asset: 'Multi-asset',
          mode: instance.mode as 'live' | 'paper',
          status: instance.is_enabled ? ('running' as const) : ('paused' as const),
          pnl,
          pnlPercent,
          trades24h,
          winRate,
          connection: connectionName,
        };
      }) || [],
    [strategyInstances, connections]
  );

  const handleStrategyToggle = (id: string) => {
    if (!workspaceId) return;
    const strategy = strategyInstances?.find(s => s.id === id);
    if (strategy) {
      toggleInstance.mutate({
        instanceId: id,
        workspaceId,
        isEnabled: !strategy.is_enabled,
      });
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <h2 className="text-xl font-semibold">No Workspace</h2>
        <p className="text-muted-foreground">Create a workspace to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Monitor your trading performance in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={activeStrategies > 0 ? "running" : "secondary"} 
            pulse={activeStrategies > 0}
            className="px-3 py-1"
          >
            <Activity className="w-3 h-3 mr-1" />
            {activeStrategies} Active {activeStrategies === 1 ? 'Strategy' : 'Strategies'}
          </Badge>
        </div>
      </div>

      {/* Top Row: Portfolio + Stats + Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Portfolio Value - Real-time */}
        <PortfolioValue />
        
        {/* Stats */}
        {balancesLoading ? (
          <>
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </>
        ) : (
          <>
            <StatCard
              title="Today's P&L"
              value={todayPnL >= 0 ? `+$${todayPnL.toFixed(2)}` : `-$${Math.abs(todayPnL).toFixed(2)}`}
              change={`${orders?.length || 0} trades`}
              changeType={todayPnL >= 0 ? "positive" : "negative"}
              icon={TrendingUp}
              subtitle="Unrealized gains"
              delay={0.1}
            />
            <StatCard
              title="Win Rate"
              value="68.5%"
              change="+3.2%"
              changeType="positive"
              icon={Target}
              subtitle="Last 30 days"
              delay={0.2}
            />
            <StatCard
              title="Active Positions"
              value={String(positions?.length || 0)}
              icon={BarChart3}
              subtitle={`${activeStrategies} strategies running`}
              delay={0.3}
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Portfolio Chart - 2 cols */}
        <div className="xl:col-span-2">
          <PortfolioChart />
        </div>

        {/* Quick Actions */}
        <QuickActions />
      </div>

      {/* Live Prices & Recent Trades */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RealtimeTicker />
        <div className="xl:col-span-2">
          <RecentTrades />
        </div>
      </div>

      {/* Strategies & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Strategies */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Strategies</h2>
            <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
              View All -&gt;
            </Badge>
          </div>
          {strategiesLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : strategies.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {strategies.slice(0, 4).map((strategy, index) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onToggle={handleStrategyToggle}
                  delay={index * 0.1}
                />
              ))}
            </div>
          ) : (
            <Card variant="glass" className="p-8 text-center">
              <p className="text-muted-foreground">No strategies yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first strategy to start trading</p>
            </Card>
          )}
        </div>

        {/* Activity Feed */}
        <ActivityFeed />
      </div>

      {/* AI Prediction */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">AI Price Forecast</h2>
            <p className="text-sm text-muted-foreground">BTCUSDT live curve + predictive signal</p>
          </div>
          {candlesLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <PredictionChart
          symbol="BTCUSDT"
          candles={candles || []}
          isLoading={candlesLoading}
        />
      </div>

      {/* Risk Summary */}
      <Card variant="glass">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Risk Summary
            </CardTitle>
            <Badge variant={systemSettings?.global_trading_enabled ? "running" : "destructive"}>
              {systemSettings?.global_trading_enabled ? 'Trading Active' : 'Trading Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <RiskMetric
              label="Daily Loss Limit"
              value="$2,500 / $5,000"
              percent={50}
              status="safe"
            />
            <RiskMetric
              label="Max Drawdown"
              value="8.2%"
              percent={41}
              status="safe"
            />
            <RiskMetric
              label="Position Exposure"
              value={`${positions?.length || 0} / 10`}
              percent={(positions?.length || 0) * 10}
              status={(positions?.length || 0) > 7 ? "warning" : "safe"}
            />
            <RiskMetric
              label="Active Strategies"
              value={`${activeStrategies} / ${systemSettings?.max_concurrent_strategies || 10}`}
              percent={(activeStrategies / (systemSettings?.max_concurrent_strategies || 10)) * 100}
              status={activeStrategies > 8 ? "warning" : "safe"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  percent,
  status,
}: {
  label: string;
  value: string;
  percent: number;
  status: "safe" | "warning" | "danger";
}) {
  const colors = {
    safe: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-mono font-medium">{value}</p>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`h-full rounded-full ${colors[status]}`}
        />
      </div>
    </div>
  );
}
